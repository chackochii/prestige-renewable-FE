// One request with its answer shown side by side: what was asked for on the
// left, what came back on the right. Used on a stage's Request / Response tab
// so the estimator reads the answers without opening anything.
//
// Acting on it — responding, accepting, asking for clarification — still goes
// through the detail view, which is where the forms and history live.

import { Download, Paperclip } from "lucide-react";
import Badge from "@/components/Badge";
import RequestStatusBadge from "./RequestStatusBadge";
import {
  contextualAction,
  departmentLabel,
  documentTypeLabel,
  documentUploads,
  priorityMeta,
  REQUEST_KINDS,
  requestCode,
  requestedDocuments,
  statusMeta,
  visibleProgress,
} from "@/constants/collaboration";
import { formatDate } from "@/helpers/dateTimeHelpers";

const NOT_ANSWERED = "Not answered yet";

function AnswerRow({ label, value, answered }) {
  return (
    <div className="rr-row">
      <span className="rr-label">{label}</span>
      <span className={`rr-value${answered ? "" : " is-missing"}`}>{answered ? value : NOT_ANSWERED}</span>
    </div>
  );
}

export default function RequestResponseCard({ request, user, timeZone, onOpen }) {
  const kind = REQUEST_KINDS[request.kind] || REQUEST_KINDS.information;
  const fields = Array.isArray(request.requestedFields) ? request.requestedFields : [];
  const documents = requestedDocuments(request);
  const response = request.response;
  const action = contextualAction(request, user);
  const progress = visibleProgress(request, user);
  const latestProgress = progress[progress.length - 1];

  return (
    <div className="rr-card">
      <div className="rr-head">
        <div style={{ minWidth: 0 }}>
          <div className="row-title">
            {requestCode(request)} · {request.title}
          </div>
          <div className="row-meta">
            {kind.label} · {departmentLabel(request.department)}
            {request.assigneeName ? ` · ${request.assigneeName}` : ""}
            {request.dueAt ? ` · due ${formatDate(request.dueAt, { timeZone })}` : ""}
          </div>
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          <Badge tone={priorityMeta(request.priority).tone}>{priorityMeta(request.priority).label}</Badge>
          <RequestStatusBadge request={request} />
        </div>
      </div>

      {request.description ? <p className="lede rr-description">{request.description}</p> : null}

      {fields.length ? (
        <div className="rr-block">
          <h4>Requested information</h4>
          {fields.map((field) => {
            const value = response?.fields?.[field.key];
            const answered = value !== undefined && value !== null && String(value).trim() !== "";
            return <AnswerRow key={field.key} label={field.label} value={value} answered={answered} />;
          })}
        </div>
      ) : null}

      {documents.length ? (
        <div className="rr-block">
          <h4>Requested photos &amp; documents</h4>
          {documents.map((doc) => {
            const files = documentUploads(request, doc.key);
            return (
              <div className="rr-row" key={doc.key}>
                <span className="rr-label">
                  {doc.label}
                  <small className="row-meta">
                    {documentTypeLabel(doc.type)}
                    {doc.comment ? ` · ${doc.comment}` : ""}
                  </small>
                </span>
                <span className={`rr-value${files.length ? "" : " is-missing"}`}>
                  {files.length ? (
                    files.map((file) => (
                      <a key={file.id} href={file.url} download target="_blank" rel="noreferrer" className="rr-file">
                        <Paperclip size={12} /> {file.filename} <Download size={12} />
                      </a>
                    ))
                  ) : (
                    <>Not supplied yet</>
                  )}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      {response?.note ? (
        <div className="rr-block">
          <h4>Their note</h4>
          <p className="lede" style={{ margin: 0 }}>
            {response.note}
          </p>
        </div>
      ) : null}

      {request.kind === "assignment" && latestProgress ? (
        <div className="rr-block">
          <h4>Latest update</h4>
          <AnswerRow
            label={statusMeta("assignment", latestProgress.status).label}
            value={`${latestProgress.note || "—"}${latestProgress.byName ? ` — ${latestProgress.byName}` : ""}`}
            answered
          />
          {request.scheduledFor ? (
            <AnswerRow label="Scheduled for" value={formatDate(request.scheduledFor, { timeZone })} answered />
          ) : null}
        </div>
      ) : null}

      <div className="rr-foot">
        <span className="row-meta">
          {response?.submittedAt
            ? `Answered by ${response.submittedByName || "—"} on ${formatDate(response.submittedAt, { withTime: true, timeZone })}`
            : `Raised by ${request.createdByName || "—"} on ${formatDate(request.createdAt, { timeZone })}`}
        </span>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpen(request)}>
          {action?.label || "View details"}
        </button>
      </div>
    </div>
  );
}
