// One request or assignment, opened from wherever it was listed — the
// dashboard, the assigned list or a stage panel. What it offers depends on
// who is looking:
//
//   the assignee   → the response form, the assignment progress form, or —
//                    on an approval request — approve / reject with notes
//   the requester  → the response read-only, with accept / ask for clarification
//   anyone else    → the same read-only view, with no actions
//
// It never sends anyone into another department's module.

import { useEffect, useState } from "react";
import {
  Check,
  Clock,
  Download,
  FolderInput,
  MessageCircleQuestion,
  Paperclip,
  ThumbsDown,
  X,
} from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Field from "@/components/Field";
import LoadingState from "@/components/LoadingState";
import Modal from "@/components/Modal";
import ProgressForm from "./ProgressForm";
import SiteVisitSummary from "./SiteVisitSummary";
import SiteVisitTaskForm from "./SiteVisitTaskForm";
import ResponseForm from "./ResponseForm";
import RequestStatusBadge from "./RequestStatusBadge";
import {
  canApprove,
  canCancel,
  canDecide,
  canProgress,
  canRespond,
  departmentLabel,
  documentUploads,
  FILING_CATEGORIES,
  isRequester,
  priorityMeta,
  REQUEST_KINDS,
  requestCode,
  requestedDocuments,
  siteVisitTask,
  statusMeta,
  visibleProgress,
} from "@/constants/collaboration";
import { estimationInputFromAnswers } from "@/constants/estimationInput";
import { stageById } from "@/constants/stages";
import { formatDate, hasClockTime, sameInstant } from "@/helpers/dateTimeHelpers";
import { useAuth } from "@/hooks/useAuth";
import { useUnitUsers } from "@/hooks/useUnitUsers";
import { useNotifications } from "@/hooks/useNotifications";
import { useAppDispatch, useAppSelector } from "@/store";
import { collectEstimationInputs } from "@/slices/leadsSlice";
import {
  addProgress,
  cancelRequest,
  closeRequest,
  decideResponse,
  deleteSiteVisitPhoto,
  openRequest,
  saveSiteVisitTask,
  fetchRequestHistory,
  fileAttachmentOnOpportunity,
  submitResponse,
  uploadRequestAttachment,
} from "@/slices/collaborationSlice";
import { fetchProcurementJob } from "@/slices/procurementSlice";

const errText = (err, fallback) => (typeof err === "string" ? err : err?.message || fallback);

/**
 * One supplied file: open or download it, and — for the person who asked for
 * it — file a copy into the job's own attachments so they can work with it.
 */
