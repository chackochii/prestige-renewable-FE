// Administration → Pages. The registry (which pages exist, which permission
// shows them) and the unit × page toggle matrix (which pages each unit runs).

import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import AdminNav from "@/components/AdminNav";
import Badge from "@/components/Badge";
import Card from "@/components/Card";
import Field from "@/components/Field";
import Modal from "@/components/Modal";
import Alert from "@/components/Alert";
import LoadingState from "@/components/LoadingState";
import { PERMISSIONS } from "@/constants/permissions";
import { isBlank, isPageCode, isPagePath } from "@/utils/validators";
import { getUnitPages, setUnitPages } from "@/services/api/pagesApi";
import { useAppDispatch, useAppSelector } from "@/store";
import { createPage, fetchPages, removePage, updatePage } from "@/slices/pagesSlice";
import { fetchPermissions } from "@/slices/rolesSlice";
import { fetchBusinessUnits } from "@/slices/businessUnitsSlice";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { useNotifications } from "@/hooks/useNotifications";

const errMessage = (err, fallback) => (typeof err === "string" ? err : err?.message || fallback);
const SUPERADMIN_ONLY_PAGES = ["admin"];

function PageModal({ page, permissions, onClose, onSave }) {
  const editing = Boolean(page);
  const [form, setForm] = useState({
    code: page?.code || "",
    label: page?.label || "",
    path: page?.path || "",
    sortOrder: page?.sortOrder ?? 0,
    viewPermissionCode: page?.viewPermissionCode || "",
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (!editing && !isPageCode(form.code)) return setError("Code must be 2–30 characters of a–z, 0–9, - or _, starting with a letter.");
    if (isBlank(form.label)) return setError("Enter a label.");
    if (!isPagePath(form.path)) return setError('Path must look like "/pipeline".');
    setSaving(true);
    setError("");
    try {
      const body = {
        label: form.label.trim(),
        sortOrder: Number(form.sortOrder) || 0,
        viewPermissionCode: form.viewPermissionCode || null,
      };
      if (!editing) {
        body.code = form.code;
        body.path = form.path;
      } else if (!page.isSystem) body.path = form.path;
      await onSave(body);
      onClose();
    } catch (err) {
      setError(errMessage(err, "Could not save the page."));
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  return (
    <Modal
      title={editing ? `Edit ${page.label}` : "New page"}
      body="A page only works once the frontend has a route for its path. Visibility follows the permission you choose; per-unit toggles are set in the matrix."
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save" : "Create page"}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Code" hint={editing ? "permanent" : "e.g. reports"}>
          <input value={form.code} disabled={editing} onChange={(e) => setForm({ ...form, code: e.target.value.toLowerCase() })} />
        </Field>
        <Field label="Label">
          <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
        </Field>
        <Field label="Path" hint={page?.isSystem ? "fixed for system pages" : undefined}>
          <input value={form.path} disabled={Boolean(page?.isSystem)} onChange={(e) => setForm({ ...form, path: e.target.value })} />
        </Field>
        <Field label="Sort order">
          <input type="number" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
        </Field>
        <Field label="View permission" className="span-2" hint="none = every signed-in user">
          <select value={form.viewPermissionCode} onChange={(e) => setForm({ ...form, viewPermissionCode: e.target.value })}>
            <option value="">Everyone</option>
            {permissions.map((p) => (
              <option key={p.code} value={p.code}>
                {p.name} ({p.code})
              </option>
            ))}
          </select>
        </Field>
      </div>
      {error ? <Alert tone="danger" style={{ marginTop: 12, marginBottom: 0 }}>{error}</Alert> : null}
    </Modal>
  );
}

export default function PagesPage() {
  const dispatch = useAppDispatch();
  const { hasPermission, isSuperAdmin } = useAuth();
  const { units } = useBusinessUnit();
  const { items: pages, status, error } = useAppSelector((s) => s.pages);
  const { permissions, permissionsStatus } = useAppSelector((s) => s.roles);
  const { notify } = useNotifications();
  const [matrix, setMatrix] = useState({}); // unitId → { pageCode → enabled }
  const [saved, setSaved] = useState({});
  const [matrixStatus, setMatrixStatus] = useState("idle");
  const [matrixError, setMatrixError] = useState("");
  const [saving, setSaving] = useState(false);
  const [modal, setModal] = useState(null); // "new" | { edit: page } | { delete: page }

  const canCreate = hasPermission(PERMISSIONS.ADMIN_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.ADMIN_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.ADMIN_DELETE);

  useEffect(() => {
    if (permissionsStatus === "idle") dispatch(fetchPermissions());
    if (status === "idle") dispatch(fetchPages());
  }, [permissionsStatus, status, dispatch]);

  const loadMatrix = useCallback(async () => {
    if (!units.length) return;
    setMatrixStatus("loading");
    setMatrixError("");
    try {
      const results = await Promise.all(units.map((u) => getUnitPages(u.id)));
      const next = {};
      results.forEach((r) => {
        next[r.id] = Object.fromEntries(r.pages.map((p) => [p.code, p.enabled]));
      });
      setMatrix(next);
      setSaved(next);
      setMatrixStatus("succeeded");
    } catch (err) {
      setMatrixError(errMessage(err, "Could not load page toggles."));
      setMatrixStatus("failed");
    }
  }, [units]);

  useEffect(() => {
    loadMatrix();
  }, [loadMatrix, pages.length]);

  const changes = useMemo(() => {
    const out = [];
    Object.entries(matrix).forEach(([unitId, byPage]) => {
      Object.entries(byPage).forEach(([code, enabled]) => {
        if (saved[unitId]?.[code] !== enabled) out.push({ unitId: Number(unitId), code, enabled });
      });
    });
    return out;
  }, [matrix, saved]);

  const toggle = (unitId, code) =>
    setMatrix((m) => ({ ...m, [unitId]: { ...m[unitId], [code]: !m[unitId]?.[code] } }));

  const saveMatrix = async () => {
    setSaving(true);
    try {
      const byUnit = new Map();
      changes.forEach((c) => {
        if (!byUnit.has(c.unitId)) byUnit.set(c.unitId, []);
        byUnit.get(c.unitId).push({ code: c.code, enabled: c.enabled });
      });
      await Promise.all([...byUnit.entries()].map(([unitId, entries]) => setUnitPages(unitId, entries)));
      setSaved(matrix);
      notify("Page toggles saved");
      dispatch(fetchBusinessUnits());
    } catch (err) {
      notify(errMessage(err, "Could not save page toggles."), "danger");
    } finally {
      setSaving(false);
    }
  };

  const pagePermissions = useMemo(
    () => [...permissions].sort((a, b) => (a.category === "Pages" ? -1 : b.category === "Pages" ? 1 : a.code.localeCompare(b.code))),
    [permissions],
  );

  return (
    <>
      <PageHeader
        title="Pages"
        description="The page registry drives the sidebar: a page shows for people who hold its view permission and for business units that run it."
        actions={
          canCreate ? (
            <button type="button" className="btn btn-primary" onClick={() => setModal("new")}>
              <Plus size={16} /> Page
            </button>
          ) : null
        }
      />
      <AdminNav />

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {matrixError ? <Alert tone="danger">{matrixError}</Alert> : null}

      <Card
        title="Pages by business unit"
        sub="Tick a cell to enable that page for the unit. Untouched pages default to enabled."
        actions={
          canUpdate ? (
            <>
              {changes.length ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMatrix(saved)}>
                  Discard
                </button>
              ) : null}
              <button type="button" className="btn btn-primary btn-sm" onClick={saveMatrix} disabled={!changes.length || saving}>
                {saving ? "Saving…" : `Save${changes.length ? ` (${changes.length})` : ""}`}
              </button>
            </>
          ) : null
        }
      >
        {status !== "succeeded" || matrixStatus === "loading" || matrixStatus === "idle" ? (
          <LoadingState label="Loading pages…" />
        ) : (
          <div className="table-wrap">
            <table className="table matrix">
              <thead>
                <tr>
                  <th>Page</th>
                  <th>Visible to</th>
                  {units.map((u) => (
                    <th key={u.id} style={{ textAlign: "center" }} title={u.name}>
                      {u.code}
                    </th>
                  ))}
                  <th />
                </tr>
              </thead>
              <tbody>
                {pages.map((p) => {
                  const lockedForMe = SUPERADMIN_ONLY_PAGES.includes(p.code) && !isSuperAdmin;
                  return (
                    <tr key={p.code}>
                      <td>
                        <div className="row-title">
                          {p.label} {p.isSystem ? <Badge tone="neutral">System</Badge> : null}
                        </div>
                        <div className="row-meta">
                          {p.code} · {p.path} · order {p.sortOrder}
                        </div>
                      </td>
                      <td>
                        <span className="row-meta">{p.viewPermissionCode || "Everyone"}</span>
                      </td>
                      {units.map((u) => (
                        <td key={u.id} className="center">
                          <input
                            type="checkbox"
                            aria-label={`${p.label} in ${u.name}`}
                            checked={matrix[u.id]?.[p.code] ?? true}
                            disabled={!canUpdate || lockedForMe}
                            title={lockedForMe ? "Only the system administrator can turn off this page" : undefined}
                            onChange={() => toggle(u.id, p.code)}
                          />
                        </td>
                      ))}
                      <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        {canUpdate ? (
                          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModal({ edit: p })}>
                            Edit
                          </button>
                        ) : null}{" "}
                        {canDelete && !p.isSystem ? (
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => setModal({ delete: p })}>
                            Delete
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {modal === "new" || modal?.edit ? (
        <PageModal
          page={modal?.edit || null}
          permissions={pagePermissions}
          onClose={() => setModal(null)}
          onSave={async (body) => {
            if (modal?.edit) {
              await dispatch(updatePage({ code: modal.edit.code, body })).unwrap();
              notify("Page updated");
            } else {
              await dispatch(createPage(body)).unwrap();
              notify(`Page ${body.code} created`);
            }
          }}
        />
      ) : null}
      {modal?.delete ? (
        <Modal
          title="Delete page"
          body={`Delete ${modal.delete.label} (${modal.delete.code}) from the registry? Unit toggles for it are removed too.`}
          onClose={() => setModal(null)}
          actions={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={async () => {
                  try {
                    await dispatch(removePage(modal.delete.code)).unwrap();
                    notify("Page deleted", "info");
                  } catch (err) {
                    notify(errMessage(err, "Could not delete the page."), "danger");
                  } finally {
                    setModal(null);
                  }
                }}
              >
                Delete
              </button>
            </>
          }
        />
      ) : null}
    </>
  );
}
