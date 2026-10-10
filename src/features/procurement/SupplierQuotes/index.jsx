// The supplier quotes received on a job, as the record has them — shown above
// the supplier-quote checklist (CL-12) so the coordinator confirms against
// what actually came in. `onAdd(body)` records one as it arrives,
// `onRemove(index)` takes out one recorded in error. This is the record of
// each quote; the chosen prices go on the BOQ lines just below (BoqPricing).

import { useState } from "react";
import { FileText, Plus, X } from "lucide-react";
import Alert from "@/components/Alert";
import Field from "@/components/Field";
import SectionHead from "@/components/SectionHead";
import { boqLines, quotedLineCount, quotesReceived } from "@/helpers/procurement";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { formatCurrency } from "@/utils/formatCurrency";

const errText = (err, fallback) => (typeof err === "string" ? err : err?.message || fallback);
const today = () => new Date().toISOString().slice(0, 10);
const blank = () => ({ supplier: "", total: "", validUntil: "", receivedAt: today() });

export default function SupplierQuotes({ job, canEdit = false, onAdd, onRemove }) {
  const quotes = Array.isArray(job?.quotes) ? job.quotes : [];
  const lines = boqLines(job).length;
  const quoted = quotedLineCount(job);
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(blank());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  // Suppliers already named on the BOQ, offered as suggestions.
  const suppliers = [...new Set(boqLines(job).map((line) => line.supplier).filter(Boolean))];

  const run = async (action, after) => {
    setBusy(true);
    setError("");
    try {
      await action();
      after?.();
    } catch (err) {
      setError(errText(err, "The quote could not be saved."));
    } finally {
      setBusy(false);
    }
  };
  const add = () =>
    run(
      () => onAdd?.({ supplier: form.supplier.trim(), total: Number(form.total), validUntil: form.validUntil || null, receivedAt: form.receivedAt || null }),
      () => {
        setAdding(false);
        setForm(blank());
      },
    );

  return (
    <div style={{ marginBottom: 20 }}>
      {quotesReceived(job) ? (
        <Alert tone="success">Every line is quoted — {quotes.length} supplier quote{quotes.length === 1 ? "" : "s"} on record.</Alert>
      ) : (
        <Alert tone="info">
          {quoted} of {lines} lines priced so far. Record each quote here as it comes in, compare them, then price the BOQ lines
          below from the one chosen; the checklist is worked once that is done.
        </Alert>
      )}
      <div className="estimation-item-head">
        <SectionHead icon={<FileText size={13} />} title="Quotes received" />
        {canEdit && !adding ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(true)}>
            <Plus size={14} /> Record a quote
          </button>
        ) : null}
      </div>
      {error ? (
        <Alert tone="danger" style={{ marginBottom: 10 }}>
          {error}
        </Alert>
      ) : null}
      {adding ? (
        <div className="decision-card" style={{ marginBottom: 12 }}>
          <div className="form-grid">
            <Field label="Supplier" required>
              <input list="boq-suppliers" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} placeholder="e.g. Solar Juice" />
              <datalist id="boq-suppliers">
                {suppliers.map((supplier) => (
                  <option key={supplier} value={supplier} />
                ))}
              </datalist>
            </Field>
            <Field label="Quote total ($)" required>
              <input type="number" min={0} step="0.01" value={form.total} onChange={(e) => setForm({ ...form, total: e.target.value })} />
            </Field>
            <Field label="Received on">
              <input type="date" value={form.receivedAt} onChange={(e) => setForm({ ...form, receivedAt: e.target.value })} />
            </Field>
            <Field label="Valid until" hint="optional">
              <input type="date" value={form.validUntil} onChange={(e) => setForm({ ...form, validUntil: e.target.value })} />
            </Field>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={add} disabled={busy || !form.supplier.trim() || form.total === ""}>
              <Plus size={14} /> {busy ? "Saving…" : "Record quote"}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(false)} disabled={busy}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      {quotes.length === 0 ? (
        <p className="lede" style={{ fontSize: 14 }}>
          None yet.
        </p>
      ) : (
        <div className="list-stack">
          {quotes.map((quote, index) => (
            <div className="list-row" key={`${quote.supplier}-${quote.receivedAt}-${index}`}>
              <div>
                <div className="row-title">{quote.supplier}</div>
                <div className="row-meta">
                  Received {formatDate(quote.receivedAt)}
                  {quote.validUntil ? ` · valid until ${formatDate(quote.validUntil)}` : ""}
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div className="row-title" style={{ textAlign: "right" }}>
                  {formatCurrency(quote.total)}
                </div>
                {canEdit ? (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => run(() => onRemove?.(index))} disabled={busy} aria-label={`Remove the ${quote.supplier} quote`}>
                    <X size={14} />
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
