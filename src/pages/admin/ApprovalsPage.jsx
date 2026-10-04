// Approvals (stage 5): the jobs waiting on their approvals — only the ones
// each job needs, as ticked by sales or estimation — and the Operations
// Coordinator's checklists for DNSP, DA and finance. Jobs come from
// prestige-be (approvalsSlice), 12 to a page with numbered pages below, the
// job that reached approvals most recently first; the stat cards count the
// whole board.

import { useEffect, useState } from "react";
import { AlarmClock, CircleCheck, CornerUpLeft, Hourglass, Search, SquareCheckBig } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import PageHeader from "@/components/PageHeader";
import Pagination from "@/components/Pagination";
import StatCard from "@/components/StatCard";
import ApprovalWorkflow from "@/features/approvals/ApprovalWorkflow";
import { APPROVALS_STAGE } from "@/constants/approvals";
import { PERMISSIONS } from "@/constants/permissions";
import { useApprovalJob } from "@/hooks/useApprovalJob";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePageParam } from "@/hooks/usePageParam";
import { PAGE_SIZE } from "@/helpers/pagination";
import { approvalItems, approvalOutcome, approvalStatus, itemStatus } from "@/helpers/approvals";
import { formatDate, slaStatus } from "@/helpers/dateTimeHelpers";
import { fetchApprovalsBoard } from "@/slices/approvalsSlice";
import { useAppDispatch, useAppSelector } from "@/store";
import { formatCurrency } from "@/utils/formatCurrency";

export default function ApprovalsPage() {
  const dispatch = useAppDispatch();
  const { unitId } = useBusinessUnit();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(PERMISSIONS.APPROVALS_UPDATE);
  const { board: rows, boardTotal, boardCounts, boardStatus, boardError } = useAppSelector((state) => state.approvals);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const term = useDebouncedValue(search.trim(), 300);
  const [page, setPage] = usePageParam(term);
  const boardKey = JSON.stringify(unitId ? { businessUnitId: unitId, search: term || undefined, page, pageSize: PAGE_SIZE } : null);
  const loading = boardStatus === "loading";

  useEffect(() => {
    const params = JSON.parse(boardKey);
    if (params) dispatch(fetchApprovalsBoard(params));
  }, [dispatch, boardKey]);

  // Counted by the API across the whole board, not just the page on screen.
  const counts = boardCounts ?? { pending: 0, approved: 0, rejected: 0, overdue: 0 };

  const selectedRow = rows.find((job) => job.id === selectedId) ?? rows[0] ?? null;
  // The board brought every job whole, so the selected one is already here:
  // this reads it from the slice and asks the API for nothing. A change comes
  // back as the whole job and lands on its board row too, so the last
  // approval moving the job on reads as "ready for procurement" at once.
  const { job: selected, status: jobStatus, error: jobError, updateChecklist, updateItem, setRequired } = useApprovalJob(selectedRow?.id);
  // The last approval moves the job on and the counts on the cards with it, so
  // the board is asked again — only then.
  const afterItem = async (type, body) => {
    const next = await updateItem(type, body);
    if (next && Number(next.stage) !== Number(selectedRow?.stage)) dispatch(fetchApprovalsBoard(JSON.parse(boardKey)));
    return next;
  };

  return (
    <>
      <PageHeader
        title={APPROVALS_STAGE.label}
        description="Only the approvals each job needs — DNSP, DA, finance and any other it was marked for — run side by side and worked through by the Operations Coordinator. When every one is in, the job moves to procurement by itself; if one is not given, it goes back to its salesperson."
      />

      <div className="stats">
        <StatCard label="Waiting on approvals" value={counts.pending} icon={<Hourglass size={14} />} hint="Still with an authority or lender" />
        <StatCard label="Ready for procurement" value={counts.approved} icon={<CircleCheck size={14} />} hint="Every approval received — last 30 days" />
        <StatCard label="Back with sales" value={counts.rejected} icon={<CornerUpLeft size={14} />} hint="An approval was not given" />
        <StatCard label="Past the timeline" value={counts.overdue} icon={<AlarmClock size={14} />} hint="Stage SLA from the unit settings" />
      </div>

      <Card
        title="Jobs in approvals"
        icon={<SquareCheckBig size={16} />}
        sub="Pick a job to work its approvals."
        actions={
          <div className="search-wrap" style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", opacity: 0.6 }} />
            <input className="search" style={{ paddingLeft: 30 }} placeholder="Search job, customer, suburb" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        }
      >
        {boardError ? <Alert tone="danger">{boardError}</Alert> : null}
        {loading && !rows.length ? (
          <LoadingState label="Loading approvals…" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<SquareCheckBig size={26} strokeWidth={1.5} />}
            title={term ? "Nothing matches" : "No jobs in approvals"}
            body={term ? "Try another search." : "Jobs arrive here when the customer accepts their proposal."}
          />
        ) : (
          <div className={`table-wrap${loading ? " is-refreshing" : ""}`}>
            <table className="table clickable">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Approvals</th>
                  <th>Timeline</th>
                  <th>Where it is</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((job) => {
                  const status = approvalStatus(job);
                  const sla = Number(job.stage) === APPROVALS_STAGE.id && approvalOutcome(job) === "pending" ? slaStatus(job.slaDueAt) : null;
                  const isSelected = job.id === selectedRow?.id;
                  return (
                    <tr key={job.id} className={isSelected ? "selected" : undefined} aria-selected={isSelected} onClick={() => setSelectedId(job.id)}>
                      <td>
                        <div className="row-title">{job.number}</div>
                        <div className="row-meta">
                          {job.customer}
                          {job.acceptedValue !== null && job.acceptedValue !== undefined ? ` · ${formatCurrency(job.acceptedValue)}` : ""}
                        </div>
                      </td>
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
                        {sla ? (
                          <Badge tone={sla.tone} title={job.slaDueAt ? `Due ${formatDate(job.slaDueAt, { withTime: true })}` : undefined}>
                            {sla.label}
                          </Badge>
                        ) : (
                          <span className="row-meta">{Number(job.stage) > APPROVALS_STAGE.id ? "Moved on" : "Decided"}</span>
                        )}
                      </td>
                      <td>
                        <Badge tone={status.tone}>{status.label}</Badge>
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

      {selectedRow ? (
        <div style={{ marginTop: 20 }}>
          {jobStatus === "failed" ? (
            <Alert tone="danger">{jobError || "The job's approvals could not be loaded."}</Alert>
          ) : selected ? (
            <ApprovalWorkflow job={selected} canEdit={canEdit} onChecklistChange={updateChecklist} onUpdateItem={afterItem} onSetRequired={setRequired} />
          ) : (
            <LoadingState label="Loading the job…" />
          )}
        </div>
      ) : null}
    </>
  );
}
