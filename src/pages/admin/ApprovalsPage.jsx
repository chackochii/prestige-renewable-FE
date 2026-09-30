// Approvals (stage 5): the jobs waiting on DA, DNSP, finance and additional
// approvals, the Operations Coordinator's checklists for each (CL-07 DNSP,
// CL-08 DA, CL-09 finance), the rules the stage runs on, the team, and each
// job's way through the "All approved?" gate from the Sydpro process chart.
//
// Reads hardcoded records from lib/mockData/approvals.js until the approvals
// service is connected; the panels take a job record, so the swap is in this
// file, not in them. Checklist answers are kept in the approvals slice.

import { useMemo, useState } from "react";
import { AlarmClock, CircleCheck, CornerUpLeft, Hourglass, SquareCheckBig } from "lucide-react";
import Badge from "@/components/Badge";
import Card from "@/components/Card";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import ApprovalRules from "@/features/approvals/ApprovalRules";
import ApprovalWorkflow from "@/features/approvals/ApprovalWorkflow";
import ProcurementTeam from "@/features/procurement/ProcurementTeam";
import { PERMISSIONS } from "@/constants/permissions";
import { useApprovalChecklists } from "@/hooks/useApprovalChecklists";
import { useAuth } from "@/hooks/useAuth";
import { APPROVAL_JOBS, APPROVALS_STAGE } from "@/lib/mockData/approvals";
import { approvalItems, approvalOutcome, approvalStatus, isOverdue, itemStatus } from "@/helpers/approvals";
import { formatDate, slaStatus } from "@/helpers/dateTimeHelpers";
import { formatCurrency } from "@/utils/formatCurrency";

export default function ApprovalsPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(PERMISSIONS.APPROVALS_UPDATE);
  const { jobs, update } = useApprovalChecklists(APPROVAL_JOBS);
  const [selectedId, setSelectedId] = useState(jobs[0]?.id ?? null);
  const selected = jobs.find((job) => job.id === selectedId) ?? jobs[0] ?? null;

  const counts = useMemo(
    () => ({
      pending: jobs.filter((job) => approvalOutcome(job) === "pending").length,
      approved: jobs.filter((job) => approvalOutcome(job) === "approved").length,
      rejected: jobs.filter((job) => approvalOutcome(job) === "rejected").length,
      overdue: jobs.filter((job) => isOverdue(job)).length,
    }),
    [jobs],
  );

  return (
    <>
      <PageHeader
        title={APPROVALS_STAGE.label}
        description="DA, DNSP, finance and any additional approvals, run side by side — each worked through its checklist by the Operations Coordinator. When every one is in, the job moves to procurement; if one is not given, it goes back to its salesperson."
        actions={<Badge tone="neutral">Sample data — approvals service not connected</Badge>}
      />

      <div className="stats">
        <StatCard label="Waiting on approvals" value={counts.pending} icon={<Hourglass size={14} />} hint="Still with an authority or lender" />
        <StatCard label="Ready for procurement" value={counts.approved} icon={<CircleCheck size={14} />} hint="Every approval received" />
        <StatCard label="Assigned back to sales" value={counts.rejected} icon={<CornerUpLeft size={14} />} hint="An approval was not given" />
        <StatCard label="Past the timeline" value={counts.overdue} icon={<AlarmClock size={14} />} hint={`Same day or +${APPROVALS_STAGE.slaDays} day`} />
      </div>

      <Card title="Jobs in approvals" icon={<SquareCheckBig size={16} />} sub="Pick a job to see its approvals.">
        <div className="table-wrap">
          <table className="table clickable">
            <thead>
              <tr>
                <th>Job</th>
                <th>DA</th>
                <th>DNSP</th>
                <th>Finance</th>
                <th>Additional</th>
                <th>Timeline</th>
                <th>Where it is</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job) => {
                const status = approvalStatus(job);
                const sla = approvalOutcome(job) === "pending" ? slaStatus(job.slaDueAt) : null;
                const isSelected = job.id === selected?.id;
                return (
                  <tr
                    key={job.id}
                    className={isSelected ? "selected" : undefined}
                    aria-selected={isSelected}
                    onClick={() => setSelectedId(job.id)}
                  >
                    <td>
                      <div className="row-title">{job.number}</div>
                      <div className="row-meta">
                        {job.customer} · {formatCurrency(job.acceptedValue)}
                      </div>
                    </td>
                    {approvalItems(job).map((item) => (
                      <td key={item.key}>
                        {item.applicable ? (
                          <Badge tone={itemStatus(item).tone}>{itemStatus(item).label}</Badge>
                        ) : (
                          <span className="row-meta">—</span>
                        )}
                      </td>
                    ))}
                    <td>
                      {sla ? (
                        <Badge tone={sla.tone} title={`Due ${formatDate(job.slaDueAt, { withTime: true })}`}>
                          {sla.label}
                        </Badge>
                      ) : (
                        <span className="row-meta">Decided</span>
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
      </Card>

      <div style={{ marginTop: 20 }}>
        <ApprovalWorkflow job={selected} canEdit={canEdit} onChecklistChange={(sectionKey, patch) => update(selected, sectionKey, patch)} />
      </div>

      <div className="grid-2" style={{ marginTop: 20 }}>
        <ApprovalRules job={selected} />
        <ProcurementTeam />
      </div>
    </>
  );
}
