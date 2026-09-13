// Stage-2 work: the estimation workflow, as one module — every step (sales
// requirements, the requirements checklist, client input, the estimator
// checklist and the pre-site visit) is visible together, in order, so the
// estimator can see everything they've entered rather than clicking through
// a wizard.
//
// Backed by the real prestige-be contract designed for this module (see the
// submitEstimation*/notify* thunks in slices/leadsSlice.js) — the backend
// doesn't have these endpoints yet, so live clicking will 404 until they're
// implemented, but the data now lives on the opportunity record itself
// (same as every other stage), not in a local-only store.
//
// Yes/No decisions (requirements received, client input needed) dispatch
// immediately. The checklists are buffered locally and committed with an
// explicit "Save checklist" button — but the *progressive reveal* below
// (which section shows next) reads the local buffer, not the saved record,
// so ticking a box reveals the next question right away instead of waiting
// on a round trip. The actual stage-advance gate (helpers/stageTransition.js)
// reads the saved opportunity, so advancing still requires an actual save.

import { useEffect, useState } from "react";
import { Calculator, ClipboardList, FileCheck2, HardHat, ListChecks, MessageCircleQuestion } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Field from "@/components/Field";
import FileDropzone from "@/components/FileDropzone";
import SectionHead from "@/components/SectionHead";
import ChecklistRow from "@/features/leads/LeadForm/ChecklistRow";
import QuoteBuilder from "@/features/pipeline/QuoteBuilder";
import { REQUIREMENTS_CHECKLIST, ESTIMATOR_CHECKLIST } from "@/constants/checklists";
import { estimationState } from "@/helpers/stageTransition";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  assignCoordinator,
  fetchOpportunityAttachments,
  notifyOperationsCoordinator,
  notifySalesManager,
  submitEstimationClientInfo,
  submitEstimationRequirements,
  submitEstimatorChecklist,
  uploadOpportunityAttachment,
} from "@/slices/leadsSlice";
import { useUnitUsers } from "@/hooks/useUnitUsers";
import { useNotifications } from "@/hooks/useNotifications";

const CLIENT_DOCUMENT_CATEGORY = "client_document";

const STATUS_META = {
  awaiting_requirements: { label: "Awaiting requirements from sales", tone: "neutral" },
  on_hold: { label: "On hold — sent back to sales", tone: "danger" },
  evaluating: { label: "Evaluating", tone: "warning" },
  awaiting_client_info: { label: "Awaiting client input", tone: "warning" },
  ready: { label: "Ready to proceed", tone: "success" },
};

function YesNo({ value, onChange, disabled, yesLabel = "Yes", noLabel = "No" }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <button
        type="button"
        className={value === true ? "btn btn-primary btn-sm" : "btn btn-ghost btn-sm"}
        disabled={disabled}
        onClick={() => onChange(true)}
      >
        {yesLabel}
      </button>
      <button
        type="button"
        className={value === false ? "btn btn-danger btn-sm" : "btn btn-ghost btn-sm"}
        disabled={disabled}
        onClick={() => onChange(false)}
      >
        {noLabel}
      </button>
    </div>
  );
}

function CheckItem({ checked, label, onToggle, disabled }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} disabled={disabled} onChange={() => onToggle(!checked)} />
      <span>{label}</span>
    </label>
  );
}

function ChecklistProgress({ done, total }) {
  return (
    <div className="checklist-progress">
      <span className="cp-label">
        {done} of {total} complete
      </span>
      <div className="cp-track">
        <i style={{ width: `${total ? (done / total) * 100 : 0}%` }} />
      </div>
    </div>
  );
}

/** A field-group block — not `.list-row` (that class is for actual list items, with its own padding/border/negative-margin, which is what made this cramped before). */
function QuestionBlock({ title, children }) {
  return (
    <div style={{ marginBottom: 20 }}>
      {title ? (
        <div className="row-title" style={{ marginBottom: 10 }}>
          {title}
        </div>
      ) : null}
      {children}
    </div>
  );
}

const formFromOpp = (opp) => ({
  requirementsChecklist: opp.estimationRequirementsChecklist || [],
  holdReason: opp.estimationOnHoldReason || "",
  checklistValues: opp.estimationChecklistValues || {},
  preSiteInspectionRequired: opp.estimationPreSiteInspectionRequired ?? null,
  siteVisitAssigneeId: opp.estimationSiteVisitAssigneeId ?? null,
  siteVisitCompleted: opp.estimationSiteVisitCompleted ?? null,
});

