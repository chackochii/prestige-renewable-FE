// Pipeline: the same records two ways.
//
// The list is the default — it is the one that reads at a glance, sorts, and
// takes filters without hiding anything behind a column. The board is there
// for the work the list is bad at: seeing where everything sits, and dragging
// a job into the next stage.
//
// The view, the stage filter and the lifecycle all live in the URL, so a
// filtered board or list is a link somebody can send.

import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { Columns3, Rows3, X } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import Alert from "@/components/Alert";
import JobCard from "@/components/JobCard";
import OppCell from "@/components/OppCell";
import LoadMore from "@/components/LoadMore";
import { oppTitle, oppValue } from "@/helpers/opportunity";
import { enabledStagesFor, nextStageFor, stageById } from "@/constants/stages";
import { PERMISSIONS } from "@/constants/permissions";
import { advanceableStages, canAdvanceFrom, canViewStage, viewableStages } from "@/helpers/stageAccess";
import { createdById, jobStatus, JOB_STATUS_OPTIONS } from "@/helpers/jobStatus";
import { formatDate, slaStatus } from "@/helpers/dateTimeHelpers";
import { formatCurrency } from "@/utils/formatCurrency";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useOpportunities } from "@/hooks/useOpportunities";
import { useUnitUsers } from "@/hooks/useUnitUsers";
import { useNotifications } from "@/hooks/useNotifications";
import { useAppDispatch } from "@/store";
import { advanceStage } from "@/slices/leadsSlice";

const LIFECYCLE_OPTIONS = [
  { value: "Active", label: "Active" },
  { value: "Won", label: "Won" },
  { value: "Lost", label: "Lost" },
  { value: "Closed", label: "Closed" },
  { value: "all", label: "All lifecycles" },
];

