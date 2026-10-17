// Create / edit a DNSP network (superadmin only).

import { useState } from "react";
import Modal from "@/components/Modal";
import Field from "@/components/Field";
import { isBlank } from "@/utils/validators";
import { useNotifications } from "@/hooks/useNotifications";
import { AU_STATES } from "@/constants/stages";

export default function DnspNetworkFormModal({ network, onClose, onSave }) {
  const editing = Boolean(network);
  const [form, setForm] = useState({
    name: network?.name || "",
    state: network?.state || "NSW",
    isActive: network ? network.isActive : true,
    sortOrder: network ? String(network.sortOrder) : "",
  });
  // Problems show as a toast, not a box in the form.
  const { error: showError } = useNotifications();
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (isBlank(form.name)) return showError("Enter the network's name.");
    if (form.name.trim().length > 100) return showError("Keep the name to 100 characters.");
    if (form.sortOrder !== "" && !Number.isInteger(Number(form.sortOrder))) return showError("Order must be a whole number.");
    setSaving(true);
    try {
      const body = { name: form.name.trim(), state: form.state || null, isActive: form.isActive };
      if (form.sortOrder !== "") body.sortOrder = Number(form.sortOrder);
      await onSave(body);
      onClose();
    } catch (err) {
      showError(typeof err === "string" ? err : err?.message || "Could not save the network.");
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  return (
    <Modal
      confirmInline
      title={editing ? `Edit ${network.name}` : "New DNSP network"}
      body={
        editing
          ? "Jobs keep the name they were recorded with — renaming here changes what new applications pick from."
          : "Active networks are offered on the DNSP application, grouped by state."
      }
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save" : "Add network"}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Name" className="span-2" htmlFor="dnsp-name" required>
          <input id="dnsp-name" value={form.name} maxLength={100} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="State" htmlFor="dnsp-state">
          <select id="dnsp-state" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })}>
            {AU_STATES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Order" hint={editing ? "lower shows first" : "blank = last"} htmlFor="dnsp-order">
          <input id="dnsp-order" inputMode="numeric" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
        </Field>
        <Field label="Status" className="span-2" htmlFor="dnsp-active">
          <select id="dnsp-active" value={form.isActive ? "active" : "inactive"} onChange={(e) => setForm({ ...form, isActive: e.target.value === "active" })}>
            <option value="active">Active — offered on new applications</option>
            <option value="inactive">Inactive — hidden from new applications</option>
          </select>
        </Field>
      </div>
    </Modal>
  );
}
