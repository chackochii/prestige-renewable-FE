// Mark a record Won / Lost / Closed (or reactivate it), with a note.

import { useState } from "react";
import Modal from "@/components/Modal";
import Field from "@/components/Field";
import Alert from "@/components/Alert";
import { LIFECYCLES } from "@/constants/stages";

export default function LifecycleModal({ opp, onClose, onSave }) {
  const [lifecycle, setLifecycle] = useState(opp.lifecycle === "Active" ? "Lost" : "Active");
  const [notes, setNotes] = useState(opp.notes || "");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      await onSave({ lifecycle, notes });
      onClose();
    } catch (err) {
      setError(typeof err === "string" ? err : err?.message || "Could not update the record.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title="Change status"
      body="Won, Lost and Closed records leave the active pipeline but keep their history. Reactivating puts the record back where it was."
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : "Save status"}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Status" className="span-2">
          <select value={lifecycle} onChange={(e) => setLifecycle(e.target.value)}>
            {Object.entries(LIFECYCLES).map(([key, meta]) => (
              <option key={key} value={key}>
                {meta.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Notes" className="span-2" hint="reason, context, who decided">
          <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </Field>
      </div>
      {error ? (
        <Alert tone="danger" style={{ marginTop: 12, marginBottom: 0 }}>
          {error}
        </Alert>
      ) : null}
    </Modal>
  );
}
