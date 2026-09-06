// Superadmin → Business units: create, rename, retire. ADM only.

import { useState } from "react";
import { Building2, Plus } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import AdminNav from "@/components/AdminNav";
import Badge from "@/components/Badge";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import Alert from "@/components/Alert";
import BusinessUnitFormModal from "@/features/admin/BusinessUnitFormModal";
import { formatPercent } from "@/utils/formatCurrency";
import { useAppDispatch } from "@/store";
import { createBusinessUnit, removeBusinessUnit, updateBusinessUnit } from "@/slices/businessUnitsSlice";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { useNotifications } from "@/hooks/useNotifications";

const TONE = { active: "success", configured: "info", inactive: "neutral" };

export default function BusinessUnitsPage() {
  const dispatch = useAppDispatch();
  const { units, unit: current, error } = useBusinessUnit();
  const { notify } = useNotifications();
  const [modal, setModal] = useState(null); // "new" | { edit } | { delete }

  const save = async (body) => {
    if (modal?.edit) {
      await dispatch(updateBusinessUnit({ id: modal.edit.id, body })).unwrap();
      notify("Business unit updated");
    } else {
      const created = await dispatch(createBusinessUnit(body)).unwrap();
      notify(`${created.code} created`);
    }
  };

  const remove = async () => {
    try {
      await dispatch(removeBusinessUnit(modal.delete.id)).unwrap();
      notify(`${modal.delete.code} deleted`, "info");
    } catch (err) {
      notify(typeof err === "string" ? err : err?.message, "danger");
    } finally {
      setModal(null);
    }
  };

  return (
    <>
      <PageHeader
        title="Business units"
        description="The companies this platform runs. Creating or removing a unit is reserved for the system administrator; each unit's workflow settings are edited under Admin → Unit settings."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setModal("new")}>
            <Plus size={16} /> Business unit
          </button>
        }
      />
      <AdminNav />

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="card card-pad">
        {units.length === 0 ? (
          <EmptyState icon={<Building2 size={28} strokeWidth={1.5} />} title="No business units" body="Create the first unit to start capturing leads." />
        ) : (
          <div className="table-wrap">
            <table className="table stack">
              <thead>
                <tr>
                  <th>Unit</th>
                  <th>Status</th>
                  <th>Timezone</th>
                  <th>Margin floor</th>
                  <th>Stages</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.id}>
                    <td data-label="Unit">
                      <div className="row-title">
                        {u.name}
                        {current?.id === u.id ? " · current" : ""}
                      </div>
                      <div className="row-meta">
                        {u.code}
                        {u.legalName ? ` · ${u.legalName}` : ""}
                      </div>
                    </td>
                    <td data-label="Status">
                      <Badge tone={TONE[u.status] || "neutral"}>{u.status}</Badge>
                    </td>
                    <td data-label="Timezone">{u.timezone}</td>
                    <td data-label="Margin floor">{formatPercent(u.marginFloor, 0)}</td>
                    <td data-label="Stages">{Array.isArray(u.enabledStages) ? `${u.enabledStages.length} of 9` : "—"}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModal({ edit: u })}>
                        Edit
                      </button>{" "}
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => setModal({ delete: u })}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modal === "new" || modal?.edit ? (
        <BusinessUnitFormModal unit={modal?.edit || null} onClose={() => setModal(null)} onSave={save} />
      ) : null}
      {modal?.delete ? (
        <Modal
          title="Delete business unit"
          body={`Delete ${modal.delete.name} (${modal.delete.code})? Only units with no opportunities can be removed — otherwise set the status to inactive.`}
          onClose={() => setModal(null)}
          actions={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setModal(null)}>
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
