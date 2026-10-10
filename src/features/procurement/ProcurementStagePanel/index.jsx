// Stage 6 on an opportunity: the same procurement workflow the procurement
// page shows — the records, the coordinator's checklists and the Green Deal
// job — in the place people actually work a job. Before the job reaches the
// stage it says what will happen when it does.

import { PackageSearch } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import LoadingState from "@/components/LoadingState";
import ProcurementWorkflow from "@/features/procurement/ProcurementWorkflow";
import StageRequestsPanel from "@/features/collaboration/StageRequestsPanel";
import { PERMISSIONS } from "@/constants/permissions";
import { PROCUREMENT_STAGE } from "@/constants/procurement";
import { stageById } from "@/constants/stages";
import { useAuth } from "@/hooks/useAuth";
import { useProcurementJob } from "@/hooks/useProcurementJob";

export default function ProcurementStagePanel({ opp, unit, canEdit = false }) {
  const stage = stageById(PROCUREMENT_STAGE.id);
  const requests = <StageRequestsPanel opp={opp} stage={stage.id} unit={unit} canEdit={canEdit} />;
  const slaDays = unit?.slaDays?.[stage.id];
  const { hasPermission } = useAuth();
  const notThereYet = Number(opp?.stage) < PROCUREMENT_STAGE.id;
  const procurement = useProcurementJob(opp?.id, { enabled: !notThereYet });

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
        {notThereYet ? <Badge tone="neutral">Not reached yet</Badge> : null}
      </div>
      <p className="sub">{stage.description}</p>
      {slaDays !== undefined ? (
        <p className="lede" style={{ marginBottom: 12 }}>
          SLA for this stage in {unit?.name}: {slaDays} day{Number(slaDays) === 1 ? "" : "s"}.
        </p>
      ) : null}

      {notThereYet ? (
        <Alert tone="info">
          Procurement opens when every approval is in. The bill of quantities comes across from the accepted quote, and the
          Operations Coordinator works it through the BOQ, supplier quote, PO release, material receipt and job creation checklists here.
        </Alert>
      ) : procurement.status === "failed" && !procurement.job ? (
        <Alert tone="danger">{procurement.error || "The job's procurement record could not be loaded."}</Alert>
      ) : !procurement.job ? (
        <LoadingState label="Loading procurement…" />
      ) : (
        <ProcurementWorkflow
          job={procurement.job}
          canEdit={hasPermission(PERMISSIONS.PROCUREMENT_UPDATE)}
          canApprove={hasPermission(PERMISSIONS.PROCUREMENT_APPROVE)}
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
          requests={requests}
          embedded
        />
      )}

      {/* Until the workflow (and its Request / Response tab) is on screen, the requests sit below. */}
      {notThereYet || !procurement.job ? requests : null}
    </div>
  );
}
