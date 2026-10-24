// Superadmin → DNSP networks: the list the coordinator picks from on the DNSP
// application (CL-07, "Correct DNSP or network identified for the
// installation address"). ADM only.

import { useEffect, useState } from "react";
import { Plug, Plus } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import AdminNav from "@/components/AdminNav";
import Badge from "@/components/Badge";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import DnspNetworkFormModal from "@/features/admin/DnspNetworkFormModal";
import { useAppDispatch } from "@/store";
import { createDnspNetwork, removeDnspNetwork, updateDnspNetwork } from "@/slices/dnspNetworksSlice";
import { useDnspNetworks } from "@/hooks/useDnspNetworks";
import { useNotifications } from "@/hooks/useNotifications";

export default function DnspNetworksPage() {
  const dispatch = useAppDispatch();
  const { networks, status, error } = useDnspNetworks();
  const { notify } = useNotifications();
  const [modal, setModal] = useState(null); // "new" | { edit } | { delete }

  // A failed load shows as a toast, not a box on the page.
  useEffect(() => {
    if (error) notify(error, "danger");
  }, [error, notify]);

  const save = async (body) => {
    if (modal?.edit) {
      await dispatch(updateDnspNetwork({ id: modal.edit.id, body })).unwrap();
      notify("Network updated");
    } else {
      const created = await dispatch(createDnspNetwork(body)).unwrap();
      notify(`${created.name} added`);
    }
  };

  const remove = async () => {
    try {
      await dispatch(removeDnspNetwork(modal.delete.id)).unwrap();
      notify(`${modal.delete.name} deleted`, "info");
    } catch (err) {
      notify(typeof err === "string" ? err : err?.message, "danger");
    } finally {
      setModal(null);
    }
  };

  return (
    <>
      <PageHeader
        title="DNSP networks"
        description="The distribution networks offered on the DNSP application. Only active networks can be picked for new jobs; jobs already recorded against a network keep it if it is renamed, retired or deleted."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setModal("new")}>
            <Plus size={16} /> Network
          </button>
        }
      />
      <AdminNav />

      <div className="card card-pad">
        {status !== "loading" && networks.length === 0 ? (
          <EmptyState icon={<Plug size={28} strokeWidth={1.5} />} title="No DNSP networks" body="Add the networks the coordinator can lodge DNSP applications with." />
        ) : (
          <div className="table-wrap">
            <table className="table stack">
              <thead>
                <tr>
                  <th>Network</th>
                  <th>State</th>
                  <th>Status</th>
                  <th>Order</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {networks.map((n) => (
                  <tr key={n.id}>
                    <td data-label="Network">
                      <div className="row-title">{n.name}</div>
                    </td>
                    <td data-label="State">{n.state || "-"}</td>
                    <td data-label="Status">
                      <Badge tone={n.isActive ? "success" : "neutral"}>{n.isActive ? "active" : "inactive"}</Badge>
                    </td>
                    <td data-label="Order">{n.sortOrder}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModal({ edit: n })}>
                        Edit
                      </button>{" "}
                      <button type="button" className="btn btn-danger btn-sm" onClick={() => setModal({ delete: n })}>
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
        <DnspNetworkFormModal network={modal?.edit || null} onClose={() => setModal(null)} onSave={save} />
      ) : null}
      {modal?.delete ? (
        <Modal
          title="Delete DNSP network"
          confirmClose={false}
          body={`Delete ${modal.delete.name}? It will no longer be offered on DNSP applications. Jobs already recorded against it keep the name. To hide it without deleting, set it to inactive instead.`}
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
