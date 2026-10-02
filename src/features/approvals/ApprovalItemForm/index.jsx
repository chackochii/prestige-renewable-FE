// Recording a plain approval — strata, heritage, landlord consent, anything
// without a checklist of its own: where it stands, who it is with, the
// reference, the dates and a note. Saved as one change.

import { useState } from "react";
import Alert from "@/components/Alert";
import Field from "@/components/Field";
import { EDITABLE_STATUSES, ITEM_STATUSES } from "@/constants/approvals";

const day = (iso) => (iso ? String(iso).slice(0, 10) : "");

export default function ApprovalItemForm({ item, onSave, onCancel }) {
  const [form, setForm] = useState({
    status: item.status === "not_applicable" ? "not_started" : item.status,
    authority: item.authority ?? "",
    reference: item.reference ?? "",
    submittedAt: day(item.submittedAt),
    decidedAt: day(item.decidedAt),
    note: item.note ?? "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const id = `ap-${item.key}`;

  const save = async (event) => {
    event.preventDefault();
    if (form.status === "rejected" && !form.note.trim()) {
      setError("Say why it was not given — sales relooks at the options from this.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await onSave({
        status: form.status,
        authority: form.authority.trim(),
        reference: form.reference.trim(),
        submittedAt: form.submittedAt || null,
        decidedAt: form.decidedAt || null,
        note: form.note.trim(),
      });
    } catch (err) {
      setError(typeof err === "string" ? err : err?.message || "The approval could not be saved.");
      setBusy(false);
    }
  };

  return (
    <form className="approval-item-form" onSubmit={save} noValidate>
      <div className="form-grid">
        <Field label="Status" htmlFor={`${id}-status`}>
          <select id={`${id}-status`} value={form.status} onChange={(e) => set("status", e.target.value)}>
            {EDITABLE_STATUSES.map((key) => (
              <option key={key} value={key}>
                {ITEM_STATUSES[key].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Who it is with" hint="the authority, body or person" htmlFor={`${id}-authority`}>
          <input id={`${id}-authority`} value={form.authority} maxLength={255} placeholder="e.g. Owners corporation SP-60412" onChange={(e) => set("authority", e.target.value)} />
        </Field>
        <Field label="Reference" hint="optional" htmlFor={`${id}-reference`}>
          <input id={`${id}-reference`} value={form.reference} maxLength={120} onChange={(e) => set("reference", e.target.value)} />
        </Field>
        <Field label="Lodged on" hint="optional" htmlFor={`${id}-submitted`}>
          <input id={`${id}-submitted`} type="date" value={form.submittedAt} onChange={(e) => set("submittedAt", e.target.value)} />
        </Field>
        <Field label="Decided on" hint="optional" htmlFor={`${id}-decided`}>
          <input id={`${id}-decided`} type="date" value={form.decidedAt} onChange={(e) => set("decidedAt", e.target.value)} />
        </Field>
        <Field className="span-2" label="Note" hint={form.status === "rejected" ? "required — why it was not given" : "optional"} htmlFor={`${id}-note`}>
          <textarea id={`${id}-note`} rows={2} maxLength={2000} value={form.note} onChange={(e) => set("note", e.target.value)} />
        </Field>
      </div>
      {error ? (
        <Alert tone="danger" style={{ marginTop: 10 }}>
          {error}
        </Alert>
      ) : null}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        {onCancel ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}
