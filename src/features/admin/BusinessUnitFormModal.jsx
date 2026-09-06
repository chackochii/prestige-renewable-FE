// Create / edit a business unit's identity (superadmin only).

import { useState } from "react";
import Modal from "@/components/Modal";
import Field from "@/components/Field";
import Alert from "@/components/Alert";
import { isBlank } from "@/utils/validators";
import { TIMEZONES } from "@/constants/timezones";

const STATUSES = ["active", "configured", "inactive"];

export default function BusinessUnitFormModal({ unit, onClose, onSave }) {
  const editing = Boolean(unit);
  const [form, setForm] = useState({
    code: unit?.code || "",
    name: unit?.name || "",
    legalName: unit?.legalName || "",
    timezone: unit?.timezone || "Australia/Sydney",
    status: unit?.status || "configured",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!editing && (isBlank(form.code) || form.code.length > 10)) return setError("Enter a code of up to 10 characters (e.g. PRS).");
    if (isBlank(form.name)) return setError("Enter a name.");
    setSaving(true);
    setError("");
    try {
      const body = {
        name: form.name.trim(),
        legalName: form.legalName.trim() || null,
        timezone: form.timezone,
        status: form.status,
      };
      if (!editing) body.code = form.code.trim().toUpperCase();
      await onSave(body);
      onClose();
    } catch (err) {
      setError(typeof err === "string" ? err : err?.message || "Could not save the business unit.");
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  return (
    <Modal
      title={editing ? `Edit ${unit.code}` : "New business unit"}
      body={
        editing
          ? "Codes are permanent — opportunity numbers key off them. Workflow settings are edited per unit under Admin → Unit settings."
          : "A new unit starts with the default solar workflow: all nine stages, 20 / 40 / 40 billing and a 20% margin floor."
      }
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save" : "Create unit"}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Code" hint={editing ? "permanent" : "up to 10 characters"}>
          <input value={form.code} maxLength={10} disabled={editing} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="Status">
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Name" className="span-2">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Legal name" className="span-2">
          <input value={form.legalName} onChange={(e) => setForm({ ...form, legalName: e.target.value })} />
        </Field>
        <Field label="Timezone" className="span-2">
          <select value={form.timezone} onChange={(e) => setForm({ ...form, timezone: e.target.value })}>
            {TIMEZONES.map((tz) => (
              <option key={tz} value={tz}>
                {tz}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {error ? <Alert tone="danger" style={{ marginTop: 12, marginBottom: 0 }}>{error}</Alert> : null}
    </Modal>
  );
}
