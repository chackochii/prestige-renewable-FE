// Superadmin → Quote catalog: the items and brands the quote builder prices
// from (AUD ex GST). Shared by every business unit, so ADM only.

import { useEffect, useState } from "react";
import { Package, Plus } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import AdminNav from "@/components/AdminNav";
import Badge from "@/components/Badge";
import Modal from "@/components/Modal";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import CatalogItemFormModal from "@/features/admin/CatalogItemFormModal";
import { formatCurrency } from "@/utils/formatCurrency";
import { useAppDispatch, useAppSelector } from "@/store";
import { createCatalogItem, fetchManagedCatalog, removeCatalogItem, updateCatalogItem } from "@/slices/catalogSlice";
import { useNotifications } from "@/hooks/useNotifications";

/** "$180 – $320" across an item's brands, or the one price. */
function priceRange(brands) {
  const prices = brands.map((b) => b.unitPrice);
  if (!prices.length) return "—";
  const low = Math.min(...prices);
  const high = Math.max(...prices);
  return low === high ? formatCurrency(low, { withCents: true }) : `${formatCurrency(low, { withCents: true })} – ${formatCurrency(high, { withCents: true })}`;
}

export default function CatalogPage() {
  const dispatch = useAppDispatch();
  const { items, status, error } = useAppSelector((s) => s.catalog.manage);
  const { notify } = useNotifications();
  const [modal, setModal] = useState(null); // "new" | { edit } | { delete }

  useEffect(() => {
    if (status === "idle") dispatch(fetchManagedCatalog());
  }, [dispatch, status]);

  // A failed load shows as a toast, not a box on the page.
  useEffect(() => {
    if (error) notify(error, "danger");
  }, [error, notify]);

  const save = async (body) => {
    if (modal?.edit) {
      await dispatch(updateCatalogItem({ id: modal.edit.id, body })).unwrap();
      notify("Catalog item updated");
    } else {
      const created = await dispatch(createCatalogItem(body)).unwrap();
      notify(`${created.name} added`);
    }
  };

  const remove = async () => {
    try {
      await dispatch(removeCatalogItem(modal.delete.id)).unwrap();
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
        title="Quote catalog"
        description="The items and brands the quote builder offers, with their unit prices (AUD ex GST). Active items can be added to new quotes; saved quotes keep the brand and price they were priced with."
        actions={
          <button type="button" className="btn btn-primary" onClick={() => setModal("new")}>
            <Plus size={16} /> Item
          </button>
        }
      />
      <AdminNav />

      <div className="card card-pad">
        {status === "loading" && !items.length ? (
          <LoadingState label="Loading the catalog…" />
        ) : items.length === 0 ? (
          <EmptyState icon={<Package size={28} strokeWidth={1.5} />} title="No catalog items" body="Add the products and services the quote builder can price." />
        ) : (
          <div className="table-wrap">
            <table className="table stack">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Brands</th>
                  <th>Unit price</th>
                  <th>Status</th>
                  <th>Order</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((i) => (
                  <tr key={i.id}>
                    <td data-label="Item">
                      <div className="row-title">{i.name}</div>
                      <div className="row-meta">
                        {i.key} · per {i.unit}
                      </div>
                    </td>
                    <td data-label="Brands">
                      <div>{i.brands.length}</div>
                      <div className="row-meta">{i.brands.map((b) => b.name).join(", ")}</div>
                    </td>
                    <td data-label="Unit price" style={{ whiteSpace: "nowrap" }}>
                      {priceRange(i.brands)}
                    </td>
                    <td data-label="Status">
                      <Badge tone={i.isActive ? "success" : "neutral"}>{i.isActive ? "active" : "inactive"}</Badge>
                    </td>
                    <td data-label="Order">{i.sortOrder}</td>
                    <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModal({ edit: i })}>
                        Edit
                      </button>{" "}
                      <button
                        type="button"
                        className="btn btn-danger btn-sm"
                        onClick={() => setModal({ delete: i })}
                        disabled={i.isSystem}
                        title={i.isSystem ? "The approvals' system summary reads this item — set it to inactive instead" : undefined}
                      >
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
        <CatalogItemFormModal item={modal?.edit || null} onClose={() => setModal(null)} onSave={save} />
      ) : null}
      {modal?.delete ? (
        <Modal
          title="Delete catalog item"
          confirmClose={false}
          body={`Delete ${modal.delete.name} and its ${modal.delete.brands.length} brand${modal.delete.brands.length === 1 ? "" : "s"}? It will no longer be offered in the quote builder; saved quotes keep their lines. To hide it without deleting, set it to inactive instead.`}
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
