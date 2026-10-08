// Stage 5 on an opportunity: the same approvals workflow the approvals page
// shows — the job's required approvals, the coordinator's checklists and the
// job's answer — where people work the job, with the cross-department
// requests on their own tab. Before the job reaches the stage it shows what
// sales and estimation have marked as required.

import { useState } from "react";
import { HandHelping, SquareCheckBig } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import LoadingState from "@/components/LoadingState";
import Tabs from "@/components/Tabs";
import ApprovalWorkflow from "@/features/approvals/ApprovalWorkflow";
import StageRequestsPanel from "@/features/collaboration/StageRequestsPanel";
import { APPROVALS_STAGE } from "@/constants/approvals";
import { PERMISSIONS } from "@/constants/permissions";
import { stageById } from "@/constants/stages";
import { useApprovalJob } from "@/hooks/useApprovalJob";
import { useAuth } from "@/hooks/useAuth";
import { requiredApprovalsLabel } from "@/helpers/requiredApprovals";

export default function ApprovalsStagePanel({ opp, unit, canEdit = false, onMoved }) {
  const stage = stageById(APPROVALS_STAGE.id);
  const { hasPermission } = useAuth();
  const canApprove = hasPermission(PERMISSIONS.APPROVALS_UPDATE);
  const [tab, setTab] = useState("approvals");
  const { job, status, error, saveError, dismissSaveError, updateChecklist, updateItem, setRequired } = useApprovalJob(opp?.id);
  const notThereYet = Number(opp?.stage) < APPROVALS_STAGE.id;

  return (
    <div className="card card-pad">
      <div className="card-head" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="card-icon">
            <SquareCheckBig size={16} />
          </span>
          <h2>{APPROVALS_STAGE.label}</h2>
        </div>
        {notThereYet ? <Badge tone="neutral">Not reached yet</Badge> : null}
      </div>
      <p className="sub">{stage.description}</p>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: "approvals", label: "Approvals", icon: <SquareCheckBig size={14} /> },
          { key: "requests", label: "Request / Response", icon: <HandHelping size={14} /> },
        ]}
      />

      {tab === "requests" ? (
        <StageRequestsPanel opp={opp} stage={stage.id} unit={unit} canEdit={canEdit} />
      ) : notThereYet ? (
        <Alert tone="info">
          <strong>Approvals marked as required so far:</strong> {requiredApprovalsLabel(opp, unit, "none yet")}. Estimation marks them
          on the job; each one is tracked here once the customer accepts the proposal.
        </Alert>
      ) : status === "failed" ? (
        <Alert tone="danger">{error || "The job's approvals could not be loaded."}</Alert>
      ) : !job ? (
        <LoadingState label="Loading approvals…" />
      ) : (
        <ApprovalWorkflow
          job={job}
          canEdit={canApprove}
          embedded
          onChecklistChange={updateChecklist}
          onUpdateItem={async (type, body) => {
            const next = await updateItem(type, body);
            // The last approval moves the job on — the record is reloaded for the new stage.
            if (next && Number(next.stage) !== Number(opp.stage)) onMoved?.();
          }}
          onSetRequired={setRequired}
          saveError={saveError}
          onDismissSaveError={dismissSaveError}
        />
      )}
    </div>
  );
}
