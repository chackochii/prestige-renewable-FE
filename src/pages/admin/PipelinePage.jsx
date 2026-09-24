// Pipeline board: one column per stage the business unit runs.

import { useCallback, useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { X } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import Alert from "@/components/Alert";
import JobCard from "@/components/JobCard";
import { oppTitle, oppValue } from "@/helpers/opportunity";
import { enabledStagesFor, nextStageFor, stageById } from "@/constants/stages";
import { PERMISSIONS } from "@/constants/permissions";
import { advanceableStages, canAdvanceFrom, canViewStage, viewableStages } from "@/helpers/stageAccess";
import { formatCurrency } from "@/utils/formatCurrency";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
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
  { value: "all", label: "All statuses" },
];

export default function PipelinePage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { unit } = useBusinessUnit();
  const { users, sales, byId } = useUnitUsers();
  const { notify } = useNotifications();
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState("");
  const [ownerId, setOwnerId] = useState("");
  const [draggingId, setDraggingId] = useState(null);

  // A ?stage= pointing at a stage this person cannot see is ignored rather than
  // obeyed — a stale link or a bookmark should show their board, not nothing.
  const requestedStage = params.get("stage") || "";
  const stageFilter = requestedStage && canViewStage(user, requestedStage) ? requestedStage : "";
  const lifecycle = params.get("life") || "Active";
  const { items, status, error, ready, reload } = useOpportunities(lifecycle === "all" ? {} : { lifecycle });

  // Stages this unit runs, narrowed to the ones this person may see. A stage
  // their role does not cover gets no column and no cards — the API filters the
  // records out too, so an empty column would be misleading rather than honest.
  const stages = useMemo(() => viewableStages(user, enabledStagesFor(unit)), [unit, user]);
  // Moving a card is per stage, not one permission for the whole board: the
  // stage being left decides (see helpers/stageAccess). Someone may own
  // Estimation and nothing else, so only those cards are draggable for them.
  const canMoveFrom = useCallback((stage) => canAdvanceFrom(user, stage), [user]);
  const movableStages = useMemo(() => advanceableStages(user, stages), [user, stages]);

  const rows = useMemo(
    () =>
      items
        .filter((o) => (stageFilter ? String(o.stage) === stageFilter : true))
        .filter((o) => (ownerId ? String(o.salespersonId || o.leadOwnerId) === ownerId : true))
        .filter((o) =>
          `${o.number || ""} ${o.customerLegalName || ""} ${o.customerTradingName || ""} ${o.siteSuburb || ""}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    [items, stageFilter, ownerId, search],
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

  return (
    <>
      <PageHeader
        title="Pipeline"
        description={
          ready
            ? `${rows.length} opportunit${rows.length === 1 ? "y" : "ies"} weighted at ${formatCurrency(totalValue)}.${
                movableStages.length
                  ? ` Drag a card to move it into the next stage — you can move ${movableStages.map((s) => s.short).join(", ")}.`
                  : ""
              }`
            : "Loading the board…"
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
          value={lifecycle}
          onChange={(e) => setParams(stageFilter ? { stage: stageFilter, life: e.target.value } : { life: e.target.value })}
          aria-label="Status filter"
        >
          {LIFECYCLE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        {stageFilter ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setParams({ life: lifecycle })}>
            <X size={14} /> Clear stage filter
          </button>
        ) : null}
        <button type="button" className="btn btn-ghost btn-sm" onClick={reload} style={{ marginLeft: "auto" }}>
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
          <EmptyState title="Nothing to show" body="Try another filter, or capture a new lead." />
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
    </>
  );
}
