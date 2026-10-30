// Approvals (stage 5): the jobs waiting on their approvals — only the ones
// each job needs, as ticked by sales or estimation. Jobs come from
// prestige-be (approvalsSlice), 12 to a page with numbered pages below, the
// job that reached approvals most recently first. The summary cards count the
// whole board, and each filters the table to its jobs when clicked.

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AlarmClock, CircleCheck, CircleX, Hourglass, Search, SquareCheckBig } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import PageHeader from "@/components/PageHeader";
import Pagination from "@/components/Pagination";
import StatCard from "@/components/StatCard";
import { APPROVALS_STAGE } from "@/constants/approvals";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { usePageParam } from "@/hooks/usePageParam";
import { useUrlParam, useUrlSearch } from "@/hooks/useUrlParam";
import { PAGE_SIZE } from "@/helpers/pagination";
import { approvalItems, approvalProgress, approvalSla, approvalStatus, approvalTimers, idleFor, itemStatus, timeFlags, waitingOn } from "@/helpers/approvals";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { fetchApprovalsBoard } from "@/slices/approvalsSlice";
import { useAppDispatch, useAppSelector } from "@/store";
import { formatCurrency } from "@/utils/formatCurrency";

// The summary cards: each filters the table to its jobs (the API's `filter`); `count` is its key in the API's counts.
const CARDS = [
  { key: "in_progress", label: "In Progress", count: "pending", hint: "Waiting on an authority, lender or customer", icon: Hourglass },
  { key: "ready", label: "Ready for Procurement", count: "ready", hint: "Ready to send", hintTone: "success", icon: CircleCheck },
  { key: "rejected", label: "Rejected", count: "rejected", hint: "Needs a decision", hintTone: "danger", icon: CircleX },
  { key: "overdue", label: "Overdue", count: "overdue", hint: "Past the stage time limit", hintTone: "danger", icon: AlarmClock },
];

export default function ApprovalsPage() {
  const dispatch = useAppDispatch();
  const { unitId, unit } = useBusinessUnit();
  const timers = approvalTimers(unit);
  const { board: rows, boardTotal, boardCounts, boardStatus, boardError } = useAppSelector((state) => state.approvals);
  // The search, the card filter and the page live in the URL, so Back returns to the board as it was.
  const { search, setSearch, term } = useUrlSearch();
  const [filter, setFilter] = useUrlParam("filter");
  const navigate = useNavigate();
  const [page, setPage] = usePageParam(`${term}|${filter}`);
  const boardKey = JSON.stringify(
    unitId ? { businessUnitId: unitId, search: term || undefined, filter: filter || undefined, page, pageSize: PAGE_SIZE } : null,
  );
  const loading = boardStatus === "loading";

  useEffect(() => {
    const params = JSON.parse(boardKey);
    if (params) dispatch(fetchApprovalsBoard(params));
  }, [dispatch, boardKey]);

  // Counted by the API across the whole board, not just the page on screen.
  const counts = boardCounts ?? { pending: 0, ready: 0, rejected: 0, overdue: 0 };

  // A job opens on its own page, at the approvals stage — the whole record,
  // with the approvals worked there rather than under this list.
  const openJob = (job) => navigate(`/opportunities/${job.id}?stage=${APPROVALS_STAGE.id}`);

  return (
    <>
      <PageHeader title={APPROVALS_STAGE.label} description="Track the approvals each job needs. When all are complete, send the job to Procurement." />

      <div className="stats">
        {CARDS.map((card) => {
          const Icon = card.icon;
          return (
            <StatCard
              key={card.key}
              label={card.label}
              value={counts[card.count] ?? 0}
              icon={<Icon size={14} />}
              hint={card.hint}
              hintTone={card.hintTone}
              active={filter === card.key}
              onClick={() => setFilter(filter === card.key ? "" : card.key)}
            />
          );
        })}
      </div>

      <Card>
        <div className="table-toolbar">
          <div className="search-wrap" style={{ position: "relative", width: "calc(300px * var(--text-scale))", maxWidth: "100%" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", opacity: 0.6 }} />
            <input className="search" style={{ paddingLeft: 30, maxWidth: "none" }} placeholder="Search job, customer or approval" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          {filter ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFilter("")}>
              {CARDS.find((card) => card.key === filter)?.label ?? filter} only - show all
            </button>
          ) : null}
        </div>
        {boardError ? <Alert tone="danger">{boardError}</Alert> : null}
        {loading && !rows.length ? (
          <LoadingState label="Loading approvals…" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<SquareCheckBig size={26} strokeWidth={1.5} />}
            title={term || filter ? "Nothing matches" : "No jobs in approvals"}
            body={term || filter ? "Try another search, or show all jobs." : "Jobs arrive here when the customer accepts their proposal."}
          />
        ) : (
          <div className={`table-wrap${loading ? " is-refreshing" : ""}`}>
            <table className="table clickable">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Owner</th>
                  <th>Approvals</th>
                  <th>Progress</th>
                  <th>Waiting On</th>
                  <th>SLA</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((job) => {
                  const status = approvalStatus(job);
                  const progress = approvalProgress(job);
                  const sla = approvalSla(job);
                  const next = Number(job.stage) === APPROVALS_STAGE.id ? waitingOn(job) : null;
                  const idle = idleFor(job, timers);
                  const flagged = approvalItems(job).flatMap((item) => timeFlags(item, timers).map((flag) => `${item.short}: ${flag.label}`));
                  return (
                    <tr key={job.id} onClick={() => openJob(job)}>
                      <td>
                        <div className="row-title">{job.number}</div>
                        <div className="row-meta">
                          {job.customer}
                          {job.acceptedValue !== null && job.acceptedValue !== undefined ? ` · ${formatCurrency(job.acceptedValue)} inc GST` : ""}
                        </div>
                      </td>
                      <td>{job.salesperson?.name ?? <span className="row-meta">-</span>}</td>
                      <td>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {approvalItems(job).length ? (
                            approvalItems(job).map((item) => (
                              <Badge key={item.key} tone={itemStatus(item).tone} title={`${item.label}: ${itemStatus(item).label}`}>
                                {item.short}
                              </Badge>
                            ))
                          ) : (
                            <span className="row-meta">None required</span>
                          )}
                        </div>
                      </td>
                      <td>
                        {progress.total ? (
                          <>
                            <span className="row-meta">{progress.label}</span>
                            <span className="mini-progress" aria-hidden="true">
                              <i style={{ width: `${(progress.done / progress.total) * 100}%` }} />
                            </span>
                          </>
                        ) : (
                          <span className="row-meta">-</span>
                        )}
                      </td>
                      <td>
                        <span className="row-meta">{next ?? "-"}</span>
                        {flagged.map((line) => (
                          <div key={line} className="row-meta" style={{ color: "var(--warning)" }}>
                            {line}
                          </div>
                        ))}
                      </td>
                      <td>
                        {sla ? (
                          <Badge tone={sla.tone} title={job.slaDueAt ? `Due ${formatDate(job.slaDueAt, { withTime: true })}` : undefined}>
                            {sla.label}
                          </Badge>
                        ) : (
                          <span className="row-meta">-</span>
                        )}
                      </td>
                      <td>
                        <Badge tone={status.tone}>{status.label}</Badge>
                        {idle ? (
                          <div style={{ marginTop: 4 }}>
                            <Badge tone="warning">No activity {idle} days</Badge>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} total={boardTotal} onPageChange={setPage} noun="jobs" loading={loading} />
      </Card>
    </>
  );
}
