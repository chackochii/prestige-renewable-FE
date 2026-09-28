// Procurement & delivery (stage 6): the jobs in this stage, the team that
// runs it, and each job's way through the BOQ → quotes → variation →
// approvals → Green Deal flow from the Sydpro process chart.
//
// Reads hardcoded records from lib/mockData/procurement.js until the
// purchase-order service is connected; the panels take a job record, so the
// swap is in this file, not in them.

import { useMemo, useState } from "react";
import { BellRing, Leaf, PackageSearch, Send } from "lucide-react";
import Badge from "@/components/Badge";
import Card from "@/components/Card";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import ProcurementTeam from "@/features/procurement/ProcurementTeam";
import ProcurementWorkflow from "@/features/procurement/ProcurementWorkflow";
import { PROCUREMENT_JOBS, PROCUREMENT_STAGE } from "@/lib/mockData/procurement";
import { currentStep, greenDealCreated, procurementStatus, sentOrders } from "@/helpers/procurement";
import { formatDate, slaStatus } from "@/helpers/dateTimeHelpers";
import { formatCurrency } from "@/utils/formatCurrency";

export default function ProcurementPage() {
  const jobs = PROCUREMENT_JOBS;
  const [selectedId, setSelectedId] = useState(jobs[0]?.id ?? null);
  const selected = jobs.find((job) => job.id === selectedId) ?? jobs[0] ?? null;

  const counts = useMemo(
    () => ({
      inStage: jobs.length,
      awaitingApproval: jobs.filter((job) => currentStep(job) === "approvals").length,
      purchaseOrders: jobs.reduce((sum, job) => sum + sentOrders(job).length, 0),
      greenDeal: jobs.filter(greenDealCreated).length,
    }),
    [jobs],
  );

  return (
    <>
      <PageHeader
        title={PROCUREMENT_STAGE.label}
        description="Verify the bill of quantities against the site, get quotes, clear any price variation with the right approvers, then raise the Green Deal job for construction."
        actions={<Badge tone="neutral">Sample data — purchase-order service not connected</Badge>}
      />

      <div className="stats">
        <StatCard label="Jobs in procurement" value={counts.inStage} icon={<PackageSearch size={14} />} hint="Stage 6 of 9" />
        <StatCard
          label="Awaiting approval"
          value={counts.awaitingApproval}
          icon={<BellRing size={14} />}
          hint="Price variation needs sign-off"
        />
        <StatCard label="Purchase orders sent" value={counts.purchaseOrders} icon={<Send size={14} />} hint="Across all jobs in stage" />
        <StatCard
          label="Green Deal jobs"
          value={counts.greenDeal}
          icon={<Leaf size={14} />}
          hint={`Ready for ${PROCUREMENT_STAGE.next.label.toLowerCase()}`}
        />
      </div>

      <div className="grid-2">
        <Card title="Jobs in procurement" icon={<PackageSearch size={16} />} sub="Pick a job to see where it is in the flow.">
          <div className="table-wrap">
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
                {jobs.map((job) => {
                  const status = procurementStatus(job);
                  const sla = slaStatus(job.slaDueAt);
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
                        <div className="row-meta">{job.customer}</div>
                      </td>
                      <td>{formatDate(job.enteredAt)}</td>
                      <td>
                        <Badge tone={sla.tone} title={job.slaDueAt ? `Due ${formatDate(job.slaDueAt)}` : undefined}>
                          {sla.label}
                        </Badge>
                      </td>
                      <td>{formatCurrency(job.acceptedValue)}</td>
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

        <ProcurementTeam />
      </div>

      <div style={{ marginTop: 20 }}>
        <ProcurementWorkflow job={selected} />
      </div>
    </>
  );
}