export default function EstimationPanel({ opp, canEdit, onViewLead }) {
  const dispatch = useAppDispatch();
  const { notify, error: notifyError } = useNotifications();
  const attachments = useAppSelector((s) => s.leads.attachments);
  const { active, siteOps, userName } = useUnitUsers();
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadingSketches, setUploadingSketches] = useState(false);
  const [askingReceived, setAskingReceived] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [requirementsChecklist, setRequirementsChecklist] = useState(() => formFromOpp(opp).requirementsChecklist);
  const [holdReason, setHoldReason] = useState(() => formFromOpp(opp).holdReason);
  const [checklistValues, setChecklistValues] = useState(() => formFromOpp(opp).checklistValues);
  const [preSiteInspectionRequired, setPreSiteInspectionRequired] = useState(
    () => formFromOpp(opp).preSiteInspectionRequired,
  );
  const [siteVisitAssigneeId, setSiteVisitAssigneeId] = useState(() => formFromOpp(opp).siteVisitAssigneeId);
  const [siteVisitCompleted, setSiteVisitCompleted] = useState(() => formFromOpp(opp).siteVisitCompleted);

  useEffect(() => {
    const fresh = formFromOpp(opp);
    setRequirementsChecklist(fresh.requirementsChecklist);
    setHoldReason(fresh.holdReason);
    setChecklistValues(fresh.checklistValues);
    setPreSiteInspectionRequired(fresh.preSiteInspectionRequired);
    setSiteVisitAssigneeId(fresh.siteVisitAssigneeId);
    setSiteVisitCompleted(fresh.siteVisitCompleted);
    setAskingReceived(false);
    setError("");
  }, [opp]);

  useEffect(() => {
    dispatch(fetchOpportunityAttachments(opp.id));
  }, [opp.id, dispatch]);

  const clientDocuments = attachments.filter((a) => a.category === CLIENT_DOCUMENT_CATEGORY);
  const sitePhotos = attachments.filter((a) => a.category === "photo");
  const siteSketches = attachments.filter((a) => a.category === "sketch");

  const uploadCategory = (category, setUploading) => async (files) => {
    setUploading(true);
    try {
      for (const file of files) {
        await dispatch(uploadOpportunityAttachment({ id: opp.id, category, file })).unwrap();
      }
    } catch (err) {
      notifyError(typeof err === "string" ? err : err?.message || "Could not upload the file.");
    } finally {
      setUploading(false);
    }
  };

  const uploadClientDocuments = uploadCategory(CLIENT_DOCUMENT_CATEGORY, setUploadingDocs);
  const uploadSitePhotos = uploadCategory("photo", setUploadingPhotos);
  const uploadSiteSketches = uploadCategory("sketch", setUploadingSketches);

  const run = async (action) => {
    setSaving(true);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(typeof err === "string" ? err : err?.message || "Could not save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const answerReceived = (received) => {
    if (received === false) {
      setAskingReceived(true);
      return;
    }
    setAskingReceived(false);
    run(() => dispatch(submitEstimationRequirements({ id: opp.id, body: { received: true } })).unwrap());
  };

  const confirmNotReceived = () => {
    if (!holdReason.trim()) {
      setError("Say what's missing before sending it back to sales.");
      return;
    }
    run(async () => {
      await dispatch(
        submitEstimationRequirements({ id: opp.id, body: { received: false, reason: holdReason.trim() } }),
      ).unwrap();
      await dispatch(notifySalesManager(opp.id)).unwrap();
      setAskingReceived(false);
      notify("Sent back to sales — sales manager notified");
    });
  };

  const toggleRequirement = (key, on) => {
    const next = on ? [...new Set([...requirementsChecklist, key])] : requirementsChecklist.filter((k) => k !== key);
    setRequirementsChecklist(next);
    run(() =>
      dispatch(submitEstimationRequirements({ id: opp.id, body: { received: true, checklistKeys: next } })).unwrap(),
    );
  };

  const answerClientInfo = (needed) => {
    run(() => dispatch(submitEstimationClientInfo({ id: opp.id, body: { needed } })).unwrap());
  };

  const setChecklistValue = (key, value) => setChecklistValues((v) => ({ ...v, [key]: value }));

  const saveEstimatorChecklist = () => {
    run(async () => {
      await dispatch(
        submitEstimatorChecklist({
          id: opp.id,
          body: { checklistValues, preSiteInspectionRequired, siteVisitAssigneeId, siteVisitCompleted },
        }),
      ).unwrap();
      notify("Checklist saved");
    });
  };

  const assignCoordinatorPerson = async (id) => {
    if (!id) return;
    try {
      await dispatch(assignCoordinator({ id: opp.id, body: { operationalCoordinatorId: Number(id) } })).unwrap();
    } catch (err) {
      notifyError(typeof err === "string" ? err : err?.message || "Could not assign the coordinator.");
    }
  };

  const notifyCoordinator = () => {
    run(async () => {
      await dispatch(notifyOperationsCoordinator(opp.id)).unwrap();
      notify("Operations coordinator notified to assign a site team member");
    });
  };

  const state = estimationState(opp);
  const status = STATUS_META[state];
  const onHold = opp.estimationRequirementsReceived === false;

  const requirementsChecklistComplete = requirementsChecklist.length === REQUIREMENTS_CHECKLIST.length;
  const estimatorChecklistDone = ESTIMATOR_CHECKLIST.filter((item) => (checklistValues[item.key] || "").trim()).length;

  const showRequirementsChecklist = opp.estimationRequirementsReceived === true;
  const showClientInfoGate = showRequirementsChecklist && requirementsChecklistComplete;
  const showEstimatorChecklist = opp.estimationClientInfoNeeded === true;

  const preSiteResolved =
    preSiteInspectionRequired === false || (preSiteInspectionRequired === true && siteVisitCompleted === true);
  const showQuoteBuilder = state === "ready" || (showEstimatorChecklist && preSiteResolved);

  return (
    <div className="card card-pad">
      <div className="card-head" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="card-icon">
            <Calculator size={16} />
          </span>
          <h2>Estimation & validation</h2>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <p className="sub">Solution options, cost build-up, sell price and target margin, verified before a proposal is prepared.</p>

      {onViewLead ? (
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginBottom: 20 }} onClick={onViewLead}>
          Review the lead pack sales collected
        </button>
      ) : null}

      {onHold ? (
        <Alert tone="warning" style={{ marginBottom: 20 }}>
          Estimation is on hold and sales has been notified. {opp.estimationOnHoldReason}
        </Alert>
      ) : null}

      <div className="section">
        <SectionHead icon={<ClipboardList size={13} />} title="Requirements from sales" />
        <QuestionBlock title="Did sales provide the minimum required information for this lead?">
          <YesNo value={opp.estimationRequirementsReceived} onChange={answerReceived} disabled={!canEdit || saving} />
          {askingReceived ? (
            <div style={{ marginTop: 14 }}>
              <Field label="What's missing?" hint="sent to sales with the notification">
                <textarea rows={2} value={holdReason} disabled={!canEdit} onChange={(e) => setHoldReason(e.target.value)} />
              </Field>
              {canEdit ? (
                <button
                  type="button"
                  className="btn btn-danger btn-sm"
                  style={{ marginTop: 12 }}
                  disabled={saving || !holdReason.trim()}
                  onClick={confirmNotReceived}
                >
                  Send back to sales
                </button>
              ) : null}
            </div>
          ) : null}
        </QuestionBlock>
      </div>

      {showRequirementsChecklist ? (
        <div className="section" style={{ marginTop: 24 }}>
          <SectionHead icon={<ListChecks size={13} />} title="Requirements checklist" />
          <ChecklistProgress done={requirementsChecklist.length} total={REQUIREMENTS_CHECKLIST.length} />
          <div className="checklist" style={{ margin: "16px 0" }}>
            {REQUIREMENTS_CHECKLIST.map((item) => (
              <CheckItem
                key={item.key}
                label={item.label}
                checked={requirementsChecklist.includes(item.key)}
                disabled={!canEdit}
                onToggle={(on) => toggleRequirement(item.key, on)}
              />
            ))}
          </div>
        </div>
      ) : null}

      {showClientInfoGate ? (
        <div className="section" style={{ marginTop: 24 }}>
          <SectionHead icon={<MessageCircleQuestion size={13} />} title="Client input" />
          <QuestionBlock title="Does the client need to provide more input before this can be estimated?">
            <YesNo value={opp.estimationClientInfoNeeded} onChange={answerClientInfo} disabled={!canEdit || saving} />
          </QuestionBlock>
        </div>
      ) : null}

      {showEstimatorChecklist ? (
        <div className="section" style={{ marginTop: 24 }}>
          <SectionHead icon={<FileCheck2 size={13} />} title="Documents collected from client" />
          <p className="lede" style={{ marginBottom: 16 }}>
            As the client sends over what's missing, attach it here so it's on the record.
          </p>
          <FileDropzone files={clientDocuments} onSelect={uploadClientDocuments} disabled={!canEdit} uploading={uploadingDocs} />
        </div>
      ) : null}

      {showEstimatorChecklist ? (
        <div className="section" style={{ marginTop: 24 }}>
          <SectionHead icon={<ListChecks size={13} />} title="Estimator checklist" />
          <p className="lede" style={{ marginBottom: 16 }}>
            Work through this while the client's input is pending, or to record the site assessment.
          </p>
          <ChecklistProgress done={estimatorChecklistDone} total={ESTIMATOR_CHECKLIST.length} />
          <div className="checklist" style={{ margin: "16px 0" }}>
            {ESTIMATOR_CHECKLIST.map((item) => {
              const value = checklistValues[item.key] || "";
              return (
                <ChecklistRow key={item.key} done={!!value.trim()} label={item.label}>
                  <Field>
                    {item.type === "textarea" ? (
                      <textarea
                        rows={2}
                        value={value}
                        disabled={!canEdit}
                        placeholder={item.placeholder}
                        onChange={(e) => setChecklistValue(item.key, e.target.value)}
                      />
                    ) : (
                      <input
                        type="text"
                        value={value}
                        disabled={!canEdit}
                        placeholder={item.placeholder}
                        onChange={(e) => setChecklistValue(item.key, e.target.value)}
                      />
                    )}
                  </Field>
                </ChecklistRow>
              );
            })}
          </div>

          <QuestionBlock title="Is a pre-site inspection required?">
            <YesNo value={preSiteInspectionRequired} onChange={setPreSiteInspectionRequired} disabled={!canEdit} />
          </QuestionBlock>

          {preSiteInspectionRequired === true ? (
            <div style={{ marginTop: 24, marginBottom: 20 }}>
              <SectionHead icon={<HardHat size={13} />} title="Pre-site visit" />

              <QuestionBlock title="Operations coordinator">
                {canEdit ? (
                  <select value={opp.operationalCoordinatorId || ""} onChange={(e) => assignCoordinatorPerson(e.target.value)}>
                    <option value="">Assign a coordinator</option>
                    {siteOps.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="lede">{userName(opp.operationalCoordinatorId) || "No coordinator assigned yet."}</p>
                )}
                {canEdit ? (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: 12 }}
                    disabled={saving}
                    onClick={notifyCoordinator}
                  >
                    Notify operations coordinator
                  </button>
                ) : null}
              </QuestionBlock>

              <QuestionBlock title="Site team member">
                {canEdit ? (
                  <select
                    value={siteVisitAssigneeId || ""}
                    onChange={(e) => setSiteVisitAssigneeId(e.target.value ? Number(e.target.value) : null)}
                  >
                    <option value="">Not assigned</option>
                    {active.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="lede">{userName(siteVisitAssigneeId) || "Not assigned yet"}</p>
                )}
              </QuestionBlock>

              <QuestionBlock title="Site photos">
                <p className="lede" style={{ marginBottom: 12 }}>
                  Photos from the site visit — access, electrical conditions, constraints.
                </p>
                <FileDropzone files={sitePhotos} onSelect={uploadSitePhotos} disabled={!canEdit} uploading={uploadingPhotos} />
              </QuestionBlock>

              <QuestionBlock title="Sketches & drawings">
                <p className="lede" style={{ marginBottom: 12 }}>
                  Hand sketches, plans or design outputs from the site visit.
                </p>
                <FileDropzone
                  files={siteSketches}
                  onSelect={uploadSiteSketches}
                  disabled={!canEdit}
                  uploading={uploadingSketches}
                />
              </QuestionBlock>

              <QuestionBlock title="Has the site visit been completed?">
                <YesNo value={siteVisitCompleted} onChange={setSiteVisitCompleted} disabled={!canEdit} />
              </QuestionBlock>
            </div>
          ) : null}

          {canEdit ? (
            <button type="button" className="btn btn-ghost btn-sm" disabled={saving} onClick={saveEstimatorChecklist}>
              Save checklist &amp; site visit
            </button>
          ) : null}
        </div>
      ) : null}

      {showQuoteBuilder ? <QuoteBuilder opp={opp} canEdit={canEdit} /> : null}

      {state === "ready" ? (
        <Alert tone="success" style={{ marginTop: 24 }}>
          Estimation is ready to proceed — requirements and client input confirmed
          {preSiteInspectionRequired ? ", pre-site inspection required" : ""}.
        </Alert>
      ) : null}

      {error ? (
        <Alert tone="danger" style={{ marginTop: 20 }}>
          {error}
        </Alert>
      ) : null}

      {!canEdit ? (
        <p className="lede" style={{ marginTop: 16 }}>
          You have read access to this record. Editing needs the “Update Leads” permission.
        </p>
      ) : null}
    </div>
  );
}
