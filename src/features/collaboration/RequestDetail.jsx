// One request or assignment, opened from wherever it was listed — the
// dashboard, the assigned list or a stage panel. What it offers depends on
// who is looking:
//
//   the assignee   → the response form, or the assignment progress form
//   the requester  → the response read-only, with accept / ask for clarification
//   anyone else    → the same read-only view, with no actions
//
// It never sends anyone into another department's module.

import { useEffect, useState } from "react";
import { Check, Clock, Download, FolderInput, MessageCircleQuestion, Paperclip, X } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Field from "@/components/Field";
import LoadingState from "@/components/LoadingState";
import Modal from "@/components/Modal";
import ProgressForm from "./ProgressForm";
import ResponseForm from "./ResponseForm";
import RequestStatusBadge from "./RequestStatusBadge";
import {
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
  statusMeta,
  visibleProgress,
} from "@/constants/collaboration";
import { stageById } from "@/constants/stages";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  addProgress,
  cancelRequest,
  decideResponse,
  fetchRequestHistory,
  fileAttachmentOnOpportunity,
  submitResponse,
  uploadRequestAttachment,
} from "@/slices/collaborationSlice";

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

export default function RequestDetail({ request, onClose, timeZone }) {
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const { notify, error: notifyError } = useNotifications();
  const { history, historyStatus } = useAppSelector((s) => s.collaboration);
  const [uploading, setUploading] = useState(null);
  const [filing, setFiling] = useState(null);
  const [clarifying, setClarifying] = useState(false);
  const [clarification, setClarification] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (request?.id) dispatch(fetchRequestHistory(request.id));
  }, [request?.id, dispatch]);

  if (!request) return null;

  const kind = REQUEST_KINDS[request.kind] || REQUEST_KINDS.information;
  const response = request.response;
  const progress = visibleProgress(request, user);
  const fields = Array.isArray(request.requestedFields) ? request.requestedFields : [];

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

  const decide = async (outcome) => {
    if (outcome === "clarification_required" && !clarification.trim()) {
      setClarifying(true);
      return;
    }
    setBusy(true);
    try {
      await dispatch(
        decideResponse({ id: request.id, body: { outcome, note: clarification.trim() || undefined } }),
      ).unwrap();
      notify(outcome === "accepted" ? "Response accepted" : "Clarification requested");
      onClose?.();
    } catch (err) {
      notifyError(errText(err, "Could not record that."));
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
          {canCancel(request, user) ? (
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
                <MessageCircleQuestion size={14} /> Request clarification
              </button>
              <button type="button" className="btn btn-primary" onClick={() => decide("accepted")} disabled={busy}>
                <Check size={14} /> Accept response
              </button>
            </>
          ) : null}
        </>
      }
    >
      <div className="request-detail">
        <div className="request-detail-head">
          <RequestStatusBadge request={request} />
          <Badge tone={priorityMeta(request.priority).tone}>{priorityMeta(request.priority).label}</Badge>
          {request.stage ? <Badge tone="neutral">{stageById(request.stage).label}</Badge> : null}
        </div>

        <div className="list-stack">
          <Fact label="Raised by" value={request.createdByName} />
          <Fact label="Assigned to" value={request.assigneeName || departmentLabel(request.department)} />
          <Fact label="Requested" value={formatDate(request.createdAt, { withTime: true, timeZone })} />
          <Fact label="Due" value={request.dueAt ? formatDate(request.dueAt, { timeZone }) : "No date set"} />
          {request.kind === "assignment" ? (
            <Fact
              label="Scheduled for"
              value={request.scheduledFor ? formatDate(request.scheduledFor, { timeZone }) : "Not scheduled yet"}
            />
          ) : null}
        </div>

        {request.description ? (
          <div className="section" style={{ marginTop: 18, marginBottom: 0 }}>
            <h3>{request.kind === "assignment" ? "What was asked for" : "Why it was asked for"}</h3>
            <p className="lede">{request.description}</p>
          </div>
        ) : null}

        {/* ---- The response, read-only for everyone but the responder ---- */}
        {response?.submittedAt ? (
          <div className="section" style={{ marginTop: 18, marginBottom: 0 }}>
            <h3>Response</h3>
            <p className="lede" style={{ marginBottom: 10 }}>
              Submitted by {response.submittedByName || "—"} on{" "}
              {formatDate(response.submittedAt, { withTime: true, timeZone })}
            </p>
            <div className="list-stack">
              {fields.map((field) => (
                <Fact key={field.key} label={field.label} value={response.fields?.[field.key]} />
              ))}
              {response.note ? <Fact label="Note" value={response.note} /> : null}
            </div>
          </div>
        ) : null}

        {/* ---- Photos and documents that were asked for ---- */}
        {requestedDocuments(request).length || response?.attachments?.length ? (
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

        {clarifying && canDecide(request, user) ? (
          <div className="decision-card">
            <Field label="What needs clarifying?">
              <textarea rows={2} value={clarification} onChange={(e) => setClarification(e.target.value)} />
            </Field>
            <div className="decision-actions" style={{ marginTop: 12 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => decide("clarification_required")}
                disabled={busy || !clarification.trim()}
              >
                Send back for clarification
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
                    <span>
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
            <ProgressForm
              request={request}
              onSubmit={progressUpdate}
              onUpload={upload("report")}
              uploading={uploading}
            />
          </div>
        ) : null}

        {!canRespond(request, user) && !canProgress(request, user) && !canDecide(request, user) ? (
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
                  <span>
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
