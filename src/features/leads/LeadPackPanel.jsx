// Stage-1 work: the lead pack, editable while the record lives.

import { useEffect, useMemo, useRef, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import Alert from "@/components/Alert";
import LeadForm from "@/features/leads/LeadForm";
import StageRequestsPanel from "@/features/collaboration/StageRequestsPanel";
import {
  LOCAL_UNTIL_SAVED,
  autosavePayload,
  changedPayload,
  hasChanges,
  idOrNull,
  isLoggedAttempt,
  leadToForm,
  validateLeadForm,
} from "@/features/leads/leadFormModel";
import { DRAWING_CATEGORY, SITE_PHOTO_CATEGORY } from "@/constants/estimationInput";
import { leadGateItems } from "@/helpers/stageTransition";
import { clearLeadDraft, readLeadDraft, writeLeadDraft } from "@/helpers/leadDrafts";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  addOpportunityHistoryEntry,
  advanceStage,
  assignEstimator,
  assignSalesperson,
  fetchOpportunityAttachments,
  notifyEstimator,
  updateLead,
  uploadOpportunityAttachment,
} from "@/slices/leadsSlice";
import { fetchReferrers } from "@/slices/referralsSlice";
import { fetchOpportunityRequests } from "@/slices/collaborationSlice";
import { useUnitUsers } from "@/hooks/useUnitUsers";
import { dateIsoInZone, formatDate as formatWhen } from "@/helpers/dateTimeHelpers";
import { useNotifications } from "@/hooks/useNotifications";
import { useAuth } from "@/hooks/useAuth";
import { nextStageFor, stageById } from "@/constants/stages";
import { canAdvanceFrom } from "@/helpers/stageAccess";

/** Everything raised from the lead pack is filed against stage 1. */
const LEAD_STAGE = 1;

// Keystrokes are kept in this browser, not sent to the API, until the lead is
// saved — and never past the end of the session (see helpers/leadDrafts.js).

