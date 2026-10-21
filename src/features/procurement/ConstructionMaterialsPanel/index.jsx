// Construction's part of the procurement record: the material receipt (CL-14)
// and the job created in Green Deal (CL-10). They moved here from procurement,
// which now ends at the purchase order release — the materials arrive and the
// job is set up while the job is in construction, and both have to be done
// before it can leave construction (prestige-be constructionBlocker).
//
// The same record and the same checklists as the procurement panel — only
// these two tabs of it.

import { PackageCheck } from "lucide-react";
import Alert from "@/components/Alert";
import LoadingState from "@/components/LoadingState";
import ProcurementWorkflow from "@/features/procurement/ProcurementWorkflow";
import { PERMISSIONS } from "@/constants/permissions";
import { useAuth } from "@/hooks/useAuth";
import { useProcurementJob } from "@/hooks/useProcurementJob";

const CONSTRUCTION_TABS = ["receipt", "green_deal"];

export default function ConstructionMaterialsPanel({ opp }) {
  const { hasPermission } = useAuth();
  const procurement = useProcurementJob(opp?.id);

  return (
    <div className="card card-pad" style={{ marginBottom: 16 }}>
      <div className="card-head">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="card-icon">
            <PackageCheck size={16} />
          </span>
          <h2>Materials & job creation</h2>
        </div>
      </div>
      <p className="sub">
        Receive the materials ordered in procurement and create the job in Green Deal. Both are needed before the job can leave
        construction.
      </p>
      {procurement.status === "failed" && !procurement.job ? (
        <Alert tone="danger">{procurement.error || "The job's procurement record could not be loaded."}</Alert>
      ) : !procurement.job ? (
        <LoadingState label="Loading materials…" />
      ) : (
        <ProcurementWorkflow
          job={procurement.job}
          canEdit={hasPermission(PERMISSIONS.PROCUREMENT_UPDATE)}
          canApprove={hasPermission(PERMISSIONS.PROCUREMENT_APPROVE)}
          error={procurement.error}
          onClearError={procurement.clearError}
          onChecklistChange={procurement.updateChecklist}
          onSubmitChecklist={procurement.submitChecklist}
          onUpload={procurement.upload}
          onSaveBoq={procurement.saveBoq}
          onAddQuote={procurement.addQuote}
          onRemoveQuote={procurement.removeQuote}
          onCreatePurchaseOrder={procurement.createPurchaseOrder}
          onUpdatePurchaseOrder={procurement.updatePurchaseOrder}
          onDeletePurchaseOrder={procurement.deletePurchaseOrder}
          tabKeys={CONSTRUCTION_TABS}
          showSteps={false}
          embedded
        />
      )}
    </div>
  );
}
