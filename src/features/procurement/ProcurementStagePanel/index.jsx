// Stage 6 on an opportunity: the same procurement workflow the procurement
// page shows, in the place people actually work a job. Looks the record up
// in the sample data by opportunity number until the purchase-order service
// is connected; a job with no procurement record yet says so and points at
// the procurement page rather than showing an empty panel.

import { Link } from "react-router-dom";
import { PackageSearch } from "lucide-react";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import ProcurementWorkflow from "@/features/procurement/ProcurementWorkflow";
import StageRequestsPanel from "@/features/collaboration/StageRequestsPanel";
import { PROCUREMENT_JOBS, PROCUREMENT_STAGE } from "@/lib/mockData/procurement";
import { stageById } from "@/constants/stages";

export default function ProcurementStagePanel({ opp, unit, canEdit = false }) {
  const stage = stageById(PROCUREMENT_STAGE.id);
  const slaDays = unit?.slaDays?.[stage.id];
  const job = PROCUREMENT_JOBS.find((candidate) => candidate.number === opp?.number) ?? null;

  return (
    <div className="card card-pad">
      <div className="card-head" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="card-icon">
            <PackageSearch size={16} />
          </span>
          {/* The registry calls stage 6 "Procurement"; the workflow is named for both halves. */}
          <h2>{PROCUREMENT_STAGE.label}</h2>
        </div>
        <Badge tone="neutral">Sample data</Badge>
      </div>
      <p className="sub">{stage.description}</p>
      {slaDays !== undefined ? (
        <p className="lede" style={{ marginBottom: 12 }}>
          SLA for this stage in {unit?.name}: {slaDays} day{Number(slaDays) === 1 ? "" : "s"}.
        </p>
      ) : null}

      {job ? (
        <ProcurementWorkflow job={job} embedded />
      ) : (
        <EmptyState
          icon={<PackageSearch size={26} strokeWidth={1.5} />}
          title="No procurement record for this job yet"
          body="Procurement records will appear here once the purchase-order service is connected. The sample jobs are on the procurement page."
          action={
            <Link to="/procurement" className="btn btn-ghost btn-sm">
              Open procurement
            </Link>
          }
        />
      )}

      <StageRequestsPanel opp={opp} stage={stage.id} unit={unit} canEdit={canEdit} />
    </div>
  );
}
