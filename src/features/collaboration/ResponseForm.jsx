// The response form Sales sees: exactly the fields the requester asked for,
// nothing else. A draft is private to the responder; submitting sends it back
// and notifies whoever raised the request.

import { useState } from "react";
import { Send, Save } from "lucide-react";
import Alert from "@/components/Alert";
import Field from "@/components/Field";
import FileDropzone from "@/components/FileDropzone";
import NumberInput from "@/components/NumberInput";
import { isBlank } from "@/utils/validators";

const errText = (err, fallback) => (typeof err === "string" ? err : err?.message || fallback);

export default function ResponseForm({ request, onSubmit, onUpload, uploading = false }) {
  const fields = Array.isArray(request.requestedFields) ? request.requestedFields : [];
  const [values, setValues] = useState(() => ({ ...(request.response?.fields || {}) }));
  const [note, setNote] = useState(request.response?.note || "");
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
      await onSubmit({ fields: values, note: note.trim(), draft });
    } catch (err) {
      setError(errText(err, "Could not send the response."));
    } finally {
      setBusy(null);
    }
  };

  const control = (field) => {
    const value = values[field.key] ?? "";
    if (field.type === "textarea")
      return <textarea rows={3} value={value} onChange={(e) => set(field.key, e.target.value)} />;
    if (field.type === "number") return <NumberInput value={value} onChange={(v) => set(field.key, v)} />;
    if (field.type === "date")
      return <input type="date" value={value} onChange={(e) => set(field.key, e.target.value)} />;
    return <input type="text" value={value} onChange={(e) => set(field.key, e.target.value)} />;
  };

  return (
    <div className="section" style={{ marginBottom: 0 }}>
      <h3>Your response</h3>
      {request.status === "clarification_required" ? (
        <Alert tone="warning">
          Clarification asked for: {request.clarificationNote || "see the history below"}.
        </Alert>
      ) : null}

      {fields.length ? (
        <div className="form-grid">
          {fields.map((field) => (
            <Field
              key={field.key}
              label={field.label}
              className={field.type === "textarea" ? "span-2" : undefined}
            >
              {control(field)}
            </Field>
          ))}
        </div>
      ) : (
        <p className="lede">No specific fields were asked for — answer in the note below.</p>
      )}

      <Field label="Note" hint="optional" className="span-2">
        <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>

      {onUpload ? (
        <div style={{ marginTop: 14 }}>
          <h3>Attachments</h3>
          <FileDropzone files={request.response?.attachments || []} onSelect={onUpload} uploading={uploading} />
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
