// Pipeline: the same records two ways.
//
// The list is the default — it is the one that reads at a glance, sorts, and
// takes filters without hiding anything behind a column. The board is there
// for the work the list is bad at: seeing where everything sits, and dragging
// a job into the next stage.
//
// The view, the search, every filter and the page all live in the URL, so a
// filtered board or list is a link somebody can send — and Back from a job
// returns to the list as it was. The list shows 12 jobs a page with numbered
// pages below, newest first; every filter is applied by the API across the
// whole pipeline. The board shows the newest 200.

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
import Pagination from "@/components/Pagination";
import { oppTitle, oppValue } from "@/helpers/opportunity";
import { enabledStagesFor, nextStageFor, stageById } from "@/constants/stages";
import { PERMISSIONS } from "@/constants/permissions";
import { canAdvanceFrom, canViewStage, viewableStages } from "@/helpers/stageAccess";
import { createdById, jobStatus, JOB_STATUS_OPTIONS } from "@/helpers/jobStatus";

/** The board has no pages: it shows this many of the newest jobs, every column at once. */
const BOARD_LIMIT = 200;
import { formatDate, slaStatus } from "@/helpers/dateTimeHelpers";
import { formatCurrency } from "@/utils/formatCurrency";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { useOpportunities } from "@/hooks/useOpportunities";
import { usePageParam } from "@/hooks/usePageParam";
import { useSearchParamWriter } from "@/hooks/useSearchParamWriter";
import { useUrlSearch } from "@/hooks/useUrlParam";
import { PAGE_SIZE } from "@/helpers/pagination";
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
  const [params] = useSearchParams();
  const writeParams = useSearchParamWriter();
  const { search, setSearch, term: settledSearch } = useUrlSearch();
  const [draggingId, setDraggingId] = useState(null);

  // A ?stage= pointing at a stage this person cannot see is ignored rather than
  // obeyed — a stale link or a bookmark should show their board, not nothing.
  const requestedStage = params.get("stage") || "";
  const stageFilter = requestedStage && canViewStage(user, requestedStage) ? requestedStage : "";
  const lifecycle = params.get("life") || "Active";
  const view = params.get("view") === "board" ? "board" : "list";
  const ownerId = params.get("owner") || "";
  const authorId = params.get("author") || "";
  const statusKey = params.get("status") || "";
  // Every filter is applied by the API, not in the browser: with only one page
  // of the pipeline loaded, filtering here would silently miss the rest.
  const filters = {
    ...(lifecycle === "all" ? {} : { lifecycle }),
    ...(settledSearch ? { search: settledSearch } : {}),
    ...(ownerId ? { ownerId } : {}),
    ...(authorId ? { authorId } : {}),
    ...(statusKey ? { status: statusKey } : {}),
    ...(stageFilter ? { stage: stageFilter } : {}),
  };
  const [page, setPage] = usePageParam(JSON.stringify(filters));
  const { items, error, ready, loading, reload, total } = useOpportunities(filters, {
    page: view === "board" ? 1 : page,
    pageSize: view === "board" ? BOARD_LIMIT : PAGE_SIZE,
  });

  /** One filter or the view, keeping the others; a history step, so Back undoes it. */
  const setParam = (key, value) =>
    writeParams(
      (next) => {
        if (value) next.set(key, value);
        else next.delete(key);
      },
      { replace: false },
    );

  // Stages this unit runs, narrowed to the ones this person may see. A stage
  // their role does not cover gets no column and no cards — the API filters the
  // records out too, so an empty column would be misleading rather than honest.
  const stages = useMemo(() => viewableStages(user, enabledStagesFor(unit)), [unit, user]);
  // Moving a card is per stage, not one permission for the whole board: the
  // stage being left decides (see helpers/stageAccess). Someone may own
  // Estimation and nothing else, so only those cards are draggable for them.
  // Approvals is left with Send to Procurement on the job (conditions reviewed, confirmed), not by dragging.
  const canMoveFrom = useCallback((stage) => Number(stage) !== 5 && canAdvanceFrom(user, stage), [user]);

  // The API filters and orders them, newest first.
  const rows = items;

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
      notify(`Can't move yet - ${typeof err === "string" ? err : err?.message}`, "danger");
    }
  };

  const ownerOptions = sales.length ? sales : users;
  const filtered = Boolean(stageFilter || ownerId || authorId || statusKey || search);

  // Every filter in one write — written one after another, each used to
  // overwrite the last, and only one of them actually cleared.
  const clearFilters = () => {
    setSearch("");
    writeParams(
      (next) => {
        for (const key of ["q", "stage", "owner", "author", "status"]) next.delete(key);
      },
      { replace: false },
    );
  };

  return (
    <>
      <PageHeader
        title="Jobs Board"
        // The board speaks for itself; the list says how many there are.
        description={view === "board" ? undefined : ready ? `${total} opportunit${total === 1 ? "y" : "ies"}.` : "Loading the pipeline…"}
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
          onChange={(e) => setParam("status", e.target.value)}
          aria-label="Status filter"
        >
          <option value="">All statuses</option>
          {JOB_STATUS_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        <select className="select" value={ownerId} onChange={(e) => setParam("owner", e.target.value)} aria-label="Owner filter">
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
          onChange={(e) => setParam("author", e.target.value)}
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

      {(loading && !rows.length) || (ready && !rows.length && total > 0) ? (
        // A page past the end (the list shrank since) has no rows but a total:
        // the pager moves it back to the last page rather than this saying
        // there is nothing to show.
        <div className="card card-pad">
          <LoadingState label="Loading pipeline…" />
          {view === "list" ? <Pagination page={page} total={total} onPageChange={setPage} noun="opportunities" loading={loading} /> : null}
        </div>
      ) : ready && rows.length === 0 ? (
        <div className="card card-pad">
          <EmptyState
            title="Nothing to show"
            body={filtered ? "No job matches these filters." : "Capture a new lead to get started."}
          />
        </div>
      ) : view === "list" ? (
        <div className="card card-pad">
          <div className={`table-wrap${loading ? " is-refreshing" : ""}`}>
            <table className="table clickable stack">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Stage</th>
                  <th>Status</th>
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
                          "-"
                        )}
                      </td>
                      <td data-label="Owner">{userName(o.salespersonId || o.leadOwnerId) || "-"}</td>
                      <td data-label="Created by">{userName(createdById(o)) || "-"}</td>
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
          <Pagination page={page} total={total} onPageChange={setPage} noun="opportunities" loading={loading} />
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

      {view === "board" && total > rows.length ? (
        <p className="row-meta" style={{ marginTop: 10 }}>
          Showing the newest {rows.length} of {total} opportunities. Narrow the filters, or use the list to page through them all.
        </p>
      ) : null}
    </>
  );
}
