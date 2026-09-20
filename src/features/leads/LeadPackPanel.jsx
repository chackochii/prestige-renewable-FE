// Stage-1 work: the lead pack, editable while the record lives.

import { useEffect, useState } from "react";
import { ClipboardCheck, Pencil } from "lucide-react";
import Alert from "@/components/Alert";
import Modal from "@/components/Modal";
import LeadForm from "@/features/leads/LeadForm";
import RequestDetail from "@/features/collaboration/RequestDetail";
import RequestFormModal from "@/features/collaboration/RequestFormModal";
import StageRequestsPanel from "@/features/collaboration/StageRequestsPanel";
import { formToPayload, idOrNull, leadToForm, validateLeadForm } from "@/features/leads/leadFormModel";
import { DRAWING_CATEGORY, SITE_PHOTO_CATEGORY } from "@/constants/estimationInput";
import { leadCompletenessItems, leadGateItems } from "@/helpers/stageTransition";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  addOpportunityHistoryEntry,
  assignEstimator,
  assignSalesperson,
  fetchOpportunityAttachments,
  notifyEstimator,
  updateLead,
  uploadOpportunityAttachment,
} from "@/slices/leadsSlice";
import { fetchReferrers } from "@/slices/referralsSlice";
import { createRequest, fetchOpportunityRequests } from "@/slices/collaborationSlice";
import { useUnitUsers } from "@/hooks/useUnitUsers";
import { formatDate as formatWhen } from "@/helpers/dateTimeHelpers";
import { useNotifications } from "@/hooks/useNotifications";

/** Everything raised from the lead pack is filed against stage 1. */
const LEAD_STAGE = 1;

