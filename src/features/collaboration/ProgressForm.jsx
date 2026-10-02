// The running note on an assignment: where it is up to and what happened. A
// note marked internal stays inside their department and is never shown to
// the requester.
//
// Who is attending, when the visit is scheduled and what it has to bring back
// all live on the site-visit screen above this one.

import { useState } from "react";
import { Send } from "lucide-react";
import Alert from "@/components/Alert";
import Field from "@/components/Field";
import { nextAssignmentStatuses, statusMeta } from "@/constants/collaboration";
import { isBlank } from "@/utils/validators";

const errText = (err, fallback) => (typeof err === "string" ? err : err?.message || fallback);

export default function ProgressForm({ request, onSubmit, gathered = false }) {
  const [status, setStatus] = useState(request.status);
  const [note, setNote] = useState("");
  const [internal, setInternal] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const options = nextAssignmentStatuses(request.status);

  const submit = async () => {
    if (status === request.status && isBlank(note)) {
      setError("Add a note, or move the status on.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSubmit({ status, note: note.trim(), internal });
      setNote("");
      setInternal(false);
    } catch (err) {
      setError(errText(err, "Could not submit the update."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="section" style={{ marginBottom: 0 }}>
      <h3>Progress</h3>
      <div className="form-grid">
        <Field label="Status" hint={`now ${statusMeta("assignment", request.status).label.toLowerCase()}`}>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value={request.status}>Keep as is</option>
            {options.map((key) => (
              <option key={key} value={key}>
                {statusMeta("assignment", key).label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Progress note" className="span-2" hint="what the requester will read">
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>

      <label className="check">
        <input type="checkbox" checked={internal} onChange={(e) => setInternal(e.target.checked)} />
        Keep this note inside our team — don&apos;t show it to the requester
      </label>

      {error ? (
        <Alert tone="danger" style={{ marginTop: 14, marginBottom: 0 }}>
          {error}
        </Alert>
      ) : null}

      <div className="decision-actions" style={{ marginTop: 16 }}>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>
          <Send size={14} />
          {saving ? "Sending…" : gathered ? "Submit" : "Progress update"}
        </button>
      </div>
      <p className="lede" style={{ marginTop: 10, marginBottom: 0 }}>
        {gathered
          ? `The site visit is in. Submitting hands it back to ${request.createdByName || "the requester"}.`
          : `${request.createdByName || "The requester"} is notified as you move this on. Submit once the site visit comes back.`}
      </p>
    </div>
  );
}
