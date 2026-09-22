// Stage-1 work: the lead pack, editable while the record lives.

import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardCheck, Pencil } from "lucide-react";
import Alert from "@/components/Alert";
import Modal from "@/components/Modal";
import LeadForm from "@/features/leads/LeadForm";
import RequestDetail from "@/features/collaboration/RequestDetail";
import RequestFormModal from "@/features/collaboration/RequestFormModal";
import StageRequestsPanel from "@/features/collaboration/StageRequestsPanel";
import { autosavePayload, formToPayload, idOrNull, leadToForm, validateLeadForm } from "@/features/leads/leadFormModel";
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
import { inspectionRequests } from "@/constants/collaboration";
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
  // Open ready to edit. The checklist runs across several tabs and people
  // fill it in over more than one sitting, so locking it behind a pencil only
  // got in the way. Read-only is for people without the permission, and for
  // anyone who has pressed Cancel.
  const [editing, setEditing] = useState(true);
  const [confirmEdit, setConfirmEdit] = useState(false);
  // "", "saving", "saved" or "error" — what the autosave line shows.
  const [autosaveState, setAutosaveState] = useState("");

  // A fresh record (after fetch or save) replaces any unsaved edits. Opening a
  // different record starts read-only again, but saving the one you are on
  // leaves the form unlocked so you can carry straight on to the next tab.
  const openedId = useRef(opp?.id);
  // The latest dirty flag, readable from the effect below without making the
  // effect re-run on every keystroke.
  const dirtyRef = useRef(false);
  useEffect(() => {
    const changedRecord = openedId.current !== opp?.id;
    if (changedRecord) {
      openedId.current = opp?.id;
      setEditing(true);
    }
    // A refresh of the record already open must not overwrite unsaved typing
    // — autosave's own response comes back through here too.
    if (changedRecord || !dirtyRef.current) {
      setForm(leadToForm(opp));
      setErrors({});
    }
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

  // The checklist lives in local state until it is saved, so anything that
  // takes the person off this screen has to know there is unsaved work.
  const savedForm = useMemo(() => leadToForm(opp), [opp]);
  const dirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(savedForm), [form, savedForm]);
  dirtyRef.current = dirty;

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Autosave. The checklist runs over several tabs and more than one sitting,
  // so every change goes to the record about a second after typing stops, and
  // nothing is left living only in this browser tab. The decision fields are
  // left out (see autosavePayload) and nothing is validated: a half-filled
  // checklist is precisely what needs keeping.
  useEffect(() => {
    if (!canEdit || !editing || !dirty || saving) return undefined;
    const timer = setTimeout(async () => {
      const previousAttemptCount = (opp.contactAttempts || []).length;
      setAutosaveState("saving");
      try {
        await dispatch(updateLead({ id: opp.id, body: autosavePayload(form) })).unwrap();
        await logNewFailedAttempts(previousAttemptCount);
        setAutosaveState("saved");
      } catch {
        // Kept quiet: the Save button is still there, and the line below says
        // the change has not landed.
        setAutosaveState("error");
      }
    }, 1200);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, canEdit, editing, dirty, saving]);

  // The pre-site inspection row tracks the most recent assignment raised for
  // it; a job may have more than one.
  const inspections = collabOppId === Number(opp?.id) ? inspectionRequests(requests) : [];
  const inspection = inspections[0] || null;

  /** Opens the existing inspection, or starts a new request when there is none. */
  const handleInspection = async (existing) => {
    if (existing) {
      setViewingInspection(existing);
      return;
    }
    // Save what is on screen before the request leaves. Without this the
    // checklist stays in this browser tab only, and a logout loses it.
    if (dirty && !(await save())) return;
    setRequestingInspection(true);
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

  /** Returns true when the record was written, false when it was not. */
  /**
   * One job-history line per new attempt where the client wasn't reached.
   * `previousCount` is how many attempts the record held before this write.
   */
  const logNewFailedAttempts = async (previousCount) => {
    const added = (form.contactAttempts || []).slice(previousCount);
    for (const attempt of added.filter((a) => a.reached === false)) {
      await dispatch(
        addOpportunityHistoryEntry({
          id: opp.id,
          body: {
            note: `Client not contacted (${attempt.method}, ${formatDate(attempt.contactedAt)}) — ${attempt.reason}`,
          },
        }),
      ).unwrap();
    }
  };

  const save = async () => {
    const found = validateLeadForm(form);
    if (Object.keys(found).length) {
      setErrors(found);
      return false;
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
      await logNewFailedAttempts(previousAttemptCount);

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

      // Deliberately stays in edit mode: the checklist spans several tabs and
      // people save as they go.
      notify(handedOver ? "Lead pack saved — estimator notified" : "Lead pack saved");
      return true;
    } catch (err) {
      setSaveError(typeof err === "string" ? err : err?.message || "Could not save the lead pack.");
      return false;
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

      {canEdit && editing && handedOver ? (
        <Alert tone="warning" style={{ marginBottom: 12 }}>
          {estimatorName || "An estimator"} is pricing this lead
          {opp.estimatorAssignedAt ? ` (assigned ${formatWhen(opp.estimatorAssignedAt)})` : ""}. Changes here change
          what they are working from, and they are notified when you save.
        </Alert>
      ) : null}

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
        inspectionCount={inspections.length}
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
          <span className="row-meta" style={{ alignSelf: "center" }}>
            {autosaveState === "error"
              ? "Autosave failed — use Save lead details."
              : dirty || autosaveState === "saving"
                ? "Saving…"
                : autosaveState === "saved"
                  ? "All changes saved"
                  : ""}
          </span>
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