// onMoved: called once the lead has been moved on to the next stage from here.
export default function LeadPackPanel({ opp, unit, canEdit, onMoved }) {
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const { estimators, sales, userName } = useUnitUsers();
  const referrers = useAppSelector((s) => s.referrals.items);
  const referrersStatus = useAppSelector((s) => s.referrals.status);
  const attachments = useAppSelector((s) => s.leads.attachments);
  const { notify, error: notifyError } = useNotifications();
  const [form, setForm] = useState(() => readLeadDraft(opp) ?? leadToForm(opp));
  // The record the form was built from. Saves send only what differs from it,
  // so a field nobody touched on this screen is never written back over what
  // estimation (or anyone else) saved since.
  const [base, setBase] = useState(opp);
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingBills, setUploadingBills] = useState(false);
  const [uploadingCategory, setUploadingCategory] = useState(null);
  // The lead pack is always open to edit for anyone with the Leads permission,
  // at every stage — there is no separate "Edit lead details" unlock. Once an
  // estimator has it, a warning above the form says so and they are notified
  // on save.
  // "", "saving", "saved" or "error" — what the autosave line shows.
  const [autosaveState, setAutosaveState] = useState("");
  // Bumped on every successful Save: the form moves on to its next tab.
  const [advanceTab, setAdvanceTab] = useState(0);
  // The tab a save moves on to, as LeadForm reports it — named on the Save button.
  const [nextTabLabel, setNextTabLabel] = useState(null);
  // The lead could leave the stage on this save — LeadForm says so from the Mark Potential tab.
  const [readyToProceed, setReadyToProceed] = useState(false);
  const [proceeding, setProceeding] = useState(false);
  // The day the lead was created, where the unit works — the earliest date anything on it can carry.
  const leadCreatedOn = dateIsoInZone(opp?.createdAt, unit?.timezone);

  // A fresh record (after fetch or save) replaces any unsaved edits.
  const openedId = useRef(opp?.id);
  // The latest dirty flag, readable from the effect below without making the
  // effect re-run on every keystroke.
  const dirtyRef = useRef(false);
  useEffect(() => {
    const changedRecord = openedId.current !== opp?.id;
    if (changedRecord) openedId.current = opp?.id;
    // A refresh of the record already open must not overwrite unsaved typing
    // — autosave's own response comes back through here too.
    if (changedRecord || !dirtyRef.current) {
      setForm(leadToForm(opp));
      setBase(opp);
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
  // Measured the way a save would see it, so a successful save clears it.
  const dirty = useMemo(() => hasChanges(form, base), [form, base]);
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

  // Typing is kept locally and written to the record when a tab is done with,
  // rather than a PATCH every second: the checklist runs to a hundred-odd
  // fields and a request per keystroke is a lot of traffic for no benefit.
  // Stamped with the version the form was built from: a draft is only
  // restored against that version, never over a newer one.
  useEffect(() => {
    if (dirty) writeLeadDraft(base, form);
  }, [form, base, dirty]);

  /**
   * After a save, the record as the API now holds it becomes the baseline and
   * the form takes its values — except anything typed while the save was on
   * its way (still to be sent) and the fields the PATCH does not carry.
   */
  const adoptSaved = (saved, sent) => {
    if (!saved?.id) return;
    const fresh = leadToForm(saved);
    setForm((current) => {
      const next = { ...fresh };
      for (const key of Object.keys(current))
        if (current[key] !== sent[key] || LOCAL_UNTIL_SAVED.includes(key)) next[key] = current[key];
      return next;
    });
    setBase(saved);
  };

  /**
   * Writes what is on screen without validating any of it. Half a checklist is
   * exactly what needs keeping, so this never refuses — only the Save button
   * validates, and only when someone presses it.
   */
  const persist = async () => {
    const body = autosavePayload(form, base);
    if (!Object.keys(body).length) {
      setAutosaveState("saved");
      return true;
    }
    const sent = form;
    const previousAttemptCount = (opp.contactAttempts || []).length;
    setAutosaveState("saving");
    try {
      const saved = await dispatch(updateLead({ id: opp.id, body })).unwrap();
      adoptSaved(saved, sent);
      await logNewFailedAttempts(previousAttemptCount);
      clearLeadDraft(opp.id);
      setAutosaveState("saved");
      return true;
    } catch {
      // Kept quiet: the Save button is still there, and the line by it says
      // the change has not landed.
      setAutosaveState("error");
      return false;
    }
  };

  /** Leaving a tab commits what was filled in on it. */
  const handleTabChange = () => {
    if (canEdit && dirty && !saving) persist();
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
    const added = (form.contactAttempts || []).filter(isLoggedAttempt).slice(previousCount);
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
    const found = validateLeadForm(form, { minDate: leadCreatedOn });
    if (Object.keys(found).length) {
      setErrors(found);
      return false;
    }
    // Baseline before this save — used to work out what's actually new,
    // so re-saving never re-writes the same job-history entry twice.
    const previousAttemptCount = (opp.contactAttempts || []).length;
    const changes = changedPayload(form, base);
    const sent = form;
    setSaving(true);
    setSaveError("");
    try {
      // Only what changed here; nothing changed, nothing sent (the assignments
      // below still go through their own calls).
      if (Object.keys(changes).length) {
        const saved = await dispatch(
          updateLead({
            id: opp.id,
            // The stamp is what the estimation screen reads to know the pack
            // moved under it; it is cleared when the estimator acknowledges.
            body: handedOver ? { ...changes, leadEditedAt: new Date().toISOString() } : changes,
          }),
        ).unwrap();
        adoptSaved(saved, sent);
      }

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
      clearLeadDraft(opp.id);
      notify(handedOver ? "Lead pack saved — estimator notified" : "Lead pack saved");
      setAdvanceTab((n) => n + 1);
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
  // Throws away what was typed since the last save.
  const cancelEditing = () => {
    setForm(leadToForm(opp));
    setBase(opp);
    setErrors({});
  };
  const gate = leadGateItems(opp);
  // On the last tab, a lead that is ready saves and moves straight on.
  const nextStage = nextStageFor(LEAD_STAGE, unit);
  const canProceed =
    readyToProceed && atLeadStage && opp.lifecycle === "Active" && nextStage !== null && canAdvanceFrom(user, LEAD_STAGE);
  const saveAndProceed = async () => {
    if (!(await save())) return;
    setProceeding(true);
    try {
      const updated = await dispatch(advanceStage(opp.id)).unwrap();
      notify(`Moved to ${stageById(updated?.stage ?? nextStage).label}`);
      onMoved?.();
    } catch (err) {
      setSaveError(
        `Saved, but it could not move on yet: ${typeof err === "string" ? err : err?.message || "the stage gate refused it."}`,
      );
    } finally {
      setProceeding(false);
    }
  };
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
      </div>
      <p className="sub">
        {atLeadStage
          ? "A lead becomes an opportunity once it's marked Potential with an estimator assigned."
          : "This lead has already moved on. You can still review and update the details."}
      </p>

      {errorList.length ? (
        <Alert tone="danger" style={{ marginBottom: 12 }}>
          Fix {errorList.length} {errorList.length === 1 ? "field" : "fields"} before saving. Each one is marked on its
          tab.
          <ul>
            {errorList.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      {saveError ? (
        <Alert tone="danger" style={{ marginBottom: 12 }}>
          {saveError}
        </Alert>
      ) : null}

      {atLeadStage ? (
        gate.length ? (
          <Alert tone="info" style={{ marginBottom: 12 }}>
            Complete the checklist to mark this lead Potential and move it on.
          </Alert>
        ) : (
          <Alert tone="success" style={{ marginBottom: 12 }}>
            Checklist complete — this lead is ready to advance.
          </Alert>
        )
      ) : null}

      {canEdit && handedOver ? (
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
        disabled={!canEdit}
        billFiles={billFiles}
        onUploadBills={canEdit ? uploadBills : undefined}
        uploadingBills={uploadingBills}
        drawings={drawings}
        sitePhotos={sitePhotos}
        onUploadDrawings={canEdit ? uploadCategory(DRAWING_CATEGORY) : undefined}
        onUploadSitePhotos={canEdit ? uploadCategory(SITE_PHOTO_CATEGORY) : undefined}
        uploadingCategory={uploadingCategory}
        onTabChange={handleTabChange}
        advanceTab={advanceTab}
        onNextTabChange={setNextTabLabel}
        onReadyToProceedChange={setReadyToProceed}
        minDate={leadCreatedOn}
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

      {!canEdit ? (
        <p className="lede" style={{ marginTop: 16 }}>
          You have read access to this lead. Editing needs the “Update Leads” permission.
        </p>
      ) : (
        <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn btn-primary"
            onClick={canProceed ? saveAndProceed : save}
            disabled={saving || proceeding}
          >
            {saving
              ? "Saving…"
              : proceeding
                ? "Moving…"
                : canProceed
                  ? `Save & proceed to ${stageById(nextStage).short}`
                  : nextTabLabel
                    ? `Save & continue to ${nextTabLabel}`
                    : "Save lead details"}
          </button>
          <button type="button" className="btn btn-ghost" onClick={cancelEditing} disabled={saving}>
            Cancel
          </button>
          <span className="row-meta" style={{ alignSelf: "center" }}>
            {autosaveState === "error"
              ? "Could not save — try Save lead details."
              : autosaveState === "saving"
                ? "Saving…"
                : dirty
                  ? "Unsaved — kept on this device until you save"
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
      )}

      </div>

    </>
  );
}
