// Stage-2 work: the estimation workflow, as one module split into tabs —
// requirements (from sales, the requirements checklist, client input), the
// estimator checklist, the pre-site visit, the quote, the variation check,
// and sending the finished quote on to proposal. Every tab can be
// opened to review what was entered; a step that isn't unlocked yet says what
// has to happen first rather than disappearing.
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

import { useEffect, useRef, useState } from "react";
import {
  Calculator,
  Check,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  HardHat,
  HandHelping,
  ChevronDown,
  ChevronRight,
  ListChecks,
  Lock,
  MessageCircleQuestion,
  Receipt,
  Send,
} from "lucide-react";
import Alert from "@/components/Alert";
import ContinueButton from "@/components/ContinueButton";
import Badge from "@/components/Badge";
import Field from "@/components/Field";
import EmptyState from "@/components/EmptyState";
import FileDropzone from "@/components/FileDropzone";
import SectionHead from "@/components/SectionHead";
import Tabs from "@/components/Tabs";
import ChecklistRow from "@/features/leads/LeadForm/ChecklistRow";
import LeadInputs from "@/features/estimation/LeadInputs";
import RequestDetail from "@/features/collaboration/RequestDetail";
import RequestFormModal from "@/features/collaboration/RequestFormModal";
import RequestStatusBadge from "@/features/collaboration/RequestStatusBadge";
import StageRequestsPanel from "@/features/collaboration/StageRequestsPanel";
import { inspectionApproved, inspectionDelivered, inspectionRequests, requestCode } from "@/constants/collaboration";
import QuoteBuilder from "@/features/pipeline/QuoteBuilder";
import ProposalHandover from "@/features/pipeline/ProposalHandover";
import RequoteSummary from "@/features/proposals/RequoteSummary";
import { isRequoteOpen } from "@/helpers/proposals";
import { leadMandatoryItems } from "@/helpers/leadChecklist";
import { DRAWING_CATEGORY } from "@/constants/estimationInput";
import RequiredApprovalsPicker from "@/features/approvals/RequiredApprovalsPicker";
import AddCustomApproval from "@/features/approvals/AddCustomApproval";
import { approvalHints, jobApprovalUnit, requiredKeysOf } from "@/helpers/requiredApprovals";
import { estimationInputFromOpp } from "@/constants/estimationInput";
import { estimationState } from "@/helpers/stageTransition";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { useAppDispatch, useAppSelector } from "@/store";
import { createRequest, fetchOpportunityRequests } from "@/slices/collaborationSlice";
import {
  acknowledgeLeadChange,
  collectEstimationInputs,
  fetchOpportunityAttachments,
  submitEstimationClientInfo,
  submitEstimatorChecklist,
  updateRequiredApprovals,
  uploadOpportunityAttachment,
} from "@/slices/leadsSlice";
import { useUnitUsers } from "@/hooks/useUnitUsers";
import { useNotifications } from "@/hooks/useNotifications";

