// Create / edit a user: identity, status, roles (many) and business units.

import { useState } from "react";
import Modal from "@/components/Modal";
import Field from "@/components/Field";
import Alert from "@/components/Alert";
import { SUPER_ROLE_CODE } from "@/constants/roles";
import { isBlank, isEmail, minLength } from "@/utils/validators";

function initialForm(user, defaultUnitId) {
  return {
    name: user?.name || "",
    email: user?.email || "",
    title: user?.title || "",
    phone: user?.phone || "",
    status: user?.status || "active",
    password: "",
    roles: [...(user?.roles || [])],
    businessUnitIds: user ? (user.businessUnits || []).map((u) => u.id) : defaultUnitId ? [defaultUnitId] : [],
  };
}

export default function UserFormModal({ user, roles, units, defaultUnitId, canAssignAdmin, onClose, onSave }) {
  const editing = Boolean(user);
  const [form, setForm] = useState(() => initialForm(user, defaultUnitId));
  const [errors, setErrors] = useState({});
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));
  const toggle = (field, value) =>
    setForm((f) => ({
      ...f,
      [field]: f[field].includes(value) ? f[field].filter((v) => v !== value) : [...f[field], value],
    }));

  const assignableRoles = roles.filter((r) => r.isActive && (canAssignAdmin || r.code !== SUPER_ROLE_CODE));

  const submit = async () => {
    const found = {};
    if (isBlank(form.name)) found.name = "Enter a name.";
    if (!isEmail(form.email)) found.email = "Enter a valid email.";
    if (!editing && !minLength(form.password, 8)) found.password = "Password needs at least 8 characters.";
    if (editing && form.password && !minLength(form.password, 8)) found.password = "Password needs at least 8 characters.";
    if (!form.roles.length) found.roles = "Choose at least one role.";
    if (!form.businessUnitIds.length && !form.roles.includes(SUPER_ROLE_CODE)) found.businessUnitIds = "Assign at least one business unit.";
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    setError("");
    try {
      await onSave(
        {
          name: form.name.trim(),
          email: form.email.trim(),
          title: form.title.trim() || null,
          phone: form.phone.trim() || null,
          status: form.status,
          roles: form.roles,
          businessUnitIds: form.businessUnitIds,
        },
        form.password || null,
      );
      onClose();
    } catch (err) {
      setError(typeof err === "string" ? err : err?.message || "Could not save the user.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      className="wide"
      title={editing ? "Edit user" : "Add user"}
      body={
        editing
          ? "Roles and unit assignments take effect on the person's next request."
          : "The person signs in with the email and password you set here."
      }
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save changes" : "Add user"}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Name" error={errors.name}>
          <input value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Email" error={errors.email}>
          <input type="email" value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="off" />
        </Field>
        <Field label="Title">
          <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="e.g. Site Supervisor" />
        </Field>
        <Field label="Phone">
          <input value={form.phone} onChange={(e) => set("phone", e.target.value)} />
        </Field>
        <Field label={editing ? "New password" : "Password"} hint={editing ? "leave blank to keep current" : "minimum 8 characters"} error={errors.password}>
          <input type="password" value={form.password} onChange={(e) => set("password", e.target.value)} autoComplete="new-password" />
        </Field>
        <Field label="Status">
          <select value={form.status} onChange={(e) => set("status", e.target.value)}>
            <option value="active">Active</option>
            <option value="disabled">Disabled</option>
          </select>
        </Field>
        <Field label="Roles" hint="a person may hold several" className="span-2" error={errors.roles}>
          <div className="choice-grid">
            {assignableRoles.map((r) => (
              <label key={r.code} className="choice">
                <input type="checkbox" checked={form.roles.includes(r.code)} onChange={() => toggle("roles", r.code)} />
                <span>
                  {r.name}
                  <small>{r.code}</small>
                </span>
              </label>
            ))}
          </div>
        </Field>
        <Field label="Business units" className="span-2" error={errors.businessUnitIds}>
          <div className="choice-grid">
            {units.map((u) => (
              <label key={u.id} className="choice">
                <input
                  type="checkbox"
                  checked={form.businessUnitIds.includes(u.id)}
                  onChange={() => toggle("businessUnitIds", u.id)}
                />
                <span>
                  {u.name}
                  <small>{u.code}</small>
                </span>
              </label>
            ))}
          </div>
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
