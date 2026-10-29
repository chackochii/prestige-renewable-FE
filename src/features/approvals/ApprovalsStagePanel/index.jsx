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
import { approvalAccess } from "@/helpers/approvals";
import { useNotifications } from "@/hooks/useNotifications";
import { advanceStage, updateLead } from "@/slices/leadsSlice";
import { useAppDispatch } from "@/store";

export default function ApprovalsStagePanel({ opp, unit, canEdit = false, onMoved }) {
  const stage = stageById(APPROVALS_STAGE.id);
  const { hasPermission, user } = useAuth();
  const dispatch = useAppDispatch();
  const { notify, error: notifyError } = useNotifications();
  // Send to Procurement (the confirmation, with the conditions reviewed, is the
  // workflow's): the job moves on, procurement is told, and the approvals are read again.
  const proceed = async ({ conditionsReviewed = false } = {}) => {
    try {
      await dispatch(advanceStage({ id: opp.id, body: { conditionsReviewed } })).unwrap();
      notify(`Sent to ${APPROVALS_STAGE.next.label}`);
      await reload();
      onMoved?.();
      return true;
    } catch (err) {
      notifyError(typeof err === "string" ? err : err?.message || "The job could not be sent yet.");
      return false;
    }
  };
  const canApprove = hasPermission(PERMISSIONS.APPROVALS_UPDATE);
  const [tab, setTab] = useState("approvals");
  const {
    job,
    status,
    error,
    saveError,
    dismissSaveError,
    reload,
    upload,
    updateChecklist,
    saveChecklist,
    checklistSaveState,
    updateItem,
    setRequired,
    addAddendum,
    reopen,
    markReviewed,
    resolve,
    hold,
    resume,
  } = useApprovalJob(opp?.id);
  // Who may send and reopen: the roles picked on Unit settings, or the role permissions.
  const access = approvalAccess(unit, user);
  const pause = async (call, done, failed) => {
    try {
      await call();
      notify(done);
      return true;
    } catch (err) {
      notifyError(typeof err === "string" ? err : err?.message || failed);
      return false;
    }
  };

  // RJ-01..05: resubmitting or changing approach stays here; returning the job or closing it moves the record.
  const DONE = {
    resubmit: "Resubmitted - the approval is back at Not Started",
    return_estimation: "Returned to Estimation",
    return_sales: "Returned to Sales",
    change_approach: "Approach changed - the new approval has been added",
    close_lost: "Job closed as lost",
  };
  const resolveRejection = async (type, body) => {
    try {
      await resolve(type, body);
      notify(DONE[body.option] ?? "Saved");
      if (["return_estimation", "return_sales", "close_lost"].includes(body.option)) onMoved?.();
      return true;
    } catch (err) {
      notifyError(typeof err === "string" ? err : err?.message || "The rejection could not be resolved.");
      return false;
    }
  };

  // Reopen Approvals: the job comes back to this stage, so the record is read again.
  const reopenApprovals = async (reason) => {
    try {
      await reopen(reason);
      notify("Approvals reopened - the job is back at Approvals");
      onMoved?.();
      return true;
    } catch (err) {
      notifyError(typeof err === "string" ? err : err?.message || "The approvals could not be reopened.");
      return false;
    }
  };

  /** A change to the job record from the finance approval, then the approvals read again. */
  const changeJob = async (body, done, failed) => {
    try {
      await dispatch(updateLead({ id: opp.id, body })).unwrap();
      notify(done);
      await reload();
      onMoved?.();
    } catch (err) {
      notifyError(typeof err === "string" ? err : err?.message || failed);
    }
  };
  // Not paying by finance any more: the finance approval stops applying.
  const changePaymentMethod = () => {
    if (window.confirm("Change the payment method from finance? The finance approval will no longer apply to this job."))
      changeJob({ financeAssistance: "no" }, "Payment method changed - finance no longer applies", "The payment method could not be changed.");
  };
  const notThereYet = Number(opp?.stage) < APPROVALS_STAGE.id;

  return (
    <div className="card card-pad">
      {/* No heading of its own - the tabs open the panel, with the stage's helper text under them. */}
      {notThereYet ? (
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
          <Badge tone="neutral">Not reached yet</Badge>
        </div>
      ) : null}
      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: "approvals", label: "Approvals", icon: <SquareCheckBig size={14} /> },
          { key: "requests", label: "Request / Response", icon: <HandHelping size={14} /> },
        ]}
      />

      {tab === "approvals" ? (
        <p className="sub" style={{ marginTop: 0 }}>
          {stage.description}
        </p>
      ) : null}

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
          onSaveChecklist={saveChecklist}
          checklistSaveState={checklistSaveState}
          onUpdateItem={async (type, body) => {
            const next = await updateItem(type, body);
            // The last approval moves the job on — the record is reloaded for the new stage.
            if (next && Number(next.stage) !== Number(opp.stage)) onMoved?.();
          }}
          onSetRequired={setRequired}
          onProceed={proceed}
          onUpload={upload}
          onAddAddendum={async (type, body) => {
            await addAddendum(type, body);
            notify("Added - logged in the history");
          }}
          canAddNotes={canApprove || hasPermission(PERMISSIONS.PROCUREMENT_UPDATE)}
          onReopen={reopenApprovals}
          canReopen={access.canReopen}
          onHold={(reason) => pause(() => hold(reason), "Job put On Hold", "The job could not be put on hold.")}
          onResume={() => pause(resume, "Job resumed", "The job could not be resumed.")}
          onMarkReviewed={markReviewed}
          onChangePaymentMethod={changePaymentMethod}
          onResolveRejection={resolveRejection}
          canProceed={access.canSend}
          saveError={saveError}
          onDismissSaveError={dismissSaveError}
        />
      )}
    </div>
  );
}
