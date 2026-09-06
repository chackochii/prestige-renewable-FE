// Administration → Roles & permissions. The grants editor: which permission
// codes each role holds. Page visibility rides the same catalog (page.*.view).

import { useEffect, useMemo, useState } from "react";
import { Plus, ShieldCheck } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import AdminNav from "@/components/AdminNav";
import Badge from "@/components/Badge";
import Card from "@/components/Card";
import Field from "@/components/Field";
import Modal from "@/components/Modal";
import Alert from "@/components/Alert";
import LoadingState from "@/components/LoadingState";
import { PERMISSIONS } from "@/constants/permissions";
import { SUPER_ROLE_CODE } from "@/constants/roles";
import { isBlank, isPermissionCode, isRoleCode } from "@/utils/validators";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  createPermission,
  createRole,
  fetchPermissions,
  fetchRoles,
  removePermission,
  removeRole,
  setRolePermissions,
  updateRole,
} from "@/slices/rolesSlice";
import { fetchMe } from "@/slices/authSlice";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";

const errMessage = (err, fallback) => (typeof err === "string" ? err : err?.message || fallback);

function RoleModal({ roles, onClose, onSave }) {
  const [form, setForm] = useState({ code: "", name: "", description: "", inheritsFrom: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!isRoleCode(form.code)) return setError("Code must be 2–20 characters of A–Z, 0–9 or _, starting with a letter.");
    if (isBlank(form.name)) return setError("Enter a role name.");
    setSaving(true);
    setError("");
    try {
      await onSave({
        code: form.code,
        name: form.name.trim(),
        description: form.description.trim() || null,
        inheritsFrom: form.inheritsFrom || null,
      });
      onClose();
    } catch (err) {
      setError(errMessage(err, "Could not create the role."));
    } finally {
      setSaving(false);
    }
    return undefined;
  };
  return (
    <Modal
      title="New role"
      body="Codes are permanent (they live on user accounts). Everything else can change later."
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Creating…" : "Create role"}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Code" hint="e.g. QSM">
          <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
        </Field>
        <Field label="Name">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Description" className="span-2">
          <textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <Field label="Inherits grants from" className="span-2" hint="optional">
          <select value={form.inheritsFrom} onChange={(e) => setForm({ ...form, inheritsFrom: e.target.value })}>
            <option value="">None</option>
            {roles.map((r) => (
              <option key={r.code} value={r.code}>
                {r.name} ({r.code})
              </option>
            ))}
          </select>
        </Field>
      </div>
      {error ? <Alert tone="danger" style={{ marginTop: 12, marginBottom: 0 }}>{error}</Alert> : null}
    </Modal>
  );
}

function PermissionModal({ categories, onClose, onSave }) {
  const [form, setForm] = useState({ code: "", name: "", category: "" });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    if (!isPermissionCode(form.code)) return setError('Code must look like "area.action" (lowercase, dot-separated).');
    if (isBlank(form.name)) return setError("Enter a permission name.");
    setSaving(true);
    setError("");
    try {
      await onSave({ code: form.code, name: form.name.trim(), category: form.category.trim() || null });
      onClose();
    } catch (err) {
      setError(errMessage(err, "Could not create the permission."));
    } finally {
      setSaving(false);
    }
    return undefined;
  };
  return (
    <Modal
      title="New permission"
      body="Custom permissions can be granted to roles and checked by future features. Codes are permanent."
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Creating…" : "Create permission"}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Code" hint="e.g. reports.export">
          <input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })} />
        </Field>
        <Field label="Name">
          <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Category" className="span-2">
          <input list="permission-categories" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <datalist id="permission-categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
      </div>
      {error ? <Alert tone="danger" style={{ marginTop: 12, marginBottom: 0 }}>{error}</Alert> : null}
    </Modal>
  );
}