export default function LeadPackPanel({ opp, unit, canEdit }) {
  const dispatch = useAppDispatch();
  const { estimators, sales, siteOps, userName } = useUnitUsers();
  const referrers = useAppSelector((s) => s.referrals.items);
  const { oppId: collabOppId, byOpp: requests } = useAppSelector((s) => s.collaboration);
  const referrersStatus = useAppSelector((s) => s.referrals.status);
  const attachments = useAppSelector((s) => s.leads.attachments);
  const { notify, error: notifyError } = useNotifications();
  const [form, setForm] = useState(() => leadToForm(opp));
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingBills, setUploadingBills] = useState(false);
  const [uploadingCategory, setUploadingCategory] = useState(null);
  const [requestingInspection, setRequestingInspection] = useState(false);
  const [viewingInspection, setViewingInspection] = useState(null);
  // A saved lead opens read-only; the pencil unlocks it. Once it is with an
  // estimator, unlocking asks first — editing under them is a real event.
  const [editing, setEditing] = useState(false);
  const [confirmEdit, setConfirmEdit] = useState(false);

  // A fresh record (after fetch or save) replaces any unsaved edits.
  useEffect(() => {
    setForm(leadToForm(opp));
    setErrors({});
    setEditing(false);
  }, [opp]);

  useEffect(() => {
    if (referrersStatus === "idle") dispatch(fetchReferrers({ status: "active" }));
  }, [referrersStatus, dispatch]);

  useEffect(() => {
    if (opp?.id) dispatch(fetchOpportunityAttachments(opp.id));
  }, [opp?.id, dispatch]);

  useEffect(() => {
    if (opp?.id) dispatch(fetchOpportunityRequests(opp.id));
  }, [opp?.id, dispatch]);

  // The pre-site inspection row tracks the operations assignment raised for it.
  const inspection =
    collabOppId === Number(opp?.id)
      ? requests.find((r) => r.kind === "assignment" && r.department === "operations" && r.status !== "cancelled")
      : null;

  /** Opens the existing inspection, or starts a new request when there is none. */
  const handleInspection = (existing) => {
    if (existing) setViewingInspection(existing);
    else setRequestingInspection(true);
  };

  const billFiles = attachments.filter((a) => a.category === "bill");
  const drawings = attachments.filter((a) => a.category === DRAWING_CATEGORY);
  const sitePhotos = attachments.filter((a) => a.category === SITE_PHOTO_CATEGORY);

  const uploadCategory = (category) => async (files) => {
    setUploadingCategory(category);
    try {
      for (const file of files) {
        await dispatch(uploadOpportunityAttachment({ id: opp.id, category, file })).unwrap();
      }
    } catch (err) {
      notifyError(typeof err === "string" ? err : err?.message || "Could not upload the file.");
    } finally {
      setUploadingCategory(null);
    }
  };

  const uploadBills = async (files) => {
    setUploadingBills(true);
    try {
      for (const file of files) {
        await dispatch(uploadOpportunityAttachment({ id: opp.id, category: "bill", file })).unwrap();
      }
    } catch (err) {
      notifyError(typeof err === "string" ? err : err?.message || "Could not upload the file.");
    } finally {
      setUploadingBills(false);
    }
  };

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => {
      if (!e[field]) return e;
      const next = { ...e };
      delete next[field];
      return next;
    });
  };

  const save = async () => {
    const found = validateLeadForm(form);
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    // Baseline before this save — used to work out what's actually new,
    // so re-saving never re-writes the same job-history entry twice.
    const previousAttemptCount = (opp.contactAttempts || []).length;
    setSaving(true);
    setSaveError("");
    try {
      await dispatch(
        updateLead({
          id: opp.id,
          // The stamp is what the estimation screen reads to know the pack
          // moved under it; it is cleared when the estimator acknowledges.
          body: handedOver
            ? { ...formToPayload(form), leadEditedAt: new Date().toISOString() }
            : formToPayload(form),
        }),
      ).unwrap();

      // Every attempt where the client wasn't reached must have its reason
      // recorded in Job History — write one entry per new attempt only.
      const newAttempts = form.contactAttempts.slice(previousAttemptCount);
      for (const attempt of newAttempts.filter((a) => a.reached === false)) {
        await dispatch(
          addOpportunityHistoryEntry({
            id: opp.id,
            body: {
              note: `Client not contacted (${attempt.method}, ${formatDate(attempt.contactedAt)}) — ${attempt.reason}`,
            },
          }),
        ).unwrap();
      }

      // Assignment fields are their own audited actions, not part of the
      // generic PATCH — only call each endpoint when that assignment
      // actually changed.
      const newSalespersonId = idOrNull(form.salespersonId);
      if (newSalespersonId !== (opp.salespersonId ?? null)) {
        await dispatch(
          assignSalesperson({
            id: opp.id,
            body: { salespersonId: newSalespersonId, reason: newSalespersonId ? undefined : form.unassignedReason.trim() },
          }),
        ).unwrap();
        if (!newSalespersonId) {
          await dispatch(
            addOpportunityHistoryEntry({
              id: opp.id,
              body: { note: `Lead left unassigned — ${form.unassignedReason.trim()}` },
            }),
          ).unwrap();
        }
      }

      if (form.potential === "yes") {
        const newEstimatorId = idOrNull(form.estimatorId);
        if (newEstimatorId && newEstimatorId !== (opp.estimatorId ?? null)) {
          await dispatch(assignEstimator({ id: opp.id, body: { estimatorId: newEstimatorId } })).unwrap();
        }
      }

      // Sales edited a lead that is already with an estimator — tell them,
      // and leave a trail on the job.
      if (handedOver) {
        try {
          await dispatch(
            notifyEstimator({ id: opp.id, body: { summary: "Lead details were updated after handover." } }),
          ).unwrap();
        } catch {
          notify("Lead saved, but the estimator could not be notified.", "danger");
        }
        try {
          await dispatch(
            addOpportunityHistoryEntry({
              id: opp.id,
              body: { note: "Lead pack edited after handover to estimation — estimator notified." },
            }),
          ).unwrap();
        } catch {
          // The edit itself is saved; a missing history line is not worth failing over.
        }
      }

      setEditing(false);
      notify(handedOver ? "Lead pack saved — estimator notified" : "Lead pack saved");
    } catch (err) {
      setSaveError(typeof err === "string" ? err : err?.message || "Could not save the lead pack.");
    } finally {
      setSaving(false);
    }
  };

  const atLeadStage = Number(opp.stage) === LEAD_STAGE;
  // "Handed over" means an estimator owns it now, whether or not the stage moved.
  const estimatorName = opp.estimator?.name || userName(opp.estimatorId);
  const handedOver = Boolean(opp.estimatorId);
  const startEditing = () => (handedOver ? setConfirmEdit(true) : setEditing(true));
  const cancelEditing = () => {
    setForm(leadToForm(opp));
    setErrors({});
    setEditing(false);
  };
  const gate = leadGateItems(opp);
  const completeness = leadCompletenessItems(opp);
  const errorList = [...new Set(Object.values(errors))];

  return (
    <>
      <div className="card card-pad">
        <div className="card-head" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span className="card-icon">
            <ClipboardCheck size={16} />
          </span>
          <h2>Lead pack</h2>
        </div>
        {canEdit && !editing ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={startEditing}>
            <Pencil size={14} /> Edit
          </button>
        ) : null}
      </div>
      <p className="sub">
        {atLeadStage
          ? "A lead becomes an opportunity once it's marked Potential with an estimator assigned."
          : "This lead has already moved on. You can still review and update the details."}
      </p>

      <LeadForm
        form={form}
        set={set}
        errors={errors}
        estimators={estimators}
        sales={sales}
        referrers={referrers}
        unit={unit}
        disabled={!canEdit || !editing}
        onUnlock={canEdit && !editing ? startEditing : undefined}
        billFiles={billFiles}
        onUploadBills={canEdit && editing ? uploadBills : undefined}
        uploadingBills={uploadingBills}
        drawings={drawings}
        sitePhotos={sitePhotos}
        onUploadDrawings={canEdit && editing ? uploadCategory(DRAWING_CATEGORY) : undefined}
        onUploadSitePhotos={canEdit && editing ? uploadCategory(SITE_PHOTO_CATEGORY) : undefined}
        uploadingCategory={uploadingCategory}
        inspection={inspection}
        onRequestInspection={canEdit ? handleInspection : undefined}
        requestsPanel={
          <StageRequestsPanel
            opp={opp}
            stage={LEAD_STAGE}
            unit={unit}
            canEdit={canEdit}
            informationDepartment="operations"
            assignmentDepartment="operations"
            emptyBody="Raise a request when you need something from another team to qualify this lead, or assign a site activity to operations."
          />
        }
      />

      {errorList.length ? (
        <Alert tone="danger" style={{ marginTop: 16 }}>
          Fix {errorList.length} {errorList.length === 1 ? "field" : "fields"} before saving.
          <ul>
            {errorList.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      {saveError ? <Alert tone="danger">{saveError}</Alert> : null}

      {atLeadStage ? (
        gate.length ? (
          <Alert tone="info" style={{ marginTop: 16 }}>
            To leave lead capture: {gate.join(" · ")}
            {completeness.length ? ` · Also worth completing: ${completeness.join(", ")}` : ""}
          </Alert>
        ) : (
          <Alert tone="success" style={{ marginTop: 16 }}>
            Ready to advance{completeness.length ? ` — still worth completing: ${completeness.join(", ")}` : ""}.
          </Alert>
        )
      ) : null}

      {!canEdit ? (
        <p className="lede" style={{ marginTop: 16 }}>
          You have read access to this lead. Editing needs the “Update Leads” permission.
        </p>
      ) : editing ? (
        <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save lead details"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={cancelEditing} disabled={saving}>
            Cancel
          </button>
          {handedOver ? (
            <span className="row-meta" style={{ alignSelf: "center" }}>
              {estimatorName || "The estimator"} is notified when you save.
            </span>
          ) : null}
        </div>
      ) : (
        <p className="lede" style={{ marginTop: 16 }}>
          Read-only. Use Edit above to change the lead details.
        </p>
      )}

      {confirmEdit ? (
        <Modal
          title="This lead is with estimation"
          body={`${estimatorName || "An estimator"} is working from these details${
            opp.estimatorAssignedAt ? ` (assigned ${formatWhen(opp.estimatorAssignedAt)})` : ""
          }. Editing now changes what they are pricing, and they will be notified when you save.`}
          onClose={() => setConfirmEdit(false)}
          actions={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmEdit(false)}>
                Leave it as it is
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => {
                  setConfirmEdit(false);
                  setEditing(true);
                }}
              >
                Edit anyway
              </button>
            </>
          }
        />
      ) : null}
      </div>

      {requestingInspection ? (
        <RequestFormModal
          opportunity={opp}
          stage={LEAD_STAGE}
          kind="assignment"
          department="operations"
          people={siteOps.length ? siteOps : sales}
          onClose={() => setRequestingInspection(false)}
          onSubmit={async (body) => {
            await dispatch(
              createRequest({ opportunityId: opp.id, body: { ...body, title: body.title || "Pre-site inspection" } }),
            ).unwrap();
            notify("Pre-site inspection requested — the operations coordinator is notified");
          }}
        />
      ) : null}

      {viewingInspection ? (
        <RequestDetail request={viewingInspection} onClose={() => setViewingInspection(null)} />
      ) : null}
    </>
  );
}
