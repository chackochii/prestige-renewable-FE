// Stage-2 work: the estimation workflow, as one module split into tabs —
// requirements (from sales, the requirements checklist, client input), the
// estimator checklist, the pre-site visit and the quote. Every tab can be
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

import { useEffect, useState } from "react";
import {
  BadgeDollarSign,
  Calculator,
  Check,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  HardHat,
  HandHelping,
  ListChecks,
  Lock,
  MessageCircleQuestion,
  Receipt,
  Send,
} from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
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
import { requestCode } from "@/constants/collaboration";
import QuoteBuilder from "@/features/pipeline/QuoteBuilder";
import VariationCheck from "@/features/pipeline/VariationCheck";
import { leadMandatoryItems } from "@/helpers/leadChecklist";
import { DRAWING_CATEGORY } from "@/constants/estimationInput";
import { estimationState } from "@/helpers/stageTransition";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { useAppDispatch, useAppSelector } from "@/store";
import { createRequest, fetchOpportunityRequests } from "@/slices/collaborationSlice";
import {
  acknowledgeLeadChange,
  fetchOpportunityAttachments,
  submitEstimationClientInfo,
  submitEstimatorChecklist,
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

const formFromOpp = (opp) => ({
  checklistValues: opp.estimationChecklistValues || {},
  preSiteInspectionRequired: opp.estimationPreSiteInspectionRequired ?? null,
});

export default function EstimationPanel({ opp, unit, canEdit, onViewLead }) {
  const dispatch = useAppDispatch();
  const { notify, error: notifyError } = useNotifications();
  const attachments = useAppSelector((s) => s.leads.attachments);
  const quote = useAppSelector((s) => s.leads.quote);
  const { oppId: collabOppId, byOpp } = useAppSelector((s) => s.collaboration);
  const requests = collabOppId === Number(opp.id) ? byOpp : [];
  const { active, siteOps } = useUnitUsers();
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [uploadingSketches, setUploadingSketches] = useState(false);
  // Sales edited the lead pack after this reached estimation. Dismissing
  // clears it on the record; the local flag hides it straight away.
  const [leadChangeSeen, setLeadChangeSeen] = useState(false);
  const [requestingInspection, setRequestingInspection] = useState(false);
  const [viewingInspection, setViewingInspection] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [checklistValues, setChecklistValues] = useState(() => formFromOpp(opp).checklistValues);
  const [preSiteInspectionRequired, setPreSiteInspectionRequired] = useState(
    () => formFromOpp(opp).preSiteInspectionRequired,
  );

  useEffect(() => {
    const fresh = formFromOpp(opp);
    setChecklistValues(fresh.checklistValues);
    setPreSiteInspectionRequired(fresh.preSiteInspectionRequired);
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

  const answerClientInfo = (needed) => {
    run(() => dispatch(submitEstimationClientInfo({ id: opp.id, body: { needed } })).unwrap());
  };

  const saveEstimatorChecklist = () => {
    run(async () => {
      await dispatch(
        submitEstimatorChecklist({
          id: opp.id,
          body: { checklistValues, preSiteInspectionRequired },
        }),
      ).unwrap();
      notify("Checklist saved");
    });
  };

  const state = estimationState(opp);
  const status = STATUS_META[state];

  const leadRows = leadMandatoryItems(opp, { billCount: billFiles.length });
  const requirementsChecklistComplete = leadRows.every((row) => row.done);

  const showClientInfoGate = requirementsChecklistComplete;
  const showEstimatorChecklist = opp.estimationClientInfoNeeded === true;

  // Resolved when no inspection is needed, or when operations has completed
  // the one that was requested.
  const inspection = requests.find(
    (r) => r.kind === "assignment" && r.department === "operations" && r.status !== "cancelled",
  );
  const inspectionComplete = ["completed", "report_submitted"].includes(inspection?.status);
  const preSiteResolved = preSiteInspectionRequired === false || inspectionComplete;
  const showQuoteBuilder = state === "ready" || (showEstimatorChecklist && preSiteResolved);

  // One flag per tab, for the tick on the tab and for choosing where to open.
  const requirementsDone = requirementsChecklistComplete && opp.estimationClientInfoNeeded != null;
  const siteVisitDone = showEstimatorChecklist && preSiteResolved;
  const quoteDone = Boolean(quote?.items?.length);

  // Open on the first step that still needs work.
  const [tab, setTab] = useState(() => {
    if (!requirementsDone) return "requirements";
    if (showEstimatorChecklist && !siteVisitDone) return "site-visit";
    return showQuoteBuilder ? "quote" : "requirements";
  });

  const tabIcon = (done, icon) => (done ? <Check size={14} /> : icon);
  const tabs = [
    { key: "requirements", label: "Requirements", icon: tabIcon(requirementsDone, <ClipboardList size={14} />) },
    { key: "site-visit", label: "Pre-site visit", icon: tabIcon(siteVisitDone, <HardHat size={14} />) },
    { key: "quote", label: "Quote", icon: tabIcon(quoteDone, <Receipt size={14} />) },
    { key: "requests", label: "Request / Response", icon: <HandHelping size={14} /> },
    { key: "variations", label: "Variations", icon: <BadgeDollarSign size={14} /> },
  ];

  // Why the checklist and site-visit tabs are closed, depending on how far
  // the requirements step got.
  const estimatorLocked =
    opp.estimationClientInfoNeeded === false ? (
      <LockedStep
        title="Not needed for this lead"
        body="The client didn't need to provide more input, so estimation went straight to the quote."
      />
    ) : (
      <LockedStep
        title="Finish the requirements first"
        body="This opens once the requirements checklist is complete and the client input question is answered."
      />
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
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>
      <p className="sub">Solution options, cost build-up, sell price and target margin, verified before a proposal is prepared.</p>

      {onViewLead ? (
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }} onClick={onViewLead}>
          Review the lead pack sales collected
        </button>
      ) : null}

      {leadChanged ? (
        <Alert tone="warning" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span>
              Some information changed — sales edited the lead pack on{" "}
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
            <SectionHead icon={<ListChecks size={13} />} title="Requirements checklist" />
            <LeadInputs
              opp={opp}
              canEdit={canEdit}
              stage={2}
              billFiles={billFiles}
              drawings={drawings}
              sitePhotos={sitePhotos}
            />
          </div>

          {showClientInfoGate ? (
            <div className="section" style={{ marginTop: 24 }}>
              <SectionHead icon={<MessageCircleQuestion size={13} />} title="Client input" />
              <QuestionBlock title="Does the client need to provide more input before this can be estimated?">
                <YesNo value={opp.estimationClientInfoNeeded} onChange={answerClientInfo} disabled={!canEdit || saving} />
              </QuestionBlock>
            </div>
          ) : null}

          {requirementsDone ? (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setTab(showEstimatorChecklist ? "site-visit" : "quote")}
            >
              Continue to {showEstimatorChecklist ? "pre-site visit" : "quote"}
            </button>
          ) : null}
        </>
      ) : null}

      {tab === "requests" ? (
        <StageRequestsPanel
          opp={opp}
          stage={2}
          unit={unit}
          canEdit={canEdit}
          title="Request / Response"
        />
      ) : null}

      {tab === "site-visit" ? (
        showEstimatorChecklist ? (
          <div className="section">
            <QuestionBlock title="Is a pre-site inspection required?">
              <YesNo value={preSiteInspectionRequired} onChange={setPreSiteInspectionRequired} disabled={!canEdit} />
              {canEdit && preSiteInspectionRequired !== formFromOpp(opp).preSiteInspectionRequired ? (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  style={{ marginTop: 12 }}
                  disabled={saving}
                  onClick={saveEstimatorChecklist}
                >
                  Save answer
                </button>
              ) : null}
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
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        style={{ marginTop: 10 }}
                        onClick={() => setViewingInspection(true)}
                      >
                        Open the request
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="lede" style={{ marginBottom: 12 }}>
                        Raise a request so operations can assign a crew member and schedule the visit. You will be
                        notified as they schedule it, complete it and submit their report.
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
                    Anything from the visit — access, electrical conditions, constraints, sketches and reports.
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
          </div>
        ) : (
          estimatorLocked
        )
      ) : null}

      {tab === "quote" ? (
        showQuoteBuilder ? (
          <>
            <QuoteBuilder opp={opp} canEdit={canEdit} />
            {quoteDone ? (
              <button type="button" className="btn btn-primary btn-sm" style={{ marginTop: 16 }} onClick={() => setTab("variations")}>
                Continue to variation check
              </button>
            ) : null}
          </>
        ) : (
          <LockedStep
            title="Quote not open yet"
            body="The quote opens once estimation is ready — requirements confirmed and, if one is needed, the pre-site inspection completed."
          />
        )
      ) : null}

      {tab === "variations" ? (
        showQuoteBuilder && quoteDone ? (
          <VariationCheck opp={opp} canEdit={canEdit} />
        ) : (
          <LockedStep
            title="Nothing to check yet"
            body="The variation check compares the quote with the default price list — create the quote and add items first."
          />
        )
      ) : null}

      {state === "ready" ? (
        <Alert tone="success" style={{ marginTop: 24 }}>
          Estimation is ready to proceed — requirements and client input confirmed
          {preSiteInspectionRequired ? ", pre-site inspection required" : ""}.
        </Alert>
      ) : null}

      {requestingInspection ? (
        <RequestFormModal
          opportunity={opp}
          stage={2}
          kind="assignment"
          department="operations"
          people={siteOps.length ? siteOps : active}
          onClose={() => setRequestingInspection(false)}
          onSubmit={async (body) => {
            await dispatch(
              createRequest({ opportunityId: opp.id, body: { ...body, title: body.title || "Pre-site inspection" } }),
            ).unwrap();
            notify("Pre-site inspection requested — operations is notified");
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