export default function RolesPage() {
  const dispatch = useAppDispatch();
  const { user, hasPermission } = useAuth();
  const { roles, permissions, status, permissionsStatus, error } = useAppSelector((s) => s.roles);
  const { notify } = useNotifications();
  const [selectedCode, setSelectedCode] = useState(null);
  const [draft, setDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null); // "role" | "permission" | { delete: role }

  useEffect(() => {
    if (permissionsStatus === "idle") dispatch(fetchPermissions());
    if (status === "idle") dispatch(fetchRoles());
  }, [permissionsStatus, status, dispatch]);

  const selected = roles.find((r) => r.code === selectedCode) || roles[0] || null;
  const own = useMemo(() => new Set((selected?.permissions || []).map((p) => p.code)), [selected]);
  const inherited = useMemo(
    () => new Set((selected?.effectivePermissions || []).filter((c) => !own.has(c))),
    [selected, own],
  );

  useEffect(() => {
    setDraft(null);
  }, [selected?.code]);

  const grants = draft ?? own;
  const dirty = draft !== null && (draft.size !== own.size || [...draft].some((c) => !own.has(c)));

  const groups = useMemo(() => {
    const byCategory = new Map();
    permissions.forEach((p) => {
      const key = p.category || "Other";
      if (!byCategory.has(key)) byCategory.set(key, []);
      byCategory.get(key).push(p);
    });
    return [...byCategory.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permissions]);
  const categories = groups.map(([c]) => c);

  const canCreate = hasPermission(PERMISSIONS.ADMIN_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.ADMIN_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.ADMIN_DELETE);
  const isSuperRole = selected?.code === SUPER_ROLE_CODE;

  const toggleGrant = (code) => {
    const next = new Set(grants);
    if (next.has(code)) next.delete(code);
    else next.add(code);
    setDraft(next);
  };

  const saveGrants = async () => {
    setSaving(true);
    try {
      await dispatch(setRolePermissions({ code: selected.code, permissionCodes: [...grants] })).unwrap();
      notify(`Grants saved for ${selected.name}`);
      setDraft(null);
      if (user.roles?.includes(selected.code)) dispatch(fetchMe());
    } catch (err) {
      notify(errMessage(err, "Could not save grants."), "danger");
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async () => {
    try {
      await dispatch(updateRole({ code: selected.code, body: { isActive: !selected.isActive } })).unwrap();
      notify(`${selected.name} ${selected.isActive ? "deactivated" : "activated"}`);
    } catch (err) {
      notify(errMessage(err, "Could not update the role."), "danger");
    }
  };

  const deleteRole = async (role) => {
    try {
      await dispatch(removeRole(role.code)).unwrap();
      notify(`${role.name} deleted`, "info");
      setSelectedCode(null);
    } catch (err) {
      notify(errMessage(err, "Could not delete the role."), "danger");
    } finally {
      setModal(null);
    }
  };

  const deletePermission = async (p) => {
    try {
      await dispatch(removePermission(p.code)).unwrap();
      notify(`${p.code} deleted`, "info");
      dispatch(fetchRoles());
    } catch (err) {
      notify(errMessage(err, "Could not delete the permission."), "danger");
    }
  };

  return (
    <>
      <PageHeader
        title="Roles & permissions"
        description="Which permission codes each role holds. A person with several roles gets the union of their grants; the ADM role bypasses every check."
        actions={
          canCreate ? (
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setModal("permission")}>
                <Plus size={16} /> Permission
              </button>
              <button type="button" className="btn btn-primary" onClick={() => setModal("role")}>
                <Plus size={16} /> Role
              </button>
            </>
          ) : null
        }
      />
      <AdminNav />

      {error ? <Alert tone="danger">{error}</Alert> : null}

      {status !== "succeeded" && roles.length === 0 ? (
        <LoadingState label="Loading roles…" />
      ) : (
        <div className="grid-2" style={{ gridTemplateColumns: "0.9fr 1.4fr" }}>
          <Card title="Roles" sub={`${roles.length} in the catalog`}>
            <div className="list-stack">
              {roles.map((r) => (
                <button
                  key={r.code}
                  type="button"
                  className="list-row"
                  style={selected?.code === r.code ? { background: "var(--surface-2)", paddingLeft: 14 } : undefined}
                  onClick={() => setSelectedCode(r.code)}
                >
                  <div>
                    <div className="row-title">{r.name}</div>
                    <div className="row-meta">
                      {r.code} · {r.effectivePermissions?.length || 0} permission{r.effectivePermissions?.length === 1 ? "" : "s"}
                      {r.inheritsFrom ? ` · inherits ${r.inheritsFrom}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 6 }}>
                    {!r.isActive ? <Badge tone="danger">Inactive</Badge> : null}
                    {r.isSystem ? <Badge tone="neutral">System</Badge> : null}
                  </div>
                </button>
              ))}
            </div>
          </Card>

          {selected ? (
            <Card
              title={selected.name}
              icon={<ShieldCheck size={16} />}
              sub={selected.description || "No description."}
              actions={
                <>
                  {canUpdate && !isSuperRole ? (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={toggleActive}>
                      {selected.isActive ? "Deactivate" : "Activate"}
                    </button>
                  ) : null}
                  {canDelete && !selected.isSystem ? (
                    <button type="button" className="btn btn-danger btn-sm" onClick={() => setModal({ delete: selected })}>
                      Delete
                    </button>
                  ) : null}
                </>
              }
            >
              {isSuperRole ? (
                <Alert tone="info">The system administrator role passes every permission check in code; its grants are shown for visibility only.</Alert>
              ) : null}
              {inherited.size ? (
                <p className="lede" style={{ marginBottom: 12 }}>
                  Greyed ticks are inherited from {selected.inheritsFrom} and cannot be removed here.
                </p>
              ) : null}

              {groups.map(([category, perms]) => (
                <div key={category} className="section" style={{ marginBottom: 18 }}>
                  <h3>{category}</h3>
                  <div className="choice-grid">
                    {perms.map((p) => {
                      const isInherited = inherited.has(p.code);
                      return (
                        <label key={p.code} className="choice" title={p.code}>
                          <input
                            type="checkbox"
                            checked={isInherited || grants.has(p.code)}
                            disabled={isInherited || !canUpdate || isSuperRole}
                            onChange={() => toggleGrant(p.code)}
                          />
                          <span>
                            {p.name}
                            <small>
                              {p.code}
                              {!p.isSystem && canDelete ? (
                                <>
                                  {" · "}
                                  <button
                                    type="button"
                                    className="btn btn-sm"
                                    style={{ padding: 0, background: "none", color: "var(--danger)", fontSize: 11 }}
                                    onClick={(e) => {
                                      e.preventDefault();
                                      deletePermission(p);
                                    }}
                                  >
                                    delete
                                  </button>
                                </>
                              ) : null}
                            </small>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}

              {canUpdate && !isSuperRole ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button type="button" className="btn btn-primary" onClick={saveGrants} disabled={!dirty || saving}>
                    {saving ? "Saving…" : "Save grants"}
                  </button>
                  {dirty ? (
                    <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>
                      Discard
                    </button>
                  ) : null}
                </div>
              ) : null}
            </Card>
          ) : null}
        </div>
      )}

      {modal === "role" ? (
        <RoleModal
          roles={roles}
          onClose={() => setModal(null)}
          onSave={async (body) => {
            const role = await dispatch(createRole(body)).unwrap();
            notify(`Role ${role.code} created`);
            setSelectedCode(role.code);
          }}
        />
      ) : null}
      {modal === "permission" ? (
        <PermissionModal
          categories={categories}
          onClose={() => setModal(null)}
          onSave={async (body) => {
            await dispatch(createPermission(body)).unwrap();
            notify(`Permission ${body.code} created`);
          }}
        />
      ) : null}
      {modal?.delete ? (
        <Modal
          title="Delete role"
          body={`Delete ${modal.delete.name} (${modal.delete.code})? Only roles nobody holds can be removed.`}
          onClose={() => setModal(null)}
          actions={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={() => deleteRole(modal.delete)}>
                Delete
              </button>
            </>
          }
        />
      ) : null}
    </>
  );
}
