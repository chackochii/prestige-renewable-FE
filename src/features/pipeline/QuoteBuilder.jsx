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
import { BadgePercent, Download, Eye, FileSpreadsheet, HandCoins, History, Pencil, Plus, Receipt, Save, Trash2 } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Field from "@/components/Field";
import LoadingState from "@/components/LoadingState";
import Modal from "@/components/Modal";
import NumberInput from "@/components/NumberInput";
import SectionHead from "@/components/SectionHead";
import { COST_KINDS, PROJECT_TYPES, TAX_TREATMENTS } from "@/constants/catalog";
import {
  additionalCostAmount,
  costsOfKind,
  findCatalogItem,
  itemsSubtotal,
  lineTotal,
  quoteGstBreakdown,
} from "@/helpers/quote";
import { downloadInvoice, invoicePreviewUrl, invoiceSnapshot, matchesSnapshot, versionOf } from "@/helpers/invoice";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { formatCurrency } from "@/utils/formatCurrency";
import { useAppDispatch, useAppSelector } from "@/store";
import { fetchCatalog } from "@/slices/catalogSlice";
import {
  addQuoteCost,
  addQuoteItem,
  createOpportunityQuote,
  deleteQuoteCost,
  deleteQuoteItem,
  fetchQuoteVersions,
  saveQuoteVersion,
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

const errText = (err, fallback) => (typeof err === "string" ? err : err?.message || fallback);

/**
 * Shows the quote PDF in the browser. `source` is { version } for a saved
 * version or {} for the live quote; the blob URL is released on close.
 */
function QuotePreviewModal({ opp, quote, source, title, actions, onClose }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let created = null;
    invoicePreviewUrl({ opp, quote, version: source.version })
      .then((next) => {
        created = next;
        if (cancelled) URL.revokeObjectURL(next);
        else setUrl(next);
      })
      .catch((err) => {
        if (!cancelled) setError(errText(err, "Could not build the quote PDF."));
      });
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
    // Built once per open — the modal is remounted for each preview.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Modal title={title} className="document" onClose={onClose} actions={actions}>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {!url && !error ? <LoadingState label="Building the PDF…" /> : null}
      {url ? <iframe className="invoice-frame" src={url} title={title} /> : null}
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
  const { notify, error: notifyError } = useNotifications();
  const quote = useAppSelector((s) => s.leads.quote);
  const catalogItems = useAppSelector((s) => s.catalog.items);
  const catalogStatus = useAppSelector((s) => s.catalog.status);
  const [modal, setModal] = useState(null); // null closed, { item } open (item null = add, set = edit)
  const [deleteId, setDeleteId] = useState(null);
  const [deletingItemBusy, setDeletingItemBusy] = useState(false);
  const [downloading, setDownloading] = useState(null); // "draft" | version id
  const [savingVersion, setSavingVersion] = useState(false);
  const [preview, setPreview] = useState(null); // null closed, { version? } open
  const versions = useAppSelector((s) => s.leads.versions);
  const versionsStatus = useAppSelector((s) => s.leads.versionsStatus);
  const versionsError = useAppSelector((s) => s.leads.versionsError);
  const [creating, setCreating] = useState(false);
  const [projectDraft, setProjectDraft] = useState("");
  const [projectTypeOtherDraft, setProjectTypeOtherDraft] = useState("");
  const [gstRateDraft, setGstRateDraft] = useState(10);
  const [costDrafts, setCostDrafts] = useState({});

  useEffect(() => {
    if (catalogStatus === "idle") dispatch(fetchCatalog());
  }, [catalogStatus, dispatch]);

  const hasQuote = Boolean(quote);
  useEffect(() => {
    if (hasQuote) dispatch(fetchQuoteVersions(opp.id));
  }, [hasQuote, opp.id, dispatch]);

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

  // The server numbers the versions; the list comes back newest first, so a
  // row with no number falls back to its position in the list.
  const latestVersion = versions.reduce((max, v) => Math.max(max, versionOf(v) ?? 0), 0);
  const nextVersion = (latestVersion || versions.length) + 1;
  const savedMatch = versions.some((version) => matchesSnapshot({ opp, quote }, version));
  const versionLabel = (version) => `Version ${versionOf(version) ?? versions.length - versions.indexOf(version)}`;

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

  const addCost = async (kind) => {
    try {
      await dispatch(
        addQuoteCost({
          id: opp.id,
          body: { kind, costType: COST_KINDS[kind].types[0], calcType: "fixed", value: 0, description: "" },
        }),
      ).unwrap();
    } catch (err) {
      notifyError(errText(err, `Could not add the ${COST_KINDS[kind].label.toLowerCase()}.`));
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
      notifyError(errText(err, "Could not remove the line."));
    }
  };

  /**
   * One of the three cost sections. They work the same way — only the cost
   * types on offer and whether the amount is added or deducted differ.
   */
  const costSection = ({ kind, icon, addLabel, emptyText, hint }) => {
    const meta = COST_KINDS[kind];
    const rows = costsOfKind(quote.additionalCosts, kind);
    return (
      <div style={{ marginTop: 24 }}>
        <SectionHead icon={icon} title={`${meta.label}s`} />
        {hint ? (
          <p className="lede" style={{ marginBottom: 12 }}>
            {hint}
          </p>
        ) : null}
        {canEdit ? (
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }} onClick={() => addCost(kind)}>
            <Plus size={14} /> {addLabel}
          </button>
        ) : null}

        {rows.length ? (
          <div className="table-wrap">
            <table className="table stack">
              <thead>
                <tr>
                  <th>{meta.label} type</th>
                  <th>Calculation Type</th>
                  <th>Value</th>
                  <th>{meta.deduction ? "Deducted" : "Calculated Amount"}</th>
                  <th>Description</th>
                  {canEdit ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((cost) => {
                  const draft = costDrafts[cost.id] || { value: cost.value, description: cost.description };
                  return (
                    <tr key={cost.id}>
                      <td data-label={`${meta.label} type`}>
                        {canEdit ? (
                          <select value={cost.costType} onChange={(e) => patchCostField(cost.id, { costType: e.target.value })}>
                            {[...new Set([...meta.types, cost.costType].filter(Boolean))].map((t) => (
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
                      <td data-label={meta.deduction ? "Deducted" : "Calculated Amount"}>
                        {formatCurrency(additionalCostAmount(cost, items.total), { withCents: true })}
                      </td>
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
                            aria-label={`Delete ${meta.label.toLowerCase()}`}
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
          <p className="lede">{emptyText}</p>
        )}
      </div>
    );
  };

  /** Downloads the live quote as a draft, or one of the saved versions. */
  const handleDownload = async (version) => {
    setDownloading(version?.id ?? "draft");
    try {
      await downloadInvoice({ opp, quote, version });
    } catch (err) {
      notifyError(errText(err, "Could not generate the PDF."));
    } finally {
      setDownloading(null);
    }
  };

  /** Freezes the quote as it stands into a new version. */
  const handleSaveVersion = async () => {
    setSavingVersion(true);
    try {
      const snapshot = invoiceSnapshot({ opp, quote });
      const saved = await dispatch(
        saveQuoteVersion({
          id: opp.id,
          body: { quoteNumber: quote.quoteNumber, version: nextVersion, grandTotal: snapshot.grandTotal, snapshot },
        }),
      ).unwrap();
      notify(`Version ${versionOf(saved) ?? nextVersion} saved`);
      setPreview(null);
    } catch (err) {
      notifyError(errText(err, "Could not save the version."));
    } finally {
      setSavingVersion(false);
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

      <div style={{ marginBottom: 24 }}>
        <SectionHead icon={<Receipt size={13} />} title="Tax treatment" />
        <p className="lede" style={{ marginBottom: 12 }}>
          Set this before adding items — it decides how every price below is read.
        </p>
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

      {costSection({
        kind: "cost",
        icon: <Receipt size={13} />,
        addLabel: "Add Cost",
        emptyText: "No additional costs yet.",
      })}

      {costSection({
        kind: "rebate",
        icon: <HandCoins size={13} />,
        addLabel: "Add Rebate",
        emptyText: "No rebates yet.",
        hint: "Entered as positive values and taken off the quote before GST.",
      })}

      {costSection({
        kind: "discount",
        icon: <BadgePercent size={13} />,
        addLabel: "Add Discount",
        emptyText: "No discounts yet.",
        hint: "Entered as positive values and taken off the quote before GST.",
      })}

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
          <span className="row-meta">{formatCurrency(gst.chargesTotal, { withCents: true })}</span>
        </div>
        {gst.rebatesTotal ? (
          <div className="list-row">
            <span className="row-title">Rebates</span>
            <span className="row-meta">-{formatCurrency(gst.rebatesTotal, { withCents: true })}</span>
          </div>
        ) : null}
        {gst.discountsTotal ? (
          <div className="list-row">
            <span className="row-title">Discounts</span>
            <span className="row-meta">-{formatCurrency(gst.discountsTotal, { withCents: true })}</span>
          </div>
        ) : null}
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

      <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
        {savedMatch ? (
          <Badge tone="success">Saved as a version</Badge>
        ) : versions.length ? (
          <Badge tone="warning">Edited since version {latestVersion || versions.length}</Badge>
        ) : null}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPreview({})}>
          <Eye size={14} /> View current quote
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => handleDownload(null)}
          disabled={downloading === "draft"}
        >
          <Download size={14} /> {downloading === "draft" ? "Preparing…" : "Download draft"}
        </button>
        {canEdit ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleSaveVersion}
            disabled={savingVersion || savedMatch}
            title={savedMatch ? "Nothing has changed since the last saved version" : undefined}
          >
            <Save size={14} /> {savingVersion ? "Saving…" : `Save version ${nextVersion}`}
          </button>
        ) : null}
      </div>

      <div style={{ marginTop: 28 }}>
        <SectionHead icon={<History size={13} />} title="Quote versions" />
        <p className="lede" style={{ marginBottom: 12 }}>
          Every saved version keeps the quote exactly as it was — open one to preview it, or download it as a PDF.
          Editing the quote lets you save the next version.
        </p>
        {versionsStatus === "loading" && !versions.length ? (
          <LoadingState label="Loading versions…" />
        ) : versionsError ? (
          <Alert tone="warning">Saved versions could not be loaded ({versionsError}).</Alert>
        ) : versions.length ? (
          <div className="table-wrap">
            <table className="table stack">
              <thead>
                <tr>
                  <th>Version</th>
                  <th>Saved</th>
                  <th>Saved by</th>
                  <th>Total</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {versions.map((version) => (
                  <tr key={version.id}>
                    <td data-label="Version">
                      <button
                        type="button"
                        className="enquiry-link quote-version-link"
                        onClick={() => setPreview({ version })}
                        disabled={!version.snapshot}
                      >
                        {versionLabel(version)}
                      </button>
                      <div className="row-meta">
                        Quote {version.quoteNumber || version.snapshot?.quote?.quoteNumber || "—"}
                        {version.invoiceNumber ? ` · Invoice ${version.invoiceNumber}` : ""}
                        {matchesSnapshot({ opp, quote }, version) ? " · matches the quote now" : ""}
                      </div>
                    </td>
                    <td data-label="Saved">{formatDate(version.createdAt, { withTime: true })}</td>
                    <td data-label="Saved by">{version.createdByName || "—"}</td>
                    <td data-label="Total">
                      {formatCurrency(version.grandTotal ?? version.snapshot?.grandTotal, { withCents: true })}
                    </td>
                    <td data-label="Actions">
                      <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => setPreview({ version })}
                          disabled={!version.snapshot}
                          aria-label={`Preview ${versionLabel(version)}`}
                        >
                          <Eye size={14} /> Preview
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleDownload(version)}
                          disabled={!version.snapshot || downloading === version.id}
                          aria-label={`Download ${versionLabel(version)}`}
                        >
                          <Download size={14} /> {downloading === version.id ? "Preparing…" : "Download"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="lede">No versions saved yet. Use “Save version 1” to keep a copy of the quote as it stands.</p>
        )}
      </div>

      {preview ? (
        <QuotePreviewModal
          opp={opp}
          quote={quote}
          source={preview}
          title={preview.version ? `${quote.quoteNumber} · ${versionLabel(preview.version)}` : `${quote.quoteNumber} · current quote`}
          onClose={() => setPreview(null)}
          actions={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setPreview(null)}>
                Close
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => handleDownload(preview.version || null)}
                disabled={downloading !== null}
              >
                <Download size={14} /> Download
              </button>
              {!preview.version && canEdit && !savedMatch ? (
                <button type="button" className="btn btn-primary" onClick={handleSaveVersion} disabled={savingVersion}>
                  <Save size={14} /> {savingVersion ? "Saving…" : `Save version ${nextVersion}`}
                </button>
              ) : null}
            </>
          }
        />
      ) : null}

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