function FileRow({ file, canFile, filing, onFile }) {
  const [category, setCategory] = useState(FILING_CATEGORIES[0].key);
  return (
    <div className="list-row document-file">
      <span style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
        <Paperclip size={14} />
        <a href={file.url} target="_blank" rel="noreferrer" className="row-title">
          {file.filename}
        </a>
      </span>
      <span style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <a href={file.url} download className="btn btn-ghost btn-sm" target="_blank" rel="noreferrer">
          <Download size={14} /> Download
        </a>
        {canFile ? (
          <>
            <select
              className="select"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label={`Where to file ${file.filename}`}
            >
              {FILING_CATEGORIES.map((c) => (
                <option key={c.key} value={c.key}>
                  {c.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              disabled={filing}
              onClick={() => onFile(file, category)}
            >
              <FolderInput size={14} /> {filing ? "Filing…" : "File on job"}
            </button>
          </>
        ) : null}
      </span>
    </div>
  );
}

/** One answer as it reads: a signature is a data URL, a tick box a yes or no. */
function answerText(field, value) {
  if (value === undefined || value === null || value === "") return "";
  if (field?.kind === "signature") return "Signed";
  if (field?.kind === "checkbox" || typeof value === "boolean") return value ? "Yes" : "No";
  return String(value);
}

function Fact({ label, value }) {
  return (
    <div className="list-row">
      <span className="row-title">{label}</span>
      <span className="row-meta" style={{ textAlign: "right", maxWidth: "62%" }}>
        {value || "—"}
      </span>
    </div>
  );
}

/**
 * `request` is the row it was opened from. What is shown is the store's copy
 * of it (collaborationSlice `open`), which every action here replaces with the
 * API's answer — so a form link just created, a file just uploaded, a progress
 * update or a deleted photo shows at once, instead of the modal still showing
 * the row as it was when clicked (and people doing it again).
 */
export default function RequestDetail({ request: opened, onClose, timeZone }) {
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const { active, siteOps } = useUnitUsers();
  const { notify, error: notifyError } = useNotifications();
  const { history, historyStatus } = useAppSelector((s) => s.collaboration);
  const held = useAppSelector((s) => (opened?.id && s.collaboration.open?.id === opened.id ? s.collaboration.open : null));
  const request = held ?? opened;

  useEffect(() => {
    if (!opened?.id) return undefined;
    dispatch(openRequest(opened));
    return () => dispatch(closeRequest(opened.id));
    // Only when a different request opens: the store's copy is fresher than the row passed in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opened?.id, dispatch]);
  const [uploading, setUploading] = useState(null);
  const [filing, setFiling] = useState(null);
  const [clarifying, setClarifying] = useState(false);
  const [clarification, setClarification] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (request?.id) dispatch(fetchRequestHistory(request.id));
  }, [request?.id, dispatch]);

  if (!request) return null;

  const kind = REQUEST_KINDS[request.kind] || REQUEST_KINDS.information;
  const response = request.response;
  const progress = visibleProgress(request, user);
  const fields = Array.isArray(request.requestedFields) ? request.requestedFields : [];
  // A site visit whose findings have come back, seen by the person who asked
  // for it: they approve them or send them back, the same way a response to an
  // information request is accepted or queried.
  const decidingFindings = request.kind === "assignment" && canDecide(request, user);

  const upload = (category) => async (files, documentKey) => {
    setUploading(documentKey || (category === "report" ? "report" : "other"));
    try {
      for (const file of files) {
        await dispatch(uploadRequestAttachment({ id: request.id, category, file, documentKey })).unwrap();
      }
    } catch (err) {
      notifyError(errText(err, "Could not upload the file."));
    } finally {
      setUploading(null);
    }
  };

  /** Copies a supplied file into the job itself, so it lands in the estimator's own fields. */
  const fileOnJob = async (attachment, category) => {
    if (!category) return;
    setFiling(attachment.id);
    try {
      await dispatch(
        fileAttachmentOnOpportunity({ id: request.id, body: { attachmentId: attachment.id, category } }),
      ).unwrap();
      notify(`${attachment.filename} filed on the job`);
    } catch (err) {
      notifyError(errText(err, "Could not file the document on the job."));
    } finally {
      setFiling(null);
    }
  };

  const respond = async (body) => {
    await dispatch(submitResponse({ id: request.id, body })).unwrap();
    notify(body.draft ? "Draft saved" : "Response submitted");
    if (!body.draft) onClose?.();
  };

  const progressUpdate = async (body) => {
    await dispatch(addProgress({ id: request.id, body })).unwrap();
    await dispatch(fetchRequestHistory(request.id));
    notify("Update submitted");
  };

  const removeSiteVisitPhoto = async (photoId) => {
    await dispatch(deleteSiteVisitPhoto({ id: request.id, photoId })).unwrap();
    notify("Photo deleted");
  };

  const saveSiteVisit = async ({ scheduledFor, ...body }) => {
    // Compared as moments, not strings: the form's "2026-10-07" and the stored
    // "2026-10-07T00:00:00.000Z" are the same day, and treating them as a
    // change sent a progress update the API refused ("add a note, move the
    // status on…") — so the form could not be re-saved at all.
    if (scheduledFor && !sameInstant(scheduledFor, request.scheduledFor)) {
      await dispatch(addProgress({ id: request.id, body: { status: request.status, scheduledFor } })).unwrap();
    }
    await dispatch(saveSiteVisitTask({ id: request.id, body })).unwrap();
    notify("Site-visit form saved — copy the link and send it over");
  };

  /**
   * Accepting a response puts what sales sent back on to the job, so the
   * estimator reads it in their own checklist rather than copying it across
   * from this modal by hand. Only the answers that map to estimation-input
   * fields are written; anything else stays on the request.
   */
  const fillJobFromResponse = async () => {
    const input = estimationInputFromAnswers(response?.fields);
    if (!Object.keys(input).length || !request.opportunityId) return 0;
    await dispatch(collectEstimationInputs({ id: request.opportunityId, body: { input } })).unwrap();
    return Object.keys(input).length;
  };

  const decide = async (outcome) => {
    // Anything other than a straight yes needs a reason: the assignee is being
    // asked to do more, so they have to be told what.
    if (outcome !== "accepted" && !clarification.trim()) {
      setClarifying(true);
      return;
    }
    setBusy(true);
    try {
      await dispatch(
        decideResponse({ id: request.id, body: { outcome, note: clarification.trim() || undefined } }),
      ).unwrap();
      let filled = 0;
      if (outcome === "accepted" && request.kind === "information") {
        try {
          filled = await fillJobFromResponse();
        } catch {
          // The response is accepted either way; the estimator can still read
          // it here and the checklist can be filled by hand.
          notifyError("Accepted, but the answers could not be copied on to the job.");
        }
      }
      notify(
        outcome === "accepted"
          ? decidingFindings
            ? "Findings approved"
            : filled
              ? `Response accepted — ${filled} item${filled === 1 ? "" : "s"} filled in on the job`
              : "Response accepted"
          : decidingFindings
            ? "Sent back to operations"
            : "Clarification requested",
      );
      onClose?.();
    } catch (err) {
      notifyError(errText(err, "Could not record that."));
    } finally {
      setBusy(false);
    }
  };

  /** The approver's answer — recorded on the job's price-variation approval too. */
  const decideApproval = async (outcome) => {
    if (outcome === "rejected" && !approvalNote.trim()) {
      notifyError("Add a note saying why it is rejected.");
      return;
    }
    setBusy(true);
    try {
      await dispatch(
        decideResponse({ id: request.id, body: { outcome, note: approvalNote.trim() || undefined } }),
      ).unwrap();
      // The procurement approvals tab reads the job, which the decision just changed.
      if (request.opportunityId) dispatch(fetchProcurementJob(request.opportunityId));
      notify(outcome === "approved" ? "Approved" : "Rejected");
      onClose?.();
    } catch (err) {
      notifyError(errText(err, "Could not record the decision."));
    } finally {
      setBusy(false);
    }
  };

  const cancel = async () => {
    setBusy(true);
    try {
      await dispatch(cancelRequest({ id: request.id, body: { reason: "No longer needed" } })).unwrap();
      notify("Request cancelled", "info");
      onClose?.();
    } catch (err) {
      notifyError(errText(err, "Could not cancel the request."));
    } finally {
      setBusy(false);
    }
  };

  // The visit has come back, so there is something to submit rather than
  // just another note to log.
  const visit = siteVisitTask(request);
  const visitGathered = Boolean(visit?.submittedAt || visit?.status === "submitted");

  return (
    <Modal
      title={`${requestCode(request)} · ${request.title}`}
      body={`${kind.label} · ${departmentLabel(request.department)} · ${request.opportunityNumber || ""} ${request.opportunityName || ""}`.trim()}
      className="document"
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Close
          </button>
          {/* Once there is something to decide on, that is the action — a
              request with its findings in is approved or sent back, not cancelled. */}
          {canCancel(request, user) && !canDecide(request, user) ? (
            <button type="button" className="btn btn-danger" onClick={cancel} disabled={busy}>
              <X size={14} /> Cancel request
            </button>
          ) : null}
          {canDecide(request, user) ? (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setClarifying((c) => !c)}
                disabled={busy}
              >
                {decidingFindings ? <ThumbsDown size={14} /> : <MessageCircleQuestion size={14} />}{" "}
                {decidingFindings ? "Reject" : "Request clarification"}
              </button>
              <button type="button" className="btn btn-primary" onClick={() => decide("accepted")} disabled={busy}>
                <Check size={14} /> {decidingFindings ? "Approve findings" : "Accept response"}
              </button>
            </>
          ) : null}
        </>
      }
    >
      <div className="request-detail">
        <div className="request-detail-head">
          <RequestStatusBadge request={request} />
          {request.stage ? <Badge tone="neutral">{stageById(request.stage).label}</Badge> : null}
        </div>

        <dl className="detail-strip">
          <div>
            <dt>Priority</dt>
            <dd>
              <Badge tone={priorityMeta(request.priority).tone}>{priorityMeta(request.priority).label}</Badge>
            </dd>
          </div>
          <div>
            <dt>Raised by</dt>
            <dd>{request.createdByName || "—"}</dd>
          </div>
          <div>
            <dt>Assigned to</dt>
            <dd>{request.assigneeName || departmentLabel(request.department)}</dd>
          </div>
          <div>
            <dt>Requested</dt>
            <dd>{formatDate(request.createdAt, { withTime: true, timeZone })}</dd>
          </div>
          <div>
            <dt>Due</dt>
            <dd>
              {request.dueAt ? formatDate(request.dueAt, { withTime: hasClockTime(request.dueAt), timeZone }) : "—"}
            </dd>
          </div>
          {request.kind === "assignment" ? (
            <div>
              <dt>Scheduled</dt>
              <dd>
                {request.scheduledFor
                  ? formatDate(request.scheduledFor, { withTime: hasClockTime(request.scheduledFor), timeZone })
                  : "Not yet"}
              </dd>
            </div>
          ) : null}
        </dl>

        {request.kind !== "assignment" && request.description ? (
          <div className="section" style={{ marginTop: 18, marginBottom: 0 }}>
            <h3>Why it was asked for</h3>
            <p className="lede">{request.description}</p>
          </div>
        ) : null}

        {/* The visit itself, where the brief used to be: who is going, when,
            the link to hand them, and the way into what it has to bring back. */}
        {canProgress(request, user) && request.kind === "assignment" ? (
          <SiteVisitTaskForm
            request={request}
            people={siteOps.length ? siteOps : active}
            onSave={saveSiteVisit}
            onDeletePhoto={removeSiteVisitPhoto}
            timeZone={timeZone}
          />
        ) : null}

        {/* ---- What was asked for, and what has come back against it ----
            Shown whether or not there is a response yet: the requester wants
            to see the items they asked for while they are still waiting, not
            only once they are answered. */}
        {/* ---- An approval request: the decision, or the approver's form ---- */}
        {request.kind === "approval" && canApprove(request, user) ? (
          <div className="decision-card" style={{ marginTop: 18 }}>
            <Field label="Notes" hint="required to reject — the requester and the procurement approvals tab show this">
              <textarea rows={3} value={approvalNote} onChange={(e) => setApprovalNote(e.target.value)} />
            </Field>
            <div className="decision-actions" style={{ marginTop: 12, display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={() => decideApproval("approved")} disabled={busy}>
                <Check size={14} /> Approve
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => decideApproval("rejected")}
                disabled={busy || !approvalNote.trim()}
              >
                <ThumbsDown size={14} /> Reject
              </button>
            </div>
          </div>
        ) : request.kind === "approval" ? (
          <div className="section" style={{ marginTop: 18, marginBottom: 0 }}>
            <h3>Decision</h3>
            {response?.submittedAt ? (
              <div className="list-stack">
                <Fact
                  label={statusMeta("approval", request.status).label}
                  value={`${response.submittedByName || "—"} · ${formatDate(response.submittedAt, { withTime: true, timeZone })}`}
                />
                {response.note ? <Fact label="Notes" value={response.note} /> : null}
              </div>
            ) : (
              <p className="lede">Waiting on {request.assigneeName || "the approver"}.</p>
            )}
          </div>
        ) : null}

        {request.kind === "information" && !canRespond(request, user) && (fields.length || response?.submittedAt) ? (
          <div className="section" style={{ marginTop: 18, marginBottom: 0 }}>
            <h3>Information requested</h3>
            <p className="lede" style={{ marginBottom: 10 }}>
              {response?.submittedAt
                ? `Submitted by ${response.submittedByName || "—"} on ${formatDate(response.submittedAt, { withTime: true, timeZone })}`
                : `Waiting on ${request.assigneeName || departmentLabel(request.department)}.`}
            </p>
            <div className="list-stack">
              {fields.map((field) => {
                const answer = answerText(field, response?.fields?.[field.key]);
                return (
                  <div className="list-row" key={field.key}>
                    <span className="row-title">{field.label}</span>
                    <span className={answer ? "row-title answer-filled" : "row-meta"}>
                      {answer || "Not answered yet"}
                    </span>
                  </div>
                );
              })}
              {response?.note ? <Fact label="Note" value={response.note} /> : null}
            </div>
          </div>
        ) : null}

        {/* ---- Photos and documents that were asked for ---- */}
        {!canRespond(request, user) && (requestedDocuments(request).length || response?.attachments?.length) ? (
          <div className="section" style={{ marginTop: 18, marginBottom: 0 }}>
            <h3>Photos &amp; documents</h3>
            {requestedDocuments(request).map((doc) => {
              const files = documentUploads(request, doc.key);
              return (
                <div key={doc.key} className="document-slot">
                  <div className="document-slot-head">
                    <span className="row-title">{doc.label}</span>
                    <Badge tone={files.length ? "success" : "warning"}>
                      {files.length ? `${files.length} supplied` : "Not supplied yet"}
                    </Badge>
                  </div>
                  {files.map((file) => (
                    <FileRow
                      key={file.id}
                      file={file}
                      canFile={isRequester(request, user)}
                      filing={filing === file.id}
                      onFile={fileOnJob}
                    />
                  ))}
                </div>
              );
            })}

            {(response?.attachments || []).filter((f) => !f.documentKey).length ? (
              <div className="document-slot">
                <div className="document-slot-head">
                  <span className="row-title">Other files</span>
                </div>
                {(response?.attachments || [])
                  .filter((f) => !f.documentKey)
                  .map((file) => (
                    <FileRow
                      key={file.id}
                      file={file}
                      canFile={isRequester(request, user)}
                      filing={filing === file.id}
                      onFile={fileOnJob}
                    />
                  ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {request.kind === "assignment" && !canProgress(request, user) ? (
          <SiteVisitSummary request={request} timeZone={timeZone} />
        ) : null}

        {/* The findings are in and this is the person who asked for them: the
            job cannot be priced until they say these answer the question. */}
        {decidingFindings ? (
          <Alert tone="info" style={{ marginTop: 18, marginBottom: 0 }}>
            The visit is back. Approve the findings to open the quote, or reject them with a note on what is still
            needed and operations will send someone again.
          </Alert>
        ) : null}

        {clarifying && canDecide(request, user) ? (
          <div className="decision-card">
            <Field
              label={decidingFindings ? "Why is it going back?" : "What needs clarifying?"}
              hint={decidingFindings ? "Operations sees this, so say what is missing or has to be re-checked." : undefined}
              required
            >
              <textarea rows={2} value={clarification} onChange={(e) => setClarification(e.target.value)} />
            </Field>
            <div className="decision-actions" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => decide(decidingFindings ? "returned" : "clarification_required")}
                disabled={busy || !clarification.trim()}
              >
                {decidingFindings ? "Reject and send back" : "Send back for clarification"}
              </button>
            </div>
          </div>
        ) : null}

        {/* ---- Progress, read-only for the requester ---- */}
        {request.kind === "assignment" && progress.length ? (
          <div className="section" style={{ marginTop: 18, marginBottom: 0 }}>
            <h3>Progress</h3>
            <div className="list-stack">
              {progress.map((entry) => (
                <div key={entry.id} className="list-row">
                  <span style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
                    <span className="status-icon current">
                      <Clock size={14} />
                    </span>
                    <span className="row-lines">
                      <span className="row-title">{statusMeta("assignment", entry.status).label}</span>
                      {entry.note ? <span className="row-meta">{entry.note}</span> : null}
                    </span>
                  </span>
                  <span className="row-meta">
                    {entry.byName ? `${entry.byName} · ` : ""}
                    {formatDate(entry.at, { withTime: true, timeZone })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {/* ---- Actions for whoever holds it ---- */}
        {canRespond(request, user) ? (
          <div style={{ marginTop: 18 }}>
            <ResponseForm
              request={request}
              onSubmit={respond}
              onUpload={upload("attachment")}
              uploading={uploading}
            />
          </div>
        ) : null}

        {canProgress(request, user) ? (
          <div style={{ marginTop: 18 }}>
            <ProgressForm request={request} onSubmit={progressUpdate} gathered={visitGathered} />
          </div>
        ) : null}

        {!canRespond(request, user) && !canProgress(request, user) && !canDecide(request, user) && !canApprove(request, user) ? (
          <Alert tone="info" style={{ marginTop: 18, marginBottom: 0 }}>
            You are seeing this because it belongs to a job you work on. Only{" "}
            {request.assigneeName || departmentLabel(request.department)} can act on it.
          </Alert>
        ) : null}

        {/* ---- History ---- */}
        <div className="section" style={{ marginTop: 20, marginBottom: 0 }}>
          <h3>Activity history</h3>
          {historyStatus === "loading" ? (
            <LoadingState label="Loading history…" />
          ) : history.length ? (
            <div className="list-stack">
              {history.map((entry) => (
                <div key={entry.id} className="list-row">
                  <span className="row-lines">
                    <span className="row-title">{entry.action}</span>
                    {entry.detail ? <span className="row-meta">{entry.detail}</span> : null}
                  </span>
                  <span className="row-meta">
                    {entry.byName ? `${entry.byName} · ` : ""}
                    {formatDate(entry.at, { withTime: true, timeZone })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="lede">No activity recorded yet.</p>
          )}
        </div>
      </div>
    </Modal>
  );
}
