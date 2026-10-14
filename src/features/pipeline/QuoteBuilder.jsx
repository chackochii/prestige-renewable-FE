// Create Quote / Quote Builder — appears within the Estimation module once
// estimation is ready to quote (see EstimationPanel's showQuoteBuilder).
//
// Backed by the prestige-be quote endpoints (see fetchOpportunityQuote /
// createOpportunityQuote / *QuoteItem / *QuoteCost thunks in
// slices/leadsSlice.js); the quote lives on the server (state.leads.quote).
//
// The quote's life: a draft while it is built — every change saves as it is
// made — then generated: frozen as the next version and locked, nothing on it
// can be edited. To change a generated quote the estimator creates a new
// quote, which is the same quote as a draft again, pre-filled with every
// line, cost and setting of the generated version; generating that makes the
// next version. A new quote nothing was changed on can be cancelled, which
// locks it back onto the version it came from.
//
// Selects/dates dispatch immediately on change (discrete, infrequent).
// Free-text and number fields (project, project type "Other", GST rate, a
// cost's value/description) are buffered locally and dispatch on blur, so
// typing doesn't fire a request per keystroke. "Save draft" sends whatever
// is still buffered and says so — the draft strip reads "Unsaved changes"
// while anything typed has not reached the record, and "Saved just now"
// once it has. Generating waits until the draft is saved.

import { useEffect, useRef, useState } from "react";
import { BadgePercent, Download, Eye, FileCheck, FilePlus, FileSpreadsheet, HandCoins, History, Lock, Pencil, Plus, Receipt, Save, Trash2, Undo2 } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Field from "@/components/Field";
import LoadingState from "@/components/LoadingState";
import Modal from "@/components/Modal";
import NumberInput from "@/components/NumberInput";
import SectionHead from "@/components/SectionHead";
import { COST_KINDS, PROJECT_TYPES, TAX_TREATMENTS, costKind } from "@/constants/catalog";
import {
  additionalCostAmount,
  costsOfKind,
  findCatalogItem,
  itemsSubtotal,
  lineTotal,
  quoteGstBreakdown,
} from "@/helpers/quote";
import { downloadInvoice, invoicePreviewUrl, invoiceSnapshot, matchesSnapshot, versionOf } from "@/helpers/invoice";
import { formatDate, timeAgo } from "@/helpers/dateTimeHelpers";
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
  startQuoteDraft,
  updateOpportunityQuote,
  updateQuoteCost,
  updateQuoteItem,
} from "@/slices/leadsSlice";
import { useNotifications } from "@/hooks/useNotifications";

const emptyItemForm = () => ({ itemKey: "", brand: "", quantity: 1, unit: "", unitPrice: "", discountPct: 0 });

// The Unit field takes numbers only. A catalog or saved unit that is a word
// ("unit", "panel") starts the field empty rather than putting text in it.
const numericUnit = (value) => {
  const text = String(value ?? "").trim();
  return text !== "" && Number.isFinite(Number(text)) ? text : "";
};

