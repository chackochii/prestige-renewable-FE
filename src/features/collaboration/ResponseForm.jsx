// The response form Sales sees: one input per thing the requester asked for,
// and nothing else on the form that nobody asked for. A draft is private to
// the responder; submitting sends it back and notifies whoever raised it.

import { useState } from "react";
import { Send, Save } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Field from "@/components/Field";
import FileDropzone from "@/components/FileDropzone";
import { documentTypeLabel, documentUploads, requestedDocuments } from "@/constants/collaboration";
import { isBlank } from "@/utils/validators";

/** Where a free answer goes when the request named no individual items. */
const FREE_ANSWER = [{ key: "response", label: "Your response" }];

const errText = (err, fallback) => (typeof err === "string" ? err : err?.message || fallback);

export default function ResponseForm({ request, onSubmit, onUpload, uploading = null }) {
  const asked = Array.isArray(request.requestedFields) ? request.requestedFields : [];
  // One input per item asked for; a single one when nothing specific was.
  const fields = asked.length ? asked : FREE_ANSWER;
  const documents = requestedDocuments(request);
  const [values, setValues] = useState(() => ({ ...(request.response?.fields || {}) }));
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(null); // "draft" | "submit"

  const set = (key, value) => setValues((v) => ({ ...v, [key]: value }));

  const send = async (draft) => {
    if (!draft) {
      const missing = fields.filter((f) => isBlank(values[f.key]));
      if (missing.length) {
        setError(`Still needed: ${missing.map((f) => f.label).join(", ")}.`);
        return;
      }
    }
    setBusy(draft ? "draft" : "submit");
    setError("");
    try {
      await onSubmit({ fields: values, note: request.response?.note || "", draft });
    } catch (err) {
      setError(errText(err, "Could not send the response."));
    } finally {
      setBusy(null);
    }
  };

  const control = (field) => (
    <input type="text" value={values[field.key] ?? ""} onChange={(e) => set(field.key, e.target.value)} />
  );

  return (
    <div className="section" style={{ marginBottom: 0 }}>
      <h3>Your response</h3>
      {request.status === "clarification_required" ? (
        <Alert tone="warning">
          Clarification asked for: {request.clarificationNote || "see the history below"}.
        </Alert>
      ) : null}

      <div className="form-grid">
        {fields.map((field) => (
          <Field key={field.key} label={field.label} className="span-2">
            {control(field)}
          </Field>
        ))}
      </div>

      {documents.length ? (
        <div style={{ marginTop: 14 }}>
          <h3>Photos &amp; documents asked for</h3>
          {documents.map((doc) => {
            const files = documentUploads(request, doc.key);
            return (
              <div key={doc.key} className="document-slot">
                <div className="document-slot-head">
                  <span className="row-title">
                    {doc.label} <Badge tone="neutral">{documentTypeLabel(doc.type)}</Badge>
                  </span>
                  <Badge tone={files.length ? "success" : "warning"}>
                    {files.length ? `${files.length} uploaded` : "Not supplied"}
                  </Badge>
                </div>
                {doc.comment ? (
                  <p className="lede" style={{ margin: "0 0 8px" }}>
                    {doc.comment}
                  </p>
                ) : null}
                {onUpload ? (
                  <FileDropzone
                    files={files}
                    onSelect={(selected) => onUpload(selected, doc.key)}
                    uploading={uploading === doc.key}
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      ) : null}

      {error ? (
        <Alert tone="danger" style={{ marginTop: 14, marginBottom: 0 }}>
          {error}
        </Alert>
      ) : null}

      <div className="decision-actions" style={{ marginTop: 16 }}>
        <button type="button" className="btn btn-ghost" onClick={() => send(true)} disabled={busy !== null}>
          <Save size={14} /> {busy === "draft" ? "Saving…" : "Save draft"}
        </button>
        <button type="button" className="btn btn-primary" onClick={() => send(false)} disabled={busy !== null}>
          <Send size={14} /> {busy === "submit" ? "Sending…" : "Submit response"}
        </button>
      </div>
      <p className="lede" style={{ marginTop: 10, marginBottom: 0 }}>
        A draft stays with you. Submitting sends it to {request.createdByName || "the requester"} and marks the request
        as responded.
      </p>
    </div>
  );
}