const STATUS_META = {
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

/** Shown in a tab whose step isn't unlocked yet. */
function LockedStep({ title, body }) {
  return <EmptyState icon={<Lock size={24} strokeWidth={1.5} />} title={title} body={body} />;
}

/**
 * Sales answers "is a pre-site inspection required?" on the lead checklist, so
 * estimation starts on that answer rather than asking it again from blank.
 * The estimator can still change it — their answer, once given, is the one
 * that counts.
 */
const preSiteFromLead = (opp) => {
  const asked = estimationInputFromOpp(opp).preSiteInspectionRequired;
  if (asked === "yes") return true;
  if (asked === "no") return false;
  return null;
};

const formFromOpp = (opp) => ({
  checklistValues: opp.estimationChecklistValues || {},
  preSiteInspectionRequired: opp.estimationPreSiteInspectionRequired ?? preSiteFromLead(opp),
});

// focusHandover: bump it to open the "Send to proposal" tab (the page's
// header button does). onSent: runs once the job has moved on.
export default function EstimationPanel({ opp, unit, canEdit, onViewLead, focusHandover = 0, onSent }) {
  const dispatch = useAppDispatch();
  const { notify, error: notifyError } = useNotifications();
  const attachments = useAppSelector((s) => s.leads.attachments);
  const quote = useAppSelector((s) => s.leads.quote);
  const { oppId: collabOppId, byOpp } = useAppSelector((s) => s.collaboration);
  const requests = collabOppId === Number(opp.id) ? byOpp : [];
  const { active } = useUnitUsers();
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadingSketches, setUploadingSketches] = useState(false);
  // Sales edited the lead pack after this reached estimation. Dismissing
  // clears it on the record; the local flag hides it straight away.
  const [leadChangeSeen, setLeadChangeSeen] = useState(false);
  const [requestingInspection, setRequestingInspection] = useState(false);
  // "Approvals required" on the requirements tab starts collapsed, like the checklist sections above it.
  const [approvalsOpen, setApprovalsOpen] = useState(false);
  const [viewingInspection, setViewingInspection] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [checklistValues, setChecklistValues] = useState(() => formFromOpp(opp).checklistValues);
  // Permits are the estimator's own read of the job, kept outside the
  // requirements checklist because sales is never asked for them.
  const [permitNotes, setPermitNotes] = useState(() => estimationInputFromOpp(opp).permitNotes);
  const [preSiteInspectionRequired, setPreSiteInspectionRequired] = useState(
    () => formFromOpp(opp).preSiteInspectionRequired,
  );

  useEffect(() => {
    const fresh = formFromOpp(opp);
    setChecklistValues(fresh.checklistValues);
    setPreSiteInspectionRequired(fresh.preSiteInspectionRequired);
    setPermitNotes(estimationInputFromOpp(opp).permitNotes);
    setError("");
  }, [opp]);

  useEffect(() => {
    dispatch(fetchOpportunityAttachments(opp.id));
    dispatch(fetchOpportunityRequests(opp.id));
  }, [opp.id, dispatch]);

  useEffect(() => {
    setLeadChangeSeen(false);
  }, [opp.leadEditedAt]);

  const leadChanged =
    Boolean(opp.leadEditedAt) &&
    !leadChangeSeen &&
    (!opp.leadChangeAcknowledgedAt || new Date(opp.leadEditedAt) > new Date(opp.leadChangeAcknowledgedAt));

  const dismissLeadChange = async () => {
    setLeadChangeSeen(true);
    try {
      await dispatch(acknowledgeLeadChange(opp.id)).unwrap();
    } catch {
      // Cleared on screen either way — the notice is a nudge, not a record.
    }
  };

  const sitePhotos = attachments.filter((a) => a.category === "photo");
  const siteSketches = attachments.filter((a) => a.category === "sketch");
  const drawings = attachments.filter((a) => a.category === DRAWING_CATEGORY);
  const billFiles = attachments.filter((a) => a.category === "bill");

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

  const saveInput = (field, value) =>
    run(async () => {
      await dispatch(collectEstimationInputs({ id: opp.id, body: { input: { [field]: value } } })).unwrap();
    });

  // Which approvals the job will need at stage 5 — estimation marks the list
  // (the lead form no longer asks sales). Stage 5 tracks only these.
  const saveRequiredApprovals = (keys) => run(() => dispatch(updateRequiredApprovals({ id: opp.id, keys })).unwrap());
  // A custom approval: added to this job's list and ticked at once.
  const addCustomApproval = (label) =>
    run(() => dispatch(updateRequiredApprovals({ id: opp.id, keys: requiredKeysOf(opp), custom: [{ label }] })).unwrap());


  const answerPreSite = (required) => {
    setPreSiteInspectionRequired(required);
    run(async () => {
      await dispatch(
        submitEstimatorChecklist({
          id: opp.id,
          body: { checklistValues, preSiteInspectionRequired: required },
        }),
      ).unwrap();
      // The same question sits in the requirements checklist (Site & Inspection) — keep it in step.
      await dispatch(
        collectEstimationInputs({ id: opp.id, body: { input: { preSiteInspectionRequired: required ? "yes" : "no" } } }),
      ).unwrap();
      notify(required ? "Pre-site inspection required" : "No pre-site inspection needed");
    });
  };

  const state = estimationState(opp);
  const status = STATUS_META[state];

  const leadRows = leadMandatoryItems(opp, { billCount: billFiles.length });
  const requirementsChecklistComplete = leadRows.every((row) => row.done);

  // The "does the client need to provide more input?" question is no longer
  // asked: anything more from the client goes through Request / Response. The
  // API still gates the stage on its answer (prestige-be isEstimationReady),
  // so once the requirements checklist is complete it is recorded as "no" —
  // once, by someone who may edit.
  const clientInfoSent = useRef(false);
  useEffect(() => {
    if (!canEdit || !requirementsChecklistComplete || opp.estimationClientInfoNeeded === false || clientInfoSent.current) return;
    clientInfoSent.current = true;
    dispatch(submitEstimationClientInfo({ id: opp.id, body: { needed: false } }));
  }, [canEdit, requirementsChecklistComplete, opp.estimationClientInfoNeeded, opp.id, dispatch]);

  // Resolved when no inspection is needed, or when the estimator has read the
  // findings of the one they asked for and approved them. Operations finishing
  // the visit is not the same thing: the findings are the estimator's to accept.
  const inspections = inspectionRequests(requests);
  const inspection = inspections[0] || null;
  const findingsIn = inspectionDelivered(inspection);
  const findingsApproved = inspectionApproved(inspection);
  const preSiteResolved = preSiteInspectionRequired === false || findingsApproved;
  // What the API asks before the job may leave estimation (prestige-be
  // estimationService.preSiteInspectionBlocker): no inspection needed — the
  // estimator's answer, else the lead's — or the latest one's findings
  // approved. It applies whichever way the client-input question went: a lead
  // that said "inspection: yes" needs it even when no client input was asked
  // for, so the quote and the hand-over wait on it too.
  const needsInspection = preSiteInspectionRequired === true;
  const inspectionCleared = !needsInspection || findingsApproved;
  const inspectionMissing = inspectionCleared
    ? []
    : [inspection ? `Approve the pre-site inspection findings (${requestCode(inspection)})` : "Request the pre-site inspection and approve its findings"];
  // The quote waits on the requirements checklist as well, whichever way the
  // client-input question went.
  const showQuoteBuilder = requirementsChecklistComplete && inspectionCleared && state === "ready";
  // The pre-site visit tab opens once the requirements are in (the estimator
  // decides there whether a visit is needed), or straight away when the lead
  // already said one is.
  const showSiteVisit = requirementsChecklistComplete || needsInspection;

  // One flag per tab, for the tick on the tab and for choosing where to open.
  const requirementsDone = requirementsChecklistComplete;
  const siteVisitDone = showSiteVisit && preSiteResolved;
  const quoteDone = Boolean(quote?.items?.length);

  // Sales sent the job back from proposal: the customer wants changes, and
  // the round (their message, sales' comments, the version they saw) rides
  // on the record until the revised quote is handed back.
  const requote = isRequoteOpen(opp.requote) ? opp.requote : null;

  // Estimation always opens on its first tab, Requirements — the Continue
  // buttons lead on from there. A re-quote opens on the quote it is about.
  const [tab, setTab] = useState(() => (requote && showQuoteBuilder ? "quote" : "requirements"));

  useEffect(() => {
    if (focusHandover) setTab("handover");
  }, [focusHandover]);

  const tabIcon = (done, icon) => (done ? <Check size={14} /> : icon);
  const tabs = [
    { key: "requirements", label: "Requirements", icon: tabIcon(requirementsDone, <ClipboardList size={14} />) },
    { key: "site-visit", label: "Pre-site visit", icon: tabIcon(siteVisitDone, <HardHat size={14} />) },
    { key: "quote", label: "Quote", icon: tabIcon(quoteDone, <Receipt size={14} />) },
    { key: "handover", label: requote ? "Send revised quote" : "Send to proposal", icon: tabIcon(Number(opp.stage) > 2, <Send size={14} />) },
    { key: "requests", label: "Request / Response", icon: <HandHelping size={14} /> },
  ];

  // Why the checklist and site-visit tabs are closed, depending on how far
  // the requirements step got.
  const estimatorLocked = (
    <LockedStep title="Finish the requirements first" body="This opens once the requirements checklist is complete." />
  );

  return (
    <div className="card card-pad">
      <div className="card-head" style={{ justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="card-icon">
            <Calculator size={16} />
          </span>
          <h2>Estimation & validation</h2>
        </div>
        <Badge tone={requote ? "warning" : status.tone}>{requote ? `Re-quote · round ${requote.round}` : status.label}</Badge>
      </div>
      <p className="sub">Solution options, cost build-up, sell price and target margin, verified before a proposal is prepared.</p>

      {requote ? (
        <Alert tone="warning" style={{ marginBottom: 12 }}>
          <strong>Re-quote requested - the customer wants changes.</strong> On the Quote tab, create a new quote from the generated one, revise
          it and generate it as the next version, then hand it back with a note on what changed; sales sends the revised proposal.
          <div style={{ marginTop: 10 }}>
            <RequoteSummary requote={requote} timeZone={unit?.timezone} />
          </div>
        </Alert>
      ) : null}

      {leadChanged ? (
        <Alert tone="warning" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span>
              Some information changed - sales edited the lead pack on{" "}
              {formatDate(opp.leadEditedAt, { withTime: true, timeZone: unit?.timezone })}. Check it before you price
              the job.
            </span>
            <span style={{ display: "flex", gap: 8, marginLeft: "auto" }}>
              {onViewLead ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={onViewLead}>
                  Review the lead pack
                </button>
              ) : null}
              <button type="button" className="btn btn-ghost btn-sm" onClick={dismissLeadChange}>
                Dismiss
              </button>
            </span>
          </div>
        </Alert>
      ) : null}

      <Tabs items={tabs} value={tab} onChange={setTab} />

      {tab === "requirements" ? (
        <>
          <div className="section">
            <LeadInputs
              opp={opp}
              canEdit={canEdit}
              stage={2}
              billFiles={billFiles}
              drawings={drawings}
              sitePhotos={sitePhotos}
              onUploadSitePhotos={canEdit ? uploadSitePhotos : undefined}
              uploadingSitePhotos={uploadingPhotos}
              onUploadDrawings={canEdit ? uploadSiteSketches : undefined}
              uploadingDrawings={uploadingSketches}
            />
          </div>

          <div className="section" style={{ marginTop: 24 }}>
            <div className="input-group-head">
              <button
                type="button"
                className="group-toggle"
                onClick={() => setApprovalsOpen((open) => !open)}
                aria-expanded={approvalsOpen}
              >
                {approvalsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                <h4>Approvals required</h4>
              </button>
              <span>{requiredKeysOf(opp).length} selected</span>
            </div>
            {approvalsOpen ? (
              <div style={{ marginTop: 12 }}>
            <RequiredApprovalsPicker
              unit={jobApprovalUnit(unit, opp)}
              value={requiredKeysOf(opp)}
              onChange={saveRequiredApprovals}
              disabled={!canEdit || saving}
              hints={approvalHints(opp)}
            />
            {canEdit ? (
              <div style={{ marginTop: 10 }}>
                <AddCustomApproval onAdd={addCustomApproval} disabled={saving} placeholder="Any other approvals required" />
              </div>
            ) : null}
            <div style={{ marginTop: 12 }}>
              <Field label="Additional Notes" hint="optional">
                <textarea
                  rows={2}
                  value={permitNotes}
                  disabled={!canEdit || saving}
                  onChange={(e) => setPermitNotes(e.target.value)}
                  // Autosave: the notes go when the box is left.
                  onBlur={() => {
                    if (canEdit && permitNotes !== estimationInputFromOpp(opp).permitNotes) saveInput("permitNotes", permitNotes);
                  }}
                />
              </Field>
              {canEdit && permitNotes !== estimationInputFromOpp(opp).permitNotes ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 8 }}
                  disabled={saving}
                  onClick={() => saveInput("permitNotes", permitNotes)}
                >
                  {saving ? "Saving…" : "Save notes"}
                </button>
              ) : null}
            </div>
              </div>
            ) : null}
          </div>

          <ContinueButton
            style={{ marginTop: 16 }}
            nextLabel={needsInspection && !preSiteResolved ? "Pre-site visit" : "Quote"}
            blockers={leadRows.filter((row) => !row.done).map((row) => row.label)}
            onDone={() => setTab(needsInspection && !preSiteResolved ? "site-visit" : "quote")}
          />
        </>
      ) : null}

      {tab === "requests" ? (
        <StageRequestsPanel
          opp={opp}
          stage={2}
          unit={unit}
          canEdit={canEdit}
          title="Request / Response"
          informationTemplate="site_details"
        />
      ) : null}

      {tab === "site-visit" ? (
        showSiteVisit ? (
          <div className="section">
            <QuestionBlock title="Is a pre-site inspection required?">
              <YesNo value={preSiteInspectionRequired} onChange={answerPreSite} disabled={!canEdit || saving} />
            </QuestionBlock>

            {preSiteInspectionRequired === true ? (
              <>
                <div className="section" style={{ marginTop: 20 }}>
                  <SectionHead icon={<HardHat size={13} />} title="Pre-site inspection request" />
                  {inspection ? (
                    <div className="list-stack">
                      <div className="list-row">
                        <span className="row-title">{requestCode(inspection)} · {inspection.title}</span>
                        <RequestStatusBadge request={inspection} />
                      </div>
                      <div className="list-row">
                        <span className="row-title">Assigned to</span>
                        <span className="row-meta">{inspection.assigneeName || "Operations"}</span>
                      </div>
                      {inspection.scheduledFor ? (
                        <div className="list-row">
                          <span className="row-title">Scheduled for</span>
                          <span className="row-meta">{formatDate(inspection.scheduledFor, { timeZone: unit?.timezone })}</span>
                        </div>
                      ) : null}
                      {inspection.latestUpdate?.note ? (
                        <div className="list-row">
                          <span className="row-title">Latest update</span>
                          <span className="row-meta">{inspection.latestUpdate.note}</span>
                        </div>
                      ) : null}
                      {findingsIn && !findingsApproved ? (
                        <Alert tone="info" style={{ marginTop: 10, marginBottom: 0 }}>
                          The visit is back. Read the findings and approve them - the quote opens once you do.
                        </Alert>
                      ) : null}
                      {findingsApproved ? (
                        <Alert tone="success" style={{ marginTop: 10, marginBottom: 0 }}>
                          Findings approved - the quote is open.
                        </Alert>
                      ) : null}
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                        <button
                          type="button"
                          className={`btn btn-sm ${findingsIn && !findingsApproved ? "btn-primary" : "btn-ghost"}`}
                          onClick={() => setViewingInspection(true)}
                        >
                          {findingsIn && !findingsApproved ? "Review findings" : "Open the request"}
                        </button>
                        {canEdit ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => setRequestingInspection(true)}
                          >
                            <Send size={14} /> Request another inspection
                          </button>
                        ) : null}
                      </div>
                      {inspections.length > 1 ? (
                        <p className="row-meta" style={{ marginTop: 8 }}>
                          {inspections.length} raised on this job - the latest is shown; the rest are on the Request /
                          Response tab.
                        </p>
                      ) : null}
                    </div>
                  ) : (
                    <>
                      <p className="lede" style={{ marginBottom: 12 }}>
                        Request a site visit and Operations will assign a crew member and schedule it. You’ll be
                        notified when it’s scheduled, completed and the report is submitted.
                      </p>
                      {canEdit ? (
                        <button type="button" className="btn btn-primary btn-sm" onClick={() => setRequestingInspection(true)}>
                          <Send size={14} /> Request pre-site inspection
                        </button>
                      ) : null}
                    </>
                  )}
                </div>

                <div className="section" style={{ marginTop: 20, marginBottom: 0 }}>
                  <SectionHead icon={<FileCheck2 size={13} />} title="Site photos, drawings & documents" />
                  <p className="lede" style={{ marginBottom: 12 }}>
                    Anything from the visit - access, electrical conditions, constraints, sketches and reports.
                  </p>
                  <h3>Photos</h3>
                  <FileDropzone files={sitePhotos} onSelect={uploadSitePhotos} disabled={!canEdit} uploading={uploadingPhotos} />
                  <h3 style={{ marginTop: 16 }}>Drawings &amp; documents</h3>
                  <FileDropzone
                    files={siteSketches}
                    onSelect={uploadSiteSketches}
                    disabled={!canEdit}
                    uploading={uploadingSketches}
                  />
                </div>
              </>
            ) : null}

            <ContinueButton
              style={{ marginTop: 16 }}
              nextLabel="Quote"
              blockers={
                showQuoteBuilder
                  ? []
                  : !requirementsChecklistComplete
                    ? ["the requirements checklist"]
                    : inspectionMissing.length
                      ? inspectionMissing
                      : ["estimation to be ready"]
              }
              onDone={() => setTab("quote")}
            />
          </div>
        ) : (
          estimatorLocked
        )
      ) : null}

      {tab === "quote" ? (
        showQuoteBuilder ? (
          <>
            <QuoteBuilder opp={opp} unit={unit} canEdit={canEdit} />
            <ContinueButton
              style={{ marginTop: 16 }}
              nextLabel={requote ? "Send revised quote" : "Send to proposal"}
              blockers={quoteDone ? [] : ["at least one item on the quote"]}
              onDone={() => setTab("handover")}
            />
          </>
        ) : (
          <LockedStep
            title="Quote not open yet"
            body={
              !requirementsChecklistComplete
                ? "The quote opens once the requirements checklist on the first tab is complete."
                : findingsIn && !findingsApproved
                  ? "The pre-site inspection findings are in - approve them on the pre-site visit tab and the quote opens."
                  : needsInspection && !inspection
                    ? "This job needs a pre-site inspection - request it on the pre-site visit tab. The quote opens once its findings are approved."
                    : "The quote opens once estimation is ready - requirements confirmed and, if one is needed, the pre-site inspection approved."
            }
          />
        )
      ) : null}

      {tab === "handover" ? (
        showQuoteBuilder && quoteDone ? (
          <ProposalHandover opp={opp} unit={unit} requote={requote} onSent={onSent} inspectionMissing={inspectionMissing} />
        ) : (
          <LockedStep
            title="Nothing to send yet"
            body="Sending to proposal opens once the quote is created and has at least one priced item."
          />
        )
      ) : null}


      {requestingInspection ? (
        <RequestFormModal
          opportunity={opp}
          stage={2}
          kind="assignment"
          template="pre_site_inspection"
          department="operations"
          people={active}
          onClose={() => setRequestingInspection(false)}
          onSubmit={async (body) => {
            await dispatch(
              createRequest({ opportunityId: opp.id, body: { ...body, title: body.title || "Pre-site inspection" } }),
            ).unwrap();
            notify("Pre-site inspection requested - operations is notified");
          }}
        />
      ) : null}

      {viewingInspection && inspection ? (
        <RequestDetail request={inspection} timeZone={unit?.timezone} onClose={() => setViewingInspection(false)} />
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
