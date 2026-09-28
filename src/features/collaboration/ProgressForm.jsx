// The assignment screen for the coordinator: confirm or reschedule, move the
// status on, add notes, and attach reports. A note marked internal stays
// inside their department and is never shown to the requester.

import { useState } from "react";
import { CalendarClock, Send } from "lucide-react";
import Alert from "@/components/Alert";
import Field from "@/components/Field";
import FileDropzone from "@/components/FileDropzone";
import { nextAssignmentStatuses, statusMeta } from "@/constants/collaboration";
import { toDateInput } from "@/helpers/dateTimeHelpers";
import { isBlank } from "@/utils/validators";

const errText = (err, fallback) => (typeof err === "string" ? err : err?.message || fallback);

export default function ProgressForm({ request, people = [], onSubmit, onUpload, uploading = false }) {
  const [status, setStatus] = useState(request.status);
  // Who is actually going out. Operations picks the electrician or site member
  // here; the requester sees the name on the assignment.
  const [assigneeId, setAssigneeId] = useState(request.assigneeId ? String(request.assigneeId) : "");
  const [scheduledFor, setScheduledFor] = useState(toDateInput(request.scheduledFor));
  const [note, setNote] = useState("");
  const [internal, setInternal] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const options = nextAssignmentStatuses(request.status);
  // The person already on the request stays selectable even when they are not
  // in the unit directory this screen loaded.
  const crew = people.some((p) => Number(p.id) === Number(request.assigneeId))
    ? people
    : [
        ...(request.assigneeId
          ? [{ id: request.assigneeId, name: request.assigneeName || "Currently assigned" }]
          : []),
        ...people,
      ];
  const assignedName =
    crew.find((p) => Number(p.id) === Number(assigneeId))?.name || "";
  const rescheduling = status === "rescheduled" || status === "scheduled";

  const submit = async () => {
    if (rescheduling && isBlank(scheduledFor)) {
      setError("Pick the date you are scheduling this for.");
      return;
    }
    const reassigned = assigneeId && Number(assigneeId) !== Number(request.assigneeId);
    if (status === request.status && isBlank(note) && !reassigned) {
      setError("Add a note, move the status on, or assign someone.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSubmit({
        status,
        assigneeId: assigneeId ? Number(assigneeId) : null,
        scheduledFor: scheduledFor || null,
        note: note.trim(),
        internal,
      });
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
      <h3>Update this assignment</h3>
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
        <Field label="Scheduled for" hint={rescheduling ? "required" : "optional"}>
          <input type="date" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
        </Field>
        <Field
          label="Assign to"
          className="span-2"
          hint={
            assignedName
              ? `currently ${assignedName}`
              : "the electrician or site member attending"
          }
        >
          <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">Nobody assigned yet</option>
            {crew.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
                {person.title ? ` · ${person.title}` : ""}
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

      {onUpload ? (
        <div style={{ marginTop: 14 }}>
          <h3>Reports & attachments</h3>
          <FileDropzone files={request.reports || []} onSelect={onUpload} uploading={uploading} />
        </div>
      ) : null}

      {error ? (
        <Alert tone="danger" style={{ marginTop: 14, marginBottom: 0 }}>
          {error}
        </Alert>
      ) : null}

      <div className="decision-actions" style={{ marginTop: 16 }}>
        <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>
          {rescheduling ? <CalendarClock size={14} /> : <Send size={14} />}
          {saving ? "Submitting…" : "Submit update"}
        </button>
      </div>
      <p className="lede" style={{ marginTop: 10, marginBottom: 0 }}>
        {request.createdByName || "The requester"} is notified when you reschedule, complete the activity or submit a
        report.
      </p>
    </div>
  );
}