export default function PipelinePage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { unit } = useBusinessUnit();
  const { users, sales, byId, userName } = useUnitUsers();
  const { notify } = useNotifications();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [authorId, setAuthorId] = useState("");
  const [statusKey, setStatusKey] = useState("");
  const [draggingId, setDraggingId] = useState(null);

  // A ?stage= pointing at a stage this person cannot see is ignored rather than
  // obeyed — a stale link or a bookmark should show their board, not nothing.
  const requestedStage = params.get("stage") || "";
  const stageFilter = requestedStage && canViewStage(user, requestedStage) ? requestedStage : "";
  const lifecycle = params.get("life") || "Active";
  const view = params.get("view") === "board" ? "board" : "list";
  // Lifecycle, search, owner and stage are applied by the API, not in the
  // browser: with only part of the pipeline loaded, filtering here would
  // silently miss everything not yet fetched.
  const settledSearch = useDebouncedValue(search.trim(), 300);
  const { items, status, error, ready, reload, total, loaded, hasMore, loadingMore, loadMore } = useOpportunities(
    {
      ...(lifecycle === "all" ? {} : { lifecycle }),
      ...(settledSearch ? { search: settledSearch } : {}),
      ...(ownerId ? { ownerId } : {}),
      ...(stageFilter ? { stage: stageFilter } : {}),
    },
    { pageSize: 50 },
  );

  /** Keeps the other URL filters when one of them changes. */
  const setParam = (key, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next);
  };

  // Stages this unit runs, narrowed to the ones this person may see. A stage
  // their role does not cover gets no column and no cards — the API filters the
  // records out too, so an empty column would be misleading rather than honest.
  const stages = useMemo(() => viewableStages(user, enabledStagesFor(unit)), [unit, user]);
  // Moving a card is per stage, not one permission for the whole board: the
  // stage being left decides (see helpers/stageAccess). Someone may own
  // Estimation and nothing else, so only those cards are draggable for them.
  const canMoveFrom = useCallback((stage) => canAdvanceFrom(user, stage), [user]);
  const movableStages = useMemo(() => advanceableStages(user, stages), [user, stages]);

  // Status and Created by are worked out here rather than by the API — one is
  // derived from several fields, the other from whichever author field the
  // record carries — so they narrow what has been loaded, not the whole set.
  const rows = useMemo(
    () =>
      items
        .filter((o) => (authorId ? String(createdById(o)) === authorId : true))
        .filter((o) => (statusKey ? (jobStatus(o, { userName })?.key || "none") === statusKey : true))
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    [items, authorId, statusKey, userName],
  );

  const columns = useMemo(() => {
    const byStage = new Map();
    rows.forEach((o) => {
      const key = Number(o.stage);
      if (!byStage.has(key)) byStage.set(key, []);
      byStage.get(key).push(o);
    });
    return stages
      .filter((s) => (stageFilter ? String(s.id) === stageFilter : true))
      .map((s) => ({ stage: s, rows: byStage.get(s.id) || [] }));
  }, [rows, stages, stageFilter]);

  const totalValue = rows.reduce((sum, o) => sum + oppValue(o), 0);
  const dragging = draggingId ? items.find((o) => o.id === draggingId) : null;
  const dropTarget = dragging ? nextStageFor(dragging.stage, unit) : null;

  const drop = async (e, stageId) => {
    e.preventDefault();
    if (!dragging || stageId !== dropTarget) return;
    setDraggingId(null);
    try {
      await dispatch(advanceStage(dragging.id)).unwrap();
      notify(`${oppTitle(dragging)} moved to ${stageById(stageId).label}`);
    } catch (err) {
      notify(`Can't move yet — ${typeof err === "string" ? err : err?.message}`, "danger");
    }
  };

  const ownerOptions = sales.length ? sales : users;
  const filtered = Boolean(stageFilter || ownerId || authorId || statusKey || search);

  const clearFilters = () => {
    setOwnerId("");
    setAuthorId("");
    setStatusKey("");
    setSearch("");
    setParam("stage", "");
  };

  return (
    <>
      <PageHeader
        title="Pipeline"
        description={
          ready
            ? `${rows.length} opportunit${rows.length === 1 ? "y" : "ies"} weighted at ${formatCurrency(totalValue)}.${
                view === "board" && movableStages.length
                  ? ` Drag a card to move it into the next stage — you can move ${movableStages.map((s) => s.short).join(", ")}.`
                  : ""
              }`
            : "Loading the pipeline…"
        }
        actions={
          hasPermission(PERMISSIONS.LEADS_CREATE) ? (
            <Link className="btn btn-primary" to="/leads/new">
              New lead
            </Link>
          ) : null
        }
      />

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search name or number"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search pipeline"
        />
        <select
          className="select"
          value={stageFilter}
          onChange={(e) => setParam("stage", e.target.value)}
          aria-label="Stage filter"
        >
          <option value="">All stages</option>
          {stages.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          className="select"
          value={statusKey}
          onChange={(e) => setStatusKey(e.target.value)}
          aria-label="Status filter"
        >
          <option value="">All statuses</option>
          {JOB_STATUS_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        <select className="select" value={ownerId} onChange={(e) => setOwnerId(e.target.value)} aria-label="Owner filter">
          <option value="">All owners</option>
          {ownerOptions.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select
          className="select"
          value={authorId}
          onChange={(e) => setAuthorId(e.target.value)}
          aria-label="Created by filter"
        >
          <option value="">Created by anyone</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
        <select
          className="select"
          value={lifecycle}
          onChange={(e) => setParam("life", e.target.value)}
          aria-label="Lifecycle filter"
        >
          {LIFECYCLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {filtered ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
            <X size={14} /> Clear filters
          </button>
        ) : null}

        <div className="view-toggle" style={{ marginLeft: "auto" }} role="group" aria-label="View">
          <button
            type="button"
            className={`btn btn-ghost btn-sm${view === "list" ? " is-on" : ""}`}
            aria-pressed={view === "list"}
            onClick={() => setParam("view", "")}
          >
            <Rows3 size={14} /> List
          </button>
          <button
            type="button"
            className={`btn btn-ghost btn-sm${view === "board" ? " is-on" : ""}`}
            aria-pressed={view === "board"}
            onClick={() => setParam("view", "board")}
          >
            <Columns3 size={14} /> Board
          </button>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={reload}>
          Refresh
        </button>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {status === "loading" && !ready ? (
        <div className="card card-pad">
          <LoadingState label="Loading pipeline…" />
        </div>
      ) : rows.length === 0 ? (
        <div className="card card-pad">
          <EmptyState
            title="Nothing to show"
            body={filtered ? "No job matches these filters." : "Capture a new lead to get started."}
          />
        </div>
      ) : view === "list" ? (
        <div className="card card-pad">
          <div className="table-wrap">
            <table className="table clickable stack">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Stage</th>
                  <th>Status</th>
                  <th>Value</th>
                  <th>Owner</th>
                  <th>Created by</th>
                  <th>SLA</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const badge = jobStatus(o, { userName });
                  const sla = slaStatus(o.slaDueAt);
                  return (
                    <tr key={o.id} onClick={() => navigate(`/opportunities/${o.id}`)}>
                      <td data-label="Job">
                        <OppCell opp={o} />
                      </td>
                      <td data-label="Stage">{stageById(o.stage).label}</td>
                      <td data-label="Status">
                        {badge ? (
                          <Badge tone={badge.tone} title={badge.title}>
                            {badge.label}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td data-label="Value">{formatCurrency(oppValue(o))}</td>
                      <td data-label="Owner">{userName(o.salespersonId || o.leadOwnerId) || "—"}</td>
                      <td data-label="Created by">{userName(createdById(o)) || "—"}</td>
                      <td data-label="SLA">
                        <Badge tone={sla.tone}>{sla.label}</Badge>
                      </td>
                      <td data-label="Updated">{formatDate(o.updatedAt)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="kanban">
          {columns.map(({ stage, rows: cards }) => {
            const value = cards.reduce((sum, o) => sum + oppValue(o), 0);
            const dropOk = dropTarget === stage.id;
            return (
              <div
                key={stage.id}
                className={`kanban-col ${dropOk ? "drop-ok" : ""}`.trim()}
                onDragOver={(e) => {
                  if (dropOk) e.preventDefault();
                }}
                onDrop={(e) => drop(e, stage.id)}
              >
                <div className="kanban-col-head">
                  <h3>{stage.short}</h3>
                  <span className="kanban-col-value">{formatCurrency(value)}</span>
                </div>
                <div className="kanban-col-sub">
                  {cards.length} deal{cards.length === 1 ? "" : "s"}
                </div>
                <div className="kanban-cards">
                  {cards.length === 0 ? (
                    <div className="kanban-empty">No deals here</div>
                  ) : (
                    cards.map((o) => (
                      <JobCard
                        key={o.id}
                        opp={o}
                        owner={byId.get(o.salespersonId) || byId.get(o.leadOwnerId) || (o.leadOwnerId === user.id ? user : null)}
                        userName={userName}
                        draggable={canMoveFrom(o.stage) && o.lifecycle === "Active" && nextStageFor(o.stage, unit) !== null}
                        dragging={draggingId === o.id}
                        onDragStart={() => setDraggingId(o.id)}
                        onDragEnd={() => setDraggingId(null)}
                        onOpen={() => navigate(`/opportunities/${o.id}`)}
                      />
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* One control for the whole board: a card's column depends on its stage,
          so the next page feeds every column at once rather than one of them. */}
      <LoadMore
        loaded={loaded}
        total={total}
        hasMore={hasMore}
        loading={loadingMore}
        onMore={loadMore}
        noun="opportunities"
      />
    </>
  );
}