function ItemModal({ initial, catalogItems, catalogLoading, onSave, onClose }) {
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(() =>
    initial
      ? {
          itemKey: initial.itemKey,
          brand: initial.brand,
          quantity: initial.quantity,
          unit: numericUnit(initial.unit),
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
    setForm((f) => ({ ...f, itemKey: key, unit: numericUnit(item?.unit), brand: brand?.name || "", unitPrice: brand?.unitPrice ?? "" }));
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
    if (String(form.unit ?? "").trim() !== "" && !Number.isFinite(Number(form.unit))) {
      setError("Unit must be a number.");
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
        unit: String(form.unit ?? "").trim(),
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
        <Field label="Unit" hint="numbers only">
          <NumberInput value={form.unit} min={0} step="any" onChange={(v) => setForm((f) => ({ ...f, unit: v }))} />
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
function QuotePreviewModal({ opp, quote, unit, source, title, actions, onClose }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    let created = null;
    invoicePreviewUrl({ opp, quote, unit, version: source.version })
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
    <Modal confirmClose={false} title={title} className="document" onClose={onClose} actions={actions}>
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

export default function QuoteBuilder({ opp, unit, canEdit }) {
  const dispatch = useAppDispatch();
  const { notify, error: notifyError } = useNotifications();
  const quote = useAppSelector((s) => s.leads.quote);
  // Generated = locked: the builder is read-only until a new quote is started.
  const locked = quote?.status === "generated";
  const editable = canEdit && !locked;
  const catalogItems = useAppSelector((s) => s.catalog.items);
  const catalogStatus = useAppSelector((s) => s.catalog.status);
  const [modal, setModal] = useState(null); // null closed, { item } open (item null = add, set = edit)
  const [deleteId, setDeleteId] = useState(null);
  const [deletingItemBusy, setDeletingItemBusy] = useState(false);
  const [downloading, setDownloading] = useState(null); // the version id being prepared
  const [savingVersion, setSavingVersion] = useState(false);
  const [startingDraft, setStartingDraft] = useState(false);
  const [preview, setPreview] = useState(null); // null closed, { version } open
  const [history, setHistory] = useState(false); // the earlier versions, in a modal
  const versions = useAppSelector((s) => s.leads.versions);
  const versionsStatus = useAppSelector((s) => s.leads.versionsStatus);
  const versionsError = useAppSelector((s) => s.leads.versionsError);
  const [creating, setCreating] = useState(false);
  const [projectDraft, setProjectDraft] = useState("");
  const [projectTypeOtherDraft, setProjectTypeOtherDraft] = useState("");
  const [gstRateDraft, setGstRateDraft] = useState(10);
  const [costDrafts, setCostDrafts] = useState({});
  const [savingDraft, setSavingDraft] = useState(false);
  // When the draft last reached the record (any change saved — a field, an
  // item, a cost), for the "Saved just now" in the draft strip. Set from the
  // requests themselves, so nothing is called saved that was only loaded.
  const [savedAt, setSavedAt] = useState(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  /** Marks the draft saved once a quote request succeeds; returns the thunk promise untouched. */
  const tracked = (promise) => {
    promise.then((action) => {
      if (!action?.error && mounted.current) setSavedAt(new Date());
    });
    return promise;
  };

  useEffect(() => {
    if (catalogStatus === "idle") dispatch(fetchCatalog());
  }, [catalogStatus, dispatch]);

  const hasQuote = Boolean(quote);
  useEffect(() => {
    if (hasQuote) dispatch(fetchQuoteVersions(opp.id));
  }, [hasQuote, opp.id, dispatch]);

  // The typed-but-unsent fields follow the quote the server returns — but only
  // the ones nobody has touched. Every save answers with the whole quote, and
  // with a slow database an earlier save lands while the person is already
  // typing in the next field; resetting every draft then wiped what they had
  // typed. A field is "untouched" while it still equals the server value it
  // was last set from (`seen`).
  const seen = useRef(null);
  useEffect(() => {
    if (!quote) return;
    const before = seen.current?.id === quote.id ? seen.current : null;
    const same = (draft, was) => !before || String(draft ?? "") === String(was ?? "");
    seen.current = {
      id: quote.id,
      project: quote.project || "",
      other: quote.projectTypeOther || "",
      gst: quote.gstRatePct ?? 10,
      costs: Object.fromEntries(quote.additionalCosts.map((c) => [c.id, { value: c.value, description: c.description }])),
    };
    setProjectDraft((d) => (same(d, before?.project) ? quote.project || "" : d));
    setProjectTypeOtherDraft((d) => (same(d, before?.other) ? quote.projectTypeOther || "" : d));
    setGstRateDraft((d) => (same(d, before?.gst) ? quote.gstRatePct ?? 10 : d));
    setCostDrafts((drafts) => {
      const next = {};
      for (const c of quote.additionalCosts) {
        const mine = drafts[c.id];
        const was = before?.costs[c.id];
        next[c.id] = {
          ...(mine?.otherName !== undefined ? { otherName: mine.otherName } : {}),
          value: !mine || !was || same(mine.value, was.value) ? c.value : mine.value,
          description: !mine || !was || same(mine.description, was.description) ? c.description : mine.description,
        };
      }
      return next;
    });
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
        {editable ? (
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
  // The one the buttons act on, and the rest behind the link.
  const latest = versions.length
    ? versions.reduce((best, v) => ((versionOf(v) ?? 0) > (versionOf(best) ?? 0) ? v : best), versions[0])
    : null;
  const earlier = versions.filter((v) => v.id !== latest?.id);

  const items = itemsSubtotal(quote.items);
  const gst = quoteGstBreakdown({
    itemsTotal: items.total,
    additionalCosts: quote.additionalCosts,
    taxTreatment: quote.taxTreatment,
    gstRatePct: quote.gstRatePct,
  });
  const deletingItem = quote.items.find((i) => i.id === deleteId);

  const patchHeader = (body) => tracked(dispatch(updateOpportunityQuote({ id: opp.id, body })));
  const patchHeaderField = (field, value) => patchHeader({ [field]: value });

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
    if (modal.item) await tracked(dispatch(updateQuoteItem({ id: opp.id, itemId: modal.item.id, body: values }))).unwrap();
    else await tracked(dispatch(addQuoteItem({ id: opp.id, body: values }))).unwrap();
    setModal(null);
  };

  const confirmDeleteItem = async () => {
    setDeletingItemBusy(true);
    try {
      await tracked(dispatch(deleteQuoteItem({ id: opp.id, itemId: deleteId }))).unwrap();
      setDeleteId(null);
    } catch (err) {
      notifyError(typeof err === "string" ? err : err?.message || "Could not delete the item.");
    } finally {
      setDeletingItemBusy(false);
    }
  };

  const addCost = async (kind) => {
    try {
      await tracked(
        dispatch(
          addQuoteCost({
            id: opp.id,
            body: { kind, costType: COST_KINDS[kind].types[0], calcType: "fixed", value: 0, description: "" },
          }),
        ),
      ).unwrap();
    } catch (err) {
      notifyError(errText(err, `Could not add the ${COST_KINDS[kind].label.toLowerCase()}.`));
    }
  };

  const patchCostField = (costId, patch) => tracked(dispatch(updateQuoteCost({ id: opp.id, costId, body: patch })));

  const setCostDraftField = (costId, field, value) =>
    setCostDrafts((d) => ({ ...d, [costId]: { ...d[costId], [field]: value } }));

  const blurCostField = (cost, field) => {
    const draft = costDrafts[cost.id];
    if (!draft || draft[field] === undefined) return;
    const value = field === "value" ? Number(draft.value) || 0 : draft.description;
    if (value !== cost[field]) patchCostField(cost.id, { [field]: value });
  };

  const removeCost = async (costId) => {
    try {
      await tracked(dispatch(deleteQuoteCost({ id: opp.id, costId }))).unwrap();
    } catch (err) {
      notifyError(errText(err, "Could not remove the line."));
    }
  };

  // ---- What is typed but not yet on the record ----
  // The buffered fields, compared with the quote the server last returned.
  // Items and costs save the moment they are added or edited in their modal,
  // so only these fields can be pending.
  const headerEdits = {};
  if (projectDraft !== (quote.project || "")) headerEdits.project = projectDraft;
  if (quote.projectType === "Other" && projectTypeOtherDraft !== (quote.projectTypeOther || "")) headerEdits.projectTypeOther = projectTypeOtherDraft;
  if (quote.taxTreatment !== "no_gst" && (Number(gstRateDraft) || 0) !== quote.gstRatePct) headerEdits.gstRatePct = Number(gstRateDraft) || 0;
  const costEdits = [];
  for (const cost of quote.additionalCosts) {
    const draft = costDrafts[cost.id];
    if (!draft) continue;
    const patch = {};
    if (draft.value !== undefined && (Number(draft.value) || 0) !== cost.value) patch.value = Number(draft.value) || 0;
    if (draft.description !== undefined && draft.description !== cost.description) patch.description = draft.description;
    const otherType = COST_KINDS[costKind(cost)].otherType;
    if (otherType && draft.otherName !== undefined) {
      const next = String(draft.otherName ?? "").trim() || otherType;
      if (next !== cost.costType) patch.costType = next;
    }
    if (Object.keys(patch).length) costEdits.push([cost.id, patch]);
  }
  const dirty = Object.keys(headerEdits).length > 0 || costEdits.length > 0;
  const saveStatus = dirty ? "Unsaved changes" : savedAt ? `Saved ${timeAgo(savedAt)}` : "All changes saved";

  /** Sends whatever is still buffered — one request for the header, one per cost — and says so. */
  const saveDraft = async () => {
    setSavingDraft(true);
    try {
      const hadEdits = dirty;
      await Promise.all([
        ...(Object.keys(headerEdits).length ? [patchHeader(headerEdits).unwrap()] : []),
        ...costEdits.map(([costId, patch]) => patchCostField(costId, patch).unwrap()),
      ]);
      setSavedAt(new Date());
      notify(hadEdits ? "Draft saved" : "Draft saved — everything is already on the record");
    } catch (err) {
      notifyError(errText(err, "Could not save the draft."));
    } finally {
      setSavingDraft(false);
    }
  };

  const saveButton = (
    <button
      type="button"
      className={`btn btn-sm ${dirty ? "btn-primary" : "btn-ghost"}`}
      onClick={saveDraft}
      disabled={savingDraft}
      title={dirty ? "Save what you have typed" : "Everything is saved — save again anyway"}
    >
      <Save size={14} /> {savingDraft ? "Saving…" : "Save draft"}
    </button>
  );

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
        {editable ? (
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
                  {editable ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {rows.map((cost) => {
                  const draft = { value: cost.value, description: cost.description, ...costDrafts[cost.id] };
                  // "Other": a type outside the list is a name the estimator typed.
                  const otherType = meta.otherType;
                  const isOther = Boolean(otherType) && (cost.costType === otherType || !meta.types.includes(cost.costType));
                  const otherName = draft.otherName ?? (cost.costType === otherType ? "" : cost.costType);
                  return (
                    <tr key={cost.id}>
                      <td data-label={`${meta.label} type`}>
                        {editable ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8, minWidth: 180 }}>
                            <select
                              value={isOther ? otherType : cost.costType}
                              onChange={(e) => {
                                setCostDraftField(cost.id, "otherName", undefined);
                                patchCostField(cost.id, { costType: e.target.value });
                              }}
                            >
                              {(otherType ? meta.types : [...new Set([...meta.types, cost.costType].filter(Boolean))]).map((t) => (
                                <option key={t} value={t}>
                                  {t === otherType ? "Other" : t}
                                </option>
                              ))}
                            </select>
                            {isOther ? (
                              <input
                                type="text"
                                maxLength={50}
                                value={otherName}
                                placeholder={`Name the ${meta.label.toLowerCase()}`}
                                aria-label={`Other ${meta.label.toLowerCase()} name`}
                                onChange={(e) => setCostDraftField(cost.id, "otherName", e.target.value)}
                                onBlur={() => {
                                  const name = String(otherName ?? "").trim();
                                  const next = name || otherType;
                                  if (next !== cost.costType) patchCostField(cost.id, { costType: next });
                                }}
                              />
                            ) : null}
                          </div>
                        ) : cost.costType === otherType ? (
                          "Other"
                        ) : (
                          cost.costType
                        )}
                      </td>
                      <td data-label="Calculation Type">
                        {editable ? (
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
                        {editable ? (
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
                        {editable ? (
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
                      {editable ? (
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

  /** Downloads one generated version as a PDF — there is no PDF of a draft. */
  const handleDownload = async (version) => {
    setDownloading(version.id);
    try {
      await downloadInvoice({ opp, quote, unit, version });
    } catch (err) {
      notifyError(errText(err, "Could not generate the PDF."));
    } finally {
      setDownloading(null);
    }
  };

  /**
   * Generates the quote: frozen as the next version and locked. An unchanged
   * new quote comes back locked onto the version it was started from — the
   * server decides, so "cancel new quote" is this same call.
   */
  const handleGenerate = async () => {
    setSavingVersion(true);
    try {
      const snapshot = invoiceSnapshot({ opp, quote });
      const generated = await dispatch(
        saveQuoteVersion({
          id: opp.id,
          body: { quoteNumber: quote.quoteNumber, version: nextVersion, grandTotal: snapshot.grandTotal, snapshot },
        }),
      ).unwrap();
      const number = versionOf(generated) ?? nextVersion;
      if (savedMatch) notify(`New quote cancelled — ${quote.quoteNumber} stays at version ${number}`, "info");
      else notify(`Version ${number} generated — the quote is now locked`);
    } catch (err) {
      notifyError(errText(err, "Could not generate the quote."));
    } finally {
      setSavingVersion(false);
    }
  };

  /** A new quote from the generated one: a draft again, pre-filled from it. */
  const handleNewQuote = async () => {
    setStartingDraft(true);
    try {
      await dispatch(startQuoteDraft(opp.id)).unwrap();
      notify(`New quote started from version ${latestVersion} — edit it, then generate it as version ${latestVersion + 1}`, "info");
    } catch (err) {
      notifyError(errText(err, "Could not start a new quote."));
    } finally {
      setStartingDraft(false);
    }
  };

  const generatedVersion = quote.generatedVersion ?? latest;

  return (
    <div className="section" style={{ marginTop: 20 }}>
      <SectionHead icon={<FileSpreadsheet size={13} />} title="Quote" />

      {/* ---- Where the quote is in its life ----
          Locked once generated; a draft saves as it is edited. */}
      {locked ? (
        <Alert tone="info" style={{ marginBottom: 16 }}>
          <div className="quote-state">
            <span className="quote-state-text">
              <Lock size={14} />
              <span>
                <strong>Generated as version {versionOf(generatedVersion) ?? latestVersion}</strong>
                {generatedVersion?.createdAt ? ` on ${formatDate(generatedVersion.createdAt, { withTime: true })}` : ""}
                {generatedVersion?.createdByName ? ` by ${generatedVersion.createdByName}` : ""} — this quote is locked and cannot be edited.
                {canEdit ? " To change anything, create a new quote: it starts from this one." : ""}
              </span>
            </span>
            {canEdit ? (
              <button type="button" className="btn btn-primary btn-sm" onClick={handleNewQuote} disabled={startingDraft}>
                <FilePlus size={14} /> {startingDraft ? "Starting…" : "Create new quote"}
              </button>
            ) : null}
          </div>
        </Alert>
      ) : (
        <div className="quote-state" style={{ marginBottom: 16 }}>
          <p className="lede quote-state-text" style={{ margin: 0 }}>
            <Badge tone="warning">Draft</Badge>
            <span>
              {versions.length ? `New quote from version ${latestVersion}. ` : ""}
              Save the draft as you go — generate it when it is final to lock it as version {nextVersion}.
            </span>
          </p>
          {editable ? (
            <span className="save-bar">
              <span className={`row-meta${dirty ? " is-dirty" : ""}`}>{saveStatus}</span>
              {saveButton}
            </span>
          ) : null}
        </div>
      )}

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
            disabled={!editable}
            placeholder="e.g. 100 kW Solar + 200 kWh Battery"
            onChange={(e) => setProjectDraft(e.target.value)}
            onBlur={blurProject}
          />
        </Field>
        <Field label="Project type">
          <select value={quote.projectType} disabled={!editable} onChange={(e) => patchHeaderField("projectType", e.target.value)}>
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
              disabled={!editable}
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
            disabled={!editable}
            onChange={(e) => patchHeaderField("quoteDate", e.target.value)}
          />
        </Field>
      </div>

      {editable ? (
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
                {editable ? <th>Actions</th> : null}
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
                  {editable ? (
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

      {/* Asked once there is something to apply it to: the treatment decides how
          the prices on the lines above are read, so it has no meaning on an
          empty quote. */}
      {quote.items.length ? (
        <div style={{ marginTop: 24 }}>
          <SectionHead icon={<Receipt size={13} />} title="Tax treatment" />
          <p className="lede" style={{ marginBottom: 12 }}>
            How the prices on the lines above are read.
          </p>
          <div className="form-grid" style={{ marginBottom: 8 }}>
            <Field label="Tax treatment">
              <select
                value={quote.taxTreatment}
                disabled={!editable}
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
                disabled={!editable || quote.taxTreatment === "no_gst"}
                onChange={setGstRateDraft}
                onBlur={blurGstRate}
              />
            </Field>
          </div>
          <Badge tone="neutral">{TAX_TREATMENT_HINT[quote.taxTreatment]}</Badge>
        </div>
      ) : null}

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

      {/* ---- Generating, and the PDFs that come out of it ----
          A PDF is only ever of a generated version: there is nothing to
          preview or download until the quote has been generated, and on a new
          quote the buttons stay on the version it came from until it is
          generated again. */}
      {versionsError ? (
        <Alert tone="warning" style={{ marginTop: 16 }}>
          Generated versions could not be loaded ({versionsError}).
        </Alert>
      ) : null}

      <div className="quote-version-bar">
        {versionsStatus === "loading" && !versions.length ? <LoadingState label="Loading versions…" /> : null}

        {editable ? saveButton : null}
        {editable ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={handleGenerate}
            disabled={savingVersion || savedMatch || dirty || !quote.items.length}
            title={
              !quote.items.length
                ? "Add an item before generating the quote"
                : dirty
                  ? "Save the draft first"
                  : savedMatch
                    ? `Nothing has changed since version ${latestVersion}`
                    : undefined
            }
          >
            <FileCheck size={14} />{" "}
            {savingVersion ? "Generating…" : versions.length ? `Generate version ${nextVersion}` : "Generate quote"}
          </button>
        ) : null}
        {editable && savedMatch && !dirty ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleGenerate}
            disabled={savingVersion}
            title={`Nothing has changed — lock the quote back onto version ${latestVersion}`}
          >
            <Undo2 size={14} /> Cancel new quote
          </button>
        ) : null}
        {locked && canEdit ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={handleNewQuote} disabled={startingDraft}>
            <FilePlus size={14} /> {startingDraft ? "Starting…" : "Create new quote"}
          </button>
        ) : null}

        {latest ? (
          <span className="quote-version-latest">
            <span className="row-lines">
              <span className="row-title">{versionLabel(latest)}</span>
              <span className="row-meta">
                {formatCurrency(latest.grandTotal ?? latest.snapshot?.grandTotal, { withCents: true })} ·{" "}
                {locked ? "generated — locked" : savedMatch ? "unchanged in the new quote" : "the new quote has changed"}
              </span>
            </span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setPreview({ version: latest })}
              disabled={!latest.snapshot}
              title={`Preview ${versionLabel(latest)}`}
              aria-label={`Preview ${versionLabel(latest)}`}
            >
              <Eye size={14} />
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => handleDownload(latest)}
              disabled={!latest.snapshot || downloading === latest.id}
              title={`Download ${versionLabel(latest)}`}
              aria-label={`Download ${versionLabel(latest)}`}
            >
              <Download size={14} />
            </button>
          </span>
        ) : null}

        {earlier.length ? (
          <button type="button" className="enquiry-link quote-version-link" onClick={() => setHistory(true)}>
            <History size={13} /> Previous version{earlier.length === 1 ? "" : "s"} ({earlier.length})
          </button>
        ) : null}
      </div>

      {!versions.length && versionsStatus !== "loading" ? (
        <p className="lede" style={{ marginTop: 10 }}>
          {quote.items.length
            ? "Generate the quote to get the PDF — preview and download come from a generated version, and generating locks the quote."
            : "Add the items, then generate the quote to get the PDF."}
        </p>
      ) : null}

      {history ? (
        <Modal
          title="Generated versions"
          body={`Every version of ${quote.quoteNumber} that was generated, exactly as it was then.`}
          confirmClose={false}
          onClose={() => setHistory(false)}
          actions={
            <button type="button" className="btn btn-ghost" onClick={() => setHistory(false)}>
              Close
            </button>
          }
        >
          <div className="list-stack">
            {versions.map((version) => (
              <div className="list-row" key={version.id}>
                <span className="row-lines">
                  <span className="row-title">
                    {versionLabel(version)}
                    {version.id === latest?.id ? " · latest" : ""}
                  </span>
                  <span className="row-meta">
                    {formatCurrency(version.grandTotal ?? version.snapshot?.grandTotal, { withCents: true })} ·{" "}
                    {formatDate(version.createdAt, { withTime: true })}
                    {version.createdByName ? ` · ${version.createdByName}` : ""}
                  </span>
                </span>
                <span style={{ display: "flex", gap: 6 }}>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      setHistory(false);
                      setPreview({ version });
                    }}
                    disabled={!version.snapshot}
                    title={`Preview ${versionLabel(version)}`}
                    aria-label={`Preview ${versionLabel(version)}`}
                  >
                    <Eye size={14} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => handleDownload(version)}
                    disabled={!version.snapshot || downloading === version.id}
                    title={`Download ${versionLabel(version)}`}
                    aria-label={`Download ${versionLabel(version)}`}
                  >
                    <Download size={14} />
                  </button>
                </span>
              </div>
            ))}
          </div>
        </Modal>
      ) : null}

      {preview ? (
        <QuotePreviewModal
          opp={opp}
          quote={quote}
          unit={unit}
          source={preview}
          title={`${quote.quoteNumber} · ${versionLabel(preview.version)}`}
          onClose={() => setPreview(null)}
          actions={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setPreview(null)}>
                Close
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => handleDownload(preview.version)}
                disabled={downloading !== null}
              >
                <Download size={14} /> Download
              </button>
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
          confirmClose={false}
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
