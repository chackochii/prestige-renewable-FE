// Stage 5 on an opportunity: the same approvals workflow the approvals page
// shows, where people work the job. Looks the record up in the sample data by
// opportunity number until the approvals service is connected; a job with no
// approvals record yet says so and points at the approvals page.

import { Link } from "react-router-dom";
import { SquareCheckBig } from "lucide-react";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import ApprovalWorkflow from "@/features/approvals/ApprovalWorkflow";
import StageRequestsPanel from "@/features/collaboration/StageRequestsPanel";
import { APPROVAL_JOBS, APPROVALS_STAGE } from "@/lib/mockData/approvals";
import { stageById } from "@/constants/stages";

export default function ApprovalsStagePanel({ opp, unit, canEdit = false }) {
  const stage = stageById(APPROVALS_STAGE.id);
  const job = APPROVAL_JOBS.find((candidate) => candidate.number === opp?.number) ?? null;

  return (
    <div className="card card-pad">
      <div className="card-head" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="card-icon">
            <SquareCheckBig size={16} />
          </span>
          <h2>{APPROVALS_STAGE.label}</h2>
        </div>
        <Badge tone="neutral">Sample data</Badge>
      </div>
      <p className="sub">{stage.description}</p>
      <p className="lede" style={{ marginBottom: 12 }}>
        Process timeline: same day or +{APPROVALS_STAGE.slaDays} day.
      </p>

      {job ? (
        <ApprovalWorkflow job={job} embedded />
      ) : (
        <EmptyState
          icon={<SquareCheckBig size={26} strokeWidth={1.5} />}
          title="No approvals record for this job yet"
          body="Approval records will appear here once the approvals service is connected. The sample jobs are on the approvals page."
          action={
            <Link to="/approvals" className="btn btn-ghost btn-sm">
              Open approvals
            </Link>
          }
        />
      )}

      <StageRequestsPanel opp={opp} stage={stage.id} unit={unit} canEdit={canEdit} />
    </div>
  );
}
