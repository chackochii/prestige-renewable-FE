// Create / edit a quote catalog item and its brands (superadmin only).

import { useState } from "react";
import { Plus } from "lucide-react";
import Modal from "@/components/Modal";
import Field from "@/components/Field";
import NumberInput from "@/components/NumberInput";
import { isBlank } from "@/utils/validators";
import { useNotifications } from "@/hooks/useNotifications";

const emptyBrand = () => ({ name: "", unitPrice: "" });

export default function CatalogItemFormModal({ item, onClose, onSave }) {
  const editing = Boolean(item);
  const [form, setForm] = useState({
    name: item?.name || "",
    unit: item?.unit || "unit",
    isActive: item ? item.isActive : true,
    sortOrder: item ? String(item.sortOrder) : "",
    brands: item?.brands?.length ? item.brands.map((b) => ({ ...b })) : [emptyBrand()],
  });
  // Problems show as a toast, not a box in the form.
  const { error: showError } = useNotifications();
  const [saving, setSaving] = useState(false);

  const setBrand = (index, patch) => setForm((f) => ({ ...f, brands: f.brands.map((b, i) => (i === index ? { ...b, ...patch } : b)) }));
  const addBrand = () => setForm((f) => ({ ...f, brands: [...f.brands, emptyBrand()] }));
  const removeBrand = (index) => setForm((f) => ({ ...f, brands: f.brands.filter((_, i) => i !== index) }));

  const submit = async () => {
    if (isBlank(form.name)) return showError("Enter the item's name.");
    if (form.sortOrder !== "" && !Number.isInteger(Number(form.sortOrder))) return showError("Order must be a whole number.");
    const brands = form.brands.filter((b) => !isBlank(b.name) || b.unitPrice !== "");
    if (!brands.length) return showError("Add at least one brand - the quote builder needs one to price the item.");
    if (brands.some((b) => isBlank(b.name))) return showError("Every brand needs a name.");
    if (brands.some((b) => b.unitPrice === "" || Number(b.unitPrice) < 0)) return showError("Every brand needs a unit price of 0 or more.");
    const names = brands.map((b) => b.name.trim().toLowerCase());
    if (new Set(names).size !== names.length) return showError("A brand is listed twice.");
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        unit: form.unit.trim() || "unit",
        isActive: form.isActive,
        brands: brands.map((b) => ({ name: b.name.trim(), unitPrice: Number(b.unitPrice) })),
      };
      if (form.sortOrder !== "") body.sortOrder = Number(form.sortOrder);
      await onSave(body);
      onClose();
    } catch (err) {
      showError(typeof err === "string" ? err : err?.message || "Could not save the item.");
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  return (
    <Modal
      confirmInline
      className="wide"
      title={editing ? `Edit ${item.name}` : "New catalog item"}
      body={
        editing
          ? "Changes apply to quote lines added from now on - saved quotes keep the brand and price they were priced with."
          : "Offered in the quote builder's Add item once saved. Prices are AUD ex GST."
      }
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Saving…" : editing ? "Save" : "Add item"}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Name" className="span-2" htmlFor="cat-name" required>
          <input id="cat-name" value={form.name} maxLength={255} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Unit" hint="e.g. panel, kWh, hour" htmlFor="cat-unit">
          <input id="cat-unit" value={form.unit} maxLength={30} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
        </Field>
        <Field label="Order" hint={editing ? "lower shows first" : "blank = last"} htmlFor="cat-order">
          <input id="cat-order" inputMode="numeric" value={form.sortOrder} onChange={(e) => setForm({ ...form, sortOrder: e.target.value })} />
        </Field>
        <Field label="Status" className="span-2" htmlFor="cat-active">
          <select id="cat-active" value={form.isActive ? "active" : "inactive"} onChange={(e) => setForm({ ...form, isActive: e.target.value === "active" })}>
            <option value="active">Active - offered in the quote builder</option>
            <option value="inactive">Inactive - hidden from new quotes</option>
          </select>
        </Field>
        {editing ? (
          <Field label="Key" className="span-2" hint="permanent - quote lines refer to it">
            <input value={item.key} disabled />
          </Field>
        ) : null}
      </div>

      <div style={{ marginTop: 16 }}>
        <div className="row-title" style={{ marginBottom: 8 }}>
          Brands
        </div>
        {form.brands.map((b, i) => (
          <div key={i} className="row-grid" style={{ "--row-cols": "1fr 140px auto" }}>
            <Field label="Brand / model">
              <input value={b.name} maxLength={255} onChange={(e) => setBrand(i, { name: e.target.value })} />
            </Field>
            <Field label="Unit price (ex GST)">
              <NumberInput value={b.unitPrice} min={0} step="0.01" onChange={(v) => setBrand(i, { unitPrice: v })} />
            </Field>
            <div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeBrand(i)} disabled={form.brands.length === 1}>
                Remove
              </button>
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-ghost btn-sm" onClick={addBrand}>
          <Plus size={14} /> Brand
        </button>
      </div>

    </Modal>
  );
}
