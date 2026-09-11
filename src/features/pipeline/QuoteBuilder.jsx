// Create Quote / Quote Builder — appears within the Estimation module once
// estimation is ready to quote (see EstimationPanel's showQuoteBuilder).
//
// Backed by the real prestige-be quote endpoints designed for this module
// (see fetchOpportunityQuote / createOpportunityQuote / *QuoteItem / *QuoteCost
// thunks in slices/leadsSlice.js) — the backend doesn't have them yet, so
// live clicking will 404 until they're implemented, but the quote now lives
// on the server (state.leads.quote), not in a local-only store.
//
// Selects/dates dispatch immediately on change (discrete, infrequent).
// Free-text and number fields (project, project type "Other", GST rate, a
// cost's value/description) are buffered locally and dispatch on blur, so
// typing doesn't fire a request per keystroke.

import { useEffect, useState } from "react";
import { Download, FileSpreadsheet, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Field from "@/components/Field";
import Modal from "@/components/Modal";
import NumberInput from "@/components/NumberInput";
import SectionHead from "@/components/SectionHead";
import { ADDITIONAL_COST_TYPES, PROJECT_TYPES, TAX_TREATMENTS } from "@/constants/catalog";
import { additionalCostAmount, findCatalogItem, itemsSubtotal, lineTotal, quoteGstBreakdown } from "@/helpers/quote";
import { downloadInvoice } from "@/helpers/invoice";
import { formatCurrency } from "@/utils/formatCurrency";
import { useAppDispatch, useAppSelector } from "@/store";
import { fetchCatalog } from "@/slices/catalogSlice";
import {
  addQuoteCost,
  addQuoteItem,
  createOpportunityQuote,
  deleteQuoteCost,
  deleteQuoteItem,
  updateOpportunityQuote,
  updateQuoteCost,
  updateQuoteItem,
} from "@/slices/leadsSlice";
import { useNotifications } from "@/hooks/useNotifications";

const emptyItemForm = () => ({ itemKey: "", brand: "", quantity: 1, unit: "", unitPrice: "", discountPct: 0 });

function ItemModal({ initial, catalogItems, catalogLoading, onSave, onClose }) {
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(() =>
    initial
      ? {
          itemKey: initial.itemKey,
          brand: initial.brand,
          quantity: initial.quantity,
          unit: initial.unit,
          unitPrice: initial.unitPrice,
          discountPct: initial.discountPct,
        }
      : emptyItemForm(),
  );
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const filtered = catalogItems.filter((i) => i.name.toLowerCase().includes(search.trim().toLowerCase()));
  const selectedItem = findCatalogItem(catalogItems, form.itemKey);
  const brands = selectedItem?.brands || [];

  const selectItem = (key) => {
    const item = findCatalogItem(catalogItems, key);
    const brand = item?.brands?.[0];
    setForm((f) => ({ ...f, itemKey: key, unit: item?.unit || "", brand: brand?.name || "", unitPrice: brand?.unitPrice ?? "" }));
  };

  const selectBrand = (name) => {
    const brand = brands.find((b) => b.name === name);
    setForm((f) => ({ ...f, brand: name, unitPrice: brand?.unitPrice ?? f.unitPrice }));
  };

  const total = lineTotal(form);

  const save = async () => {
    if (!form.itemKey) {
      setError("Select an item.");
      return;
    }
    if (!form.brand) {
      setError("Select a brand.");
      return;
    }
    if (!(Number(form.quantity) > 0)) {
      setError("Quantity must be greater than zero.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSave({
        itemKey: form.itemKey,
        itemName: selectedItem?.name || "",
        brand: form.brand,
        unit: form.unit,
        quantity: Number(form.quantity),
        unitPrice: Number(form.unitPrice) || 0,
        discountPct: Number(form.discountPct) || 0,
      });
    } catch (err) {
      setError(typeof err === "string" ? err : err?.message || "Could not save the item.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      title={initial ? "Edit item" : "Add item"}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save item"}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Search items" className="span-2">
          <input type="text" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name…" />
        </Field>
        <Field label="Item" className="span-2" hint={catalogLoading ? "loading catalog…" : undefined}>
          <select value={form.itemKey} disabled={catalogLoading} onChange={(e) => selectItem(e.target.value)}>
            <option value="">Select an item</option>
            {filtered.map((i) => (
              <option key={i.key} value={i.key}>
                {i.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Brand">
          <select value={form.brand} disabled={!selectedItem} onChange={(e) => selectBrand(e.target.value)}>
            <option value="">Select a brand</option>
            {brands.map((b) => (
              <option key={b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Unit" hint="auto from item">
          <input type="text" value={form.unit} disabled />
        </Field>
        <Field label="Quantity">
          <NumberInput value={form.quantity} min={0} onChange={(v) => setForm((f) => ({ ...f, quantity: v }))} />
        </Field>
        <Field label="Unit price" hint="auto from item + brand, editable">
          <NumberInput value={form.unitPrice} min={0} onChange={(v) => setForm((f) => ({ ...f, unitPrice: v }))} />
        </Field>
        <Field label="Discount %">
          <NumberInput value={form.discountPct} min={0} max={100} onChange={(v) => setForm((f) => ({ ...f, discountPct: v }))} />
        </Field>
      </div>
      <p className="lede" style={{ marginTop: 12 }}>
        Line total: <strong>{formatCurrency(total, { withCents: true })}</strong>
      </p>
      {error ? (
        <Alert tone="danger" style={{ marginTop: 12 }}>
          {error}
        </Alert>
      ) : null}
    </Modal>
  );
}

const TAX_TREATMENT_HINT = {
  exclusive: "Prices below are GST-exclusive — GST is added on top.",
  inclusive: "Prices below are GST-inclusive — GST is already included in the total.",
  no_gst: "No GST applies to this quote.",
};

export default function QuoteBuilder({ opp, canEdit }) {
  const dispatch = useAppDispatch();
  const { error: notifyError } = useNotifications();
  const quote = useAppSelector((s) => s.leads.quote);
  const catalogItems = useAppSelector((s) => s.catalog.items);
  const catalogStatus = useAppSelector((s) => s.catalog.status);
  const [modal, setModal] = useState(null); // null closed, { item } open (item null = add, set = edit)
  const [deleteId, setDeleteId] = useState(null);
  const [deletingItemBusy, setDeletingItemBusy] = useState(false);
  const [downloadingInvoice, setDownloadingInvoice] = useState(false);
  const [creating, setCreating] = useState(false);
  const [projectDraft, setProjectDraft] = useState("");
  const [projectTypeOtherDraft, setProjectTypeOtherDraft] = useState("");
  const [gstRateDraft, setGstRateDraft] = useState(10);
  const [costDrafts, setCostDrafts] = useState({});

  useEffect(() => {
    if (catalogStatus === "idle") dispatch(fetchCatalog());
  }, [catalogStatus, dispatch]);

  useEffect(() => {
    if (!quote) return;
    setProjectDraft(quote.project || "");
    setProjectTypeOtherDraft(quote.projectTypeOther || "");
    setGstRateDraft(quote.gstRatePct ?? 10);
    const nextCostDrafts = {};
    for (const c of quote.additionalCosts) nextCostDrafts[c.id] = { value: c.value, description: c.description };
    setCostDrafts(nextCostDrafts);
  }, [quote]);

  const createQuote = async () => {
    setCreating(true);
    try {
      await dispatch(createOpportunityQuote(opp.id)).unwrap();
    } catch (err) {
      notifyError(typeof err === "string" ? err : err?.message || "Could not create the quote.");
    } finally {
      setCreating(false);
    }
  };

  if (!quote) {
    return (
      <div className="section" style={{ marginTop: 20 }}>
        <SectionHead icon={<FileSpreadsheet size={13} />} title="Quote" />
        <p className="lede" style={{ marginBottom: 12 }}>
          Estimation is ready — create a quote to start pricing this job.
        </p>
        {canEdit ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={createQuote} disabled={creating}>
            {creating ? "Creating…" : "Create Quote"}
          </button>
        ) : null}
      </div>
    );
  }

  const items = itemsSubtotal(quote.items);
  const gst = quoteGstBreakdown({
    itemsTotal: items.total,
    additionalCosts: quote.additionalCosts,
    taxTreatment: quote.taxTreatment,
    gstRatePct: quote.gstRatePct,
  });
  const deletingItem = quote.items.find((i) => i.id === deleteId);

  const patchHeaderField = (field, value) => dispatch(updateOpportunityQuote({ id: opp.id, body: { [field]: value } }));

  const blurProject = () => {
    if (projectDraft !== (quote.project || "")) patchHeaderField("project", projectDraft);
  };
  const blurProjectTypeOther = () => {
    if (projectTypeOtherDraft !== (quote.projectTypeOther || "")) patchHeaderField("projectTypeOther", projectTypeOtherDraft);
  };
  const blurGstRate = () => {
    const value = Number(gstRateDraft) || 0;
    if (value !== quote.gstRatePct) patchHeaderField("gstRatePct", value);
  };

  const saveItem = async (values) => {
    if (modal.item) await dispatch(updateQuoteItem({ id: opp.id, itemId: modal.item.id, body: values })).unwrap();
    else await dispatch(addQuoteItem({ id: opp.id, body: values })).unwrap();
    setModal(null);
  };

  const confirmDeleteItem = async () => {
    setDeletingItemBusy(true);
    try {
      await dispatch(deleteQuoteItem({ id: opp.id, itemId: deleteId })).unwrap();
      setDeleteId(null);
    } catch (err) {
      notifyError(typeof err === "string" ? err : err?.message || "Could not delete the item.");
    } finally {
      setDeletingItemBusy(false);
    }
  };

  const addCost = async () => {
    try {
      await dispatch(
        addQuoteCost({
          id: opp.id,
          body: { costType: ADDITIONAL_COST_TYPES[0], calcType: "fixed", value: 0, description: "" },
        }),
      ).unwrap();
    } catch (err) {
      notifyError(typeof err === "string" ? err : err?.message || "Could not add the cost.");
    }
  };

  const patchCostField = (costId, patch) => dispatch(updateQuoteCost({ id: opp.id, costId, body: patch }));

  const setCostDraftField = (costId, field, value) =>
    setCostDrafts((d) => ({ ...d, [costId]: { ...d[costId], [field]: value } }));

  const blurCostField = (cost, field) => {
    const draft = costDrafts[cost.id];
    if (!draft) return;
    const value = field === "value" ? Number(draft.value) || 0 : draft.description;
    if (value !== cost[field]) patchCostField(cost.id, { [field]: value });
  };

  const removeCost = async (costId) => {
    try {
      await dispatch(deleteQuoteCost({ id: opp.id, costId })).unwrap();
    } catch (err) {
      notifyError(typeof err === "string" ? err : err?.message || "Could not remove the cost.");
    }
  };

  const handleDownloadInvoice = async () => {
    setDownloadingInvoice(true);
    try {
      await downloadInvoice({ opp, quote });
    } catch (err) {
      notifyError(typeof err === "string" ? err : err?.message || "Could not generate the invoice.");
    } finally {
      setDownloadingInvoice(false);
    }
  };

  return (
    <div className="section" style={{ marginTop: 20 }}>
      <SectionHead icon={<FileSpreadsheet size={13} />} title="Quote" />

      <div className="form-grid" style={{ marginBottom: 20 }}>
        <Field label="Quote No">
          <input type="text" value={quote.quoteNumber} disabled />
        </Field>
        <Field label="Customer">
          <input type="text" value={quote.customer} disabled />
        </Field>
        <Field label="Estimator">
          <input type="text" value={quote.estimatorName || "—"} disabled />
        </Field>
        <Field label="Project" className="span-2">
          <input
            type="text"
            value={projectDraft}
            disabled={!canEdit}
            placeholder="e.g. 100 kW Solar + 200 kWh Battery"
            onChange={(e) => setProjectDraft(e.target.value)}
            onBlur={blurProject}
          />
        </Field>
        <Field label="Project type">
          <select value={quote.projectType} disabled={!canEdit} onChange={(e) => patchHeaderField("projectType", e.target.value)}>
            {PROJECT_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </Field>
        {quote.projectType === "Other" ? (
          <Field label="Specify project type">
            <input
              type="text"
              value={projectTypeOtherDraft}
              disabled={!canEdit}
              placeholder="e.g. EV Charging"
              onChange={(e) => setProjectTypeOtherDraft(e.target.value)}
              onBlur={blurProjectTypeOther}
            />
          </Field>
        ) : null}
        <Field label="Quote date">
          <input
            type="date"
            value={quote.quoteDate}
            disabled={!canEdit}
            onChange={(e) => patchHeaderField("quoteDate", e.target.value)}
          />
        </Field>
      </div>

      {canEdit ? (
        <button type="button" className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }} onClick={() => setModal({ item: null })}>
          <Plus size={14} /> Add Item
        </button>
      ) : null}
      {catalogStatus === "failed" ? (
        <Alert tone="danger" style={{ marginBottom: 12 }}>
          Could not load the product catalog — try again shortly.
        </Alert>
      ) : null}

      {quote.items.length ? (
        <div className="table-wrap">
          <table className="table stack">
            <thead>
              <tr>
                <th>Item</th>
                <th>Brand</th>
                <th>Qty</th>
                <th>Unit</th>
                <th>Unit Price</th>
                <th>Discount</th>
                <th>Total</th>
                {canEdit ? <th>Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {quote.items.map((item) => (
                <tr key={item.id}>
                  <td data-label="Item">{item.itemName}</td>
                  <td data-label="Brand">{item.brand}</td>
                  <td data-label="Qty">{item.quantity}</td>
                  <td data-label="Unit">{item.unit}</td>
                  <td data-label="Unit Price">{formatCurrency(item.unitPrice, { withCents: true })}</td>
                  <td data-label="Discount">{item.discountPct}%</td>
                  <td data-label="Total">{formatCurrency(lineTotal(item), { withCents: true })}</td>
                  {canEdit ? (
                    <td data-label="Actions">
                      <div style={{ display: "flex", gap: 6 }}>
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setModal({ item })} aria-label="Edit item">
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setDeleteId(item.id)}
                          aria-label="Delete item"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="lede">No items yet — add the first line item.</p>
      )}

      <div style={{ marginTop: 24 }}>
        <SectionHead icon={<Receipt size={13} />} title="Additional costs" />
        {canEdit ? (
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }} onClick={addCost}>
            <Plus size={14} /> Add Cost
          </button>
        ) : null}

        {quote.additionalCosts.length ? (
          <div className="table-wrap">
            <table className="table stack">
              <thead>
                <tr>
                  <th>Cost Type</th>
                  <th>Calculation Type</th>
                  <th>Value</th>
                  <th>Calculated Amount</th>
                  <th>Description</th>
                  {canEdit ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {quote.additionalCosts.map((cost) => {
                  const draft = costDrafts[cost.id] || { value: cost.value, description: cost.description };
                  return (
                    <tr key={cost.id}>
                      <td data-label="Cost Type">
                        {canEdit ? (
                          <select value={cost.costType} onChange={(e) => patchCostField(cost.id, { costType: e.target.value })}>
                            {ADDITIONAL_COST_TYPES.map((t) => (
                              <option key={t} value={t}>
                                {t}
                              </option>
                            ))}
                          </select>
                        ) : (
                          cost.costType
                        )}
                      </td>
                      <td data-label="Calculation Type">
                        {canEdit ? (
                          <select value={cost.calcType} onChange={(e) => patchCostField(cost.id, { calcType: e.target.value })}>
                            <option value="fixed">Fixed Amount</option>
                            <option value="percentage">Percentage</option>
                          </select>
                        ) : cost.calcType === "percentage" ? (
                          "Percentage"
                        ) : (
                          "Fixed Amount"
                        )}
                      </td>
                      <td data-label="Value">
                        {canEdit ? (
                          <NumberInput
                            value={draft.value}
                            min={0}
                            max={cost.calcType === "percentage" ? 100 : undefined}
                            onChange={(v) => setCostDraftField(cost.id, "value", v)}
                            onBlur={() => blurCostField(cost, "value")}
                          />
                        ) : cost.calcType === "percentage" ? (
                          `${cost.value}%`
                        ) : (
                          formatCurrency(cost.value, { withCents: true })
                        )}
                      </td>
                      <td data-label="Calculated Amount">{formatCurrency(additionalCostAmount(cost, items.total), { withCents: true })}</td>
                      <td data-label="Description">
                        {canEdit ? (
                          <input
                            type="text"
                            value={draft.description}
                            placeholder="Optional"
                            onChange={(e) => setCostDraftField(cost.id, "description", e.target.value)}
                            onBlur={() => blurCostField(cost, "description")}
                          />
                        ) : (
                          cost.description || "—"
                        )}
                      </td>
                      {canEdit ? (
                        <td data-label="Actions">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={() => removeCost(cost.id)}
                            aria-label="Delete cost"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="lede">No additional costs yet.</p>
        )}
      </div>

      <div style={{ marginTop: 24 }}>
        <SectionHead icon={<Receipt size={13} />} title="Tax treatment" />
        <div className="form-grid" style={{ marginBottom: 8 }}>
          <Field label="Tax treatment">
            <select
              value={quote.taxTreatment}
              disabled={!canEdit}
              onChange={(e) => patchHeaderField("taxTreatment", e.target.value)}
            >
              {TAX_TREATMENTS.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="GST rate">
            <NumberInput
              value={gstRateDraft}
              min={0}
              max={100}
              disabled={!canEdit || quote.taxTreatment === "no_gst"}
              onChange={setGstRateDraft}
              onBlur={blurGstRate}
            />
          </Field>
        </div>
        <Badge tone="neutral">{TAX_TREATMENT_HINT[quote.taxTreatment]}</Badge>
      </div>

      <div className="list-stack" style={{ marginTop: 20, maxWidth: 320, marginLeft: "auto" }}>
        <div className="list-row">
          <span className="row-title">Items subtotal</span>
          <span className="row-meta">{formatCurrency(items.beforeDiscount, { withCents: true })}</span>
        </div>
        <div className="list-row">
          <span className="row-title">Item discounts</span>
          <span className="row-meta">-{formatCurrency(items.discount, { withCents: true })}</span>
        </div>
        <div className="list-row">
          <span className="row-title">Additional costs</span>
          <span className="row-meta">{formatCurrency(gst.costsTotal, { withCents: true })}</span>
        </div>
        <div className="list-row">
          <span className="row-title">Pre-Tax Total</span>
          <span className="row-meta">{formatCurrency(gst.preTaxTotal, { withCents: true })}</span>
        </div>
        <div className="list-row">
          <span className="row-title">GST {quote.taxTreatment !== "no_gst" ? `(${quote.gstRatePct}%)` : ""}</span>
          <span className="row-meta">{formatCurrency(gst.gst, { withCents: true })}</span>
        </div>
        <div className="list-row">
          <span className="row-title">Grand Total</span>
          <span className="row-meta">
            <strong>{formatCurrency(gst.grandTotal, { withCents: true })}</strong>
          </span>
        </div>
      </div>

      <div style={{ marginTop: 16, textAlign: "right" }}>
        <button type="button" className="btn btn-ghost btn-sm" onClick={handleDownloadInvoice} disabled={downloadingInvoice}>
          <Download size={14} /> {downloadingInvoice ? "Preparing…" : "Download Invoice"}
        </button>
      </div>

      {modal ? (
        <ItemModal
          initial={modal.item}
          catalogItems={catalogItems}
          catalogLoading={catalogStatus === "loading"}
          onSave={saveItem}
          onClose={() => setModal(null)}
        />
      ) : null}

      {deletingItem ? (
        <Modal
          title="Delete item"
          body={`Remove ${deletingItem.itemName} (${deletingItem.brand}) from this quote?`}
          onClose={() => setDeleteId(null)}
          actions={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setDeleteId(null)} disabled={deletingItemBusy}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={confirmDeleteItem} disabled={deletingItemBusy}>
                {deletingItemBusy ? "Deleting…" : "Delete"}
              </button>
            </>
          }
        />
      ) : null}
    </div>
  );
}
