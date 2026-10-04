// Procurement & delivery (stage 6): the jobs in this stage and each job's
// way through the BOQ → quotes → variation →
// approvals → orders and deliveries → Green Deal flow from the Sydpro process
// chart, with the Operations Coordinator's checklists for each step (CL-11
// to CL-14, then CL-10 job creation). Jobs come from prestige-be
// (procurementSlice), 12 to a page with numbered pages below, the job that
// reached procurement most recently first. Each job comes whole, so picking one
// asks the API for nothing; the stat cards count the whole board.

import { useEffect, useState } from "react";
import { BellRing, Leaf, PackageSearch, Search, Send } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import PageHeader from "@/components/PageHeader";
import Pagination from "@/components/Pagination";
import StatCard from "@/components/StatCard";
import ProcurementWorkflow from "@/features/procurement/ProcurementWorkflow";
import { PERMISSIONS } from "@/constants/permissions";
import { PROCUREMENT_STAGE } from "@/constants/procurement";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePageParam } from "@/hooks/usePageParam";
import { PAGE_SIZE } from "@/helpers/pagination";
import { useProcurementJob } from "@/hooks/useProcurementJob";
import { procurementStatus } from "@/helpers/procurement";
import { formatDate, slaStatus } from "@/helpers/dateTimeHelpers";
import { fetchProcurementBoard } from "@/slices/procurementSlice";
import { useAppDispatch, useAppSelector } from "@/store";
import { formatCurrency } from "@/utils/formatCurrency";

export default function ProcurementPage() {
  const dispatch = useAppDispatch();
  const { unitId } = useBusinessUnit();
  const { user, hasPermission } = useAuth();
  const { board: rows, boardTotal, boardCounts, boardStatus, boardError } = useAppSelector((state) => state.procurement);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState(null);
  const term = useDebouncedValue(search.trim(), 300);
  const [page, setPage] = usePageParam(term);
  const boardKey = JSON.stringify(unitId ? { businessUnitId: unitId, search: term || undefined, page, pageSize: PAGE_SIZE } : null);
  const loading = boardStatus === "loading";

  useEffect(() => {
    const params = JSON.parse(boardKey);
    if (params) dispatch(fetchProcurementBoard(params));
  }, [dispatch, boardKey]);

  // Counted by the API across the whole board, not just the page on screen.
  const counts = boardCounts ?? { inStage: 0, awaitingApproval: 0, purchaseOrders: 0, greenDeal: 0 };

  const selectedRow = rows.find((job) => job.id === selectedId) ?? rows[0] ?? null;
  // The board brought every job whole, so this reads the selected one from the slice.
  const procurement = useProcurementJob(selectedRow?.id);

  return (
    <>
      <PageHeader
        title={PROCUREMENT_STAGE.label}
        description="Check the bill of quantities against the site, confirm the supplier quote, clear any price variation with the right approvers, release the purchase orders and receive the materials, then create the Green Deal job for construction — each step through its checklist."
      />

      <div className="stats">
        <StatCard label="Jobs in procurement" value={counts.inStage} icon={<PackageSearch size={14} />} hint="At the stage now" />
        <StatCard label="Awaiting approval" value={counts.awaitingApproval} icon={<BellRing size={14} />} hint="Price variation needs sign-off" />
        <StatCard label="Purchase orders sent" value={counts.purchaseOrders} icon={<Send size={14} />} hint="Across every job on the board" />
        <StatCard label="Green Deal jobs" value={counts.greenDeal} icon={<Leaf size={14} />} hint={`Ready for ${PROCUREMENT_STAGE.next.label.toLowerCase()}`} />
      </div>

      <Card
        title="Jobs in procurement"
        icon={<PackageSearch size={16} />}
        sub="Pick a job to see where it is in the flow."
        actions={
          <div className="search-wrap" style={{ position: "relative" }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: 10,
                top: "50%",
                transform: "translateY(-50%)",
                opacity: 0.6,
              }}
            />
            <input className="search" style={{ paddingLeft: 30 }} placeholder="Search job, customer, suburb" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        }
      >
        {boardError ? <Alert tone="danger">{boardError}</Alert> : null}
        {loading && !rows.length ? (
          <LoadingState label="Loading procurement…" />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={<PackageSearch size={26} strokeWidth={1.5} />}
            title={term ? "Nothing matches" : "No jobs in procurement"}
            body={term ? "Try another search." : "Jobs arrive here when every approval is in; the BOQ comes across from the accepted quote."}
          />
        ) : (
          <div className={`table-wrap${loading ? " is-refreshing" : ""}`}>
            <table className="table clickable">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Entered</th>
                  <th>SLA</th>
                  <th>Value</th>
                  <th>Where it is</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((job) => {
                  const status = procurementStatus(job);
                  const atThisStage = Number(job.stage) === PROCUREMENT_STAGE.id;
                  const sla = atThisStage ? slaStatus(job.slaDueAt) : null;
                  const isSelected = job.id === selectedRow?.id;
                  return (
                    <tr key={job.id} className={isSelected ? "selected" : undefined} aria-selected={isSelected} onClick={() => setSelectedId(job.id)}>
                      <td>
                        <div className="row-title">{job.number}</div>
                        <div className="row-meta">{job.customer}</div>
                      </td>
                      <td>{job.enteredAt ? formatDate(job.enteredAt) : "—"}</td>
                      <td>
                        {sla ? (
                          <Badge tone={sla.tone} title={job.slaDueAt ? `Due ${formatDate(job.slaDueAt)}` : undefined}>
                            {sla.label}
                          </Badge>
                        ) : (
                          <span className="row-meta">Moved on</span>
                        )}
                      </td>
                      <td>{job.acceptedValue !== null && job.acceptedValue !== undefined ? formatCurrency(job.acceptedValue) : "—"}</td>
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
          {procurement.status === "failed" && !procurement.job ? (
            <Alert tone="danger">{procurement.error || "The job's procurement record could not be loaded."}</Alert>
          ) : procurement.job ? (
            <ProcurementWorkflow
              job={procurement.job}
              canEdit={hasPermission(PERMISSIONS.PROCUREMENT_UPDATE)}
              canApprove={hasPermission(PERMISSIONS.PROCUREMENT_APPROVE)}
              user={user}
              error={procurement.error}
              onClearError={procurement.clearError}
              onChecklistChange={procurement.updateChecklist}
              onUpload={procurement.upload}
              onSaveBoq={procurement.saveBoq}
              onAddQuote={procurement.addQuote}
              onRemoveQuote={procurement.removeQuote}
              onCreatePurchaseOrder={procurement.createPurchaseOrder}
              onUpdatePurchaseOrder={procurement.updatePurchaseOrder}
              onDeletePurchaseOrder={procurement.deletePurchaseOrder}
              onDecide={procurement.decide}
            />
          ) : (
            <LoadingState label="Loading the job…" />
          )}
        </div>
      ) : null}
    </>
  );
}
