// Administration → Users. Reads need the Admin page; writes need admin.*.

import { useEffect, useMemo, useState } from "react";
import { UserPlus } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import AdminNav from "@/components/AdminNav";
import Badge from "@/components/Badge";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import Alert from "@/components/Alert";
import UserFormModal from "@/features/admin/UserFormModal";
import { PERMISSIONS } from "@/constants/permissions";
import { roleName, SUPER_ROLE_CODE } from "@/constants/roles";
import { useAppDispatch, useAppSelector } from "@/store";
import { createUser, deleteUser, fetchUsers, updateUser } from "@/slices/employeeSlice";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { useNotifications } from "@/hooks/useNotifications";

export default function UsersPage() {
  const dispatch = useAppDispatch();
  const { user: me, hasPermission, isSuperAdmin } = useAuth();
  const { unit, unitId, units } = useBusinessUnit();
  const roles = useAppSelector((s) => s.roles.roles);
  const { items, status, error, query } = useAppSelector((s) => s.employee);
  const { notify } = useNotifications();
  const [search, setSearch] = useState("");
  const [allUnits, setAllUnits] = useState(false);
  const [editing, setEditing] = useState(null); // null | "new" | user
  const [deleting, setDeleting] = useState(null);

  const wanted = useMemo(() => (allUnits && isSuperAdmin ? { allUnits: true } : { businessUnitId: unitId }), [allUnits, isSuperAdmin, unitId]);
  const loaded = JSON.stringify(query) === JSON.stringify(wanted);

  useEffect(() => {
    if (!unitId || status === "loading") return;
    if (!loaded) dispatch(fetchUsers(wanted));
  }, [unitId, status, loaded, wanted, dispatch]);

  const rows = useMemo(
    () =>
      (loaded ? items : []).filter((u) =>
        `${u.name} ${u.email} ${u.title || ""}`.toLowerCase().includes(search.toLowerCase()),
      ),
    [items, loaded, search],
  );

  const canCreate = hasPermission(PERMISSIONS.ADMIN_CREATE);
  const canUpdate = hasPermission(PERMISSIONS.ADMIN_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.ADMIN_DELETE);
  const adminCount = items.filter((u) => u.roles?.includes(SUPER_ROLE_CODE) && u.status === "active").length;

  const save = async (payload, password) => {
    if (editing === "new") {
      await dispatch(createUser({ ...payload, password })).unwrap();
      notify("User added");
    } else {
      await dispatch(updateUser({ id: editing.id, body: payload, password })).unwrap();
      notify("User updated");
    }
  };

  const remove = async () => {
    try {
      await dispatch(deleteUser(deleting.id)).unwrap();
      notify(`${deleting.name} removed`, "info");
    } catch (err) {
      notify(typeof err === "string" ? err : err?.message, "danger");
    } finally {
      setDeleting(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Administration"
        description="Users, their roles and business units. A person can hold several roles; their access is the union of every role's permissions."
        actions={
          canCreate ? (
            <button type="button" className="btn btn-primary" onClick={() => setEditing("new")}>
              <UserPlus size={16} /> Add user
            </button>
          ) : null
        }
      />
      <AdminNav />

      <div className="toolbar">
        <input className="search" placeholder="Search name, email or title" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search users" />
        {isSuperAdmin ? (
          <label className="check" style={{ margin: 0 }}>
            <input type="checkbox" checked={allUnits} onChange={(e) => setAllUnits(e.target.checked)} /> Show users from all units
          </label>
        ) : (
          <span className="row-meta">Showing users in {unit?.name}</span>
        )}
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="card card-pad">
        {status === "loading" && !loaded ? (
          <LoadingState label="Loading users…" />
        ) : rows.length === 0 ? (
          <EmptyState title="No users found" body={items.length ? "Nobody matches that search." : "Add the first person to this business unit."} />
        ) : (
          rows.map((u) => {
            const isMe = u.id === me.id;
            const lastAdmin = u.roles?.includes(SUPER_ROLE_CODE) && u.status === "active" && adminCount === 1;
            const isAdminAccount = u.roles?.includes(SUPER_ROLE_CODE);
            const manageable = isSuperAdmin || !isAdminAccount;
            return (
              <div key={u.id} className="list-row" style={{ flexWrap: "wrap" }}>
                <div style={{ minWidth: 220 }}>
                  <div className="row-title">
                    {u.name}
                    {isMe ? " · you" : ""}
                  </div>
                  <div className="row-meta">
                    {u.email} · {u.title || "No title"}
                    {u.businessUnits?.length ? ` · ${u.businessUnits.map((b) => b.code).join(", ")}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {u.status !== "active" ? <Badge tone="danger">Disabled</Badge> : null}
                  {(u.roles || []).map((code) => (
                    <Badge key={code} tone={code === SUPER_ROLE_CODE ? "gold" : "neutral"}>
                      {roleName(code, roles)}
                    </Badge>
                  ))}
                  {canUpdate && manageable ? (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(u)}>
                      Edit
                    </button>
                  ) : null}
                  {canDelete && manageable ? (
                    <button
                      type="button"
                      className="btn btn-danger btn-sm"
                      disabled={isMe || lastAdmin}
                      title={isMe ? "You cannot delete your own account" : lastAdmin ? "Keep at least one administrator" : "Delete user"}
                      onClick={() => setDeleting(u)}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </div>
            );
          })
        )}
      </div>

      {editing ? (
        <UserFormModal
          user={editing === "new" ? null : editing}
          roles={roles}
          units={units}
          defaultUnitId={unitId}
          canAssignAdmin={isSuperAdmin}
          onClose={() => setEditing(null)}
          onSave={save}
        />
      ) : null}

      {deleting ? (
        <Modal
          title="Delete user"
          body={`Remove ${deleting.name} (${deleting.email})? They will no longer be able to sign in. Their history stays on the records they touched.`}
          onClose={() => setDeleting(null)}
          actions={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setDeleting(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={remove}>
                Delete
              </button>
            </>
          }
        />
      ) : null}
    </>
  );
}
