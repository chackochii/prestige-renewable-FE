// AI-assisted quote — opened from the Quote Builder on a draft.
//
// Two ways in, one dialog:
//   From the job details — say what is wanted (optional), wait while the
//     model reads the job and the catalog, then review what it proposes.
//   From an electricity bill — choose a bill on the job or upload one, let
//     the AI read its figures, check and correct them, then the quote is
//     sized from the bill: the review adds the usage, the size that would
//     cover it and the quoted system's indicative savings and payback.
//
// Nothing reaches the quote until "Add to draft" — and then only the lines
// left ticked, into the draft, where they are edited like any other line.
// Generating the quote stays the estimator's own step. Item prices are the
// catalog's, filled in by the server; the model only chooses items, brands
// and quantities. The costs, rebates and discounts it proposes are its
// estimates and are labelled so.

import { useState } from "react";
import { ArrowLeft, RefreshCw, Sparkles, Zap } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Field from "@/components/Field";
import LoadingState from "@/components/LoadingState";
import Modal from "@/components/Modal";
import { COST_KINDS } from "@/constants/catalog";
import { additionalCostAmount, itemsSubtotal, lineTotal, quoteGstBreakdown } from "@/helpers/quote";
import { applyAiQuote, readAiBill, suggestAiQuote, uploadOpportunityAttachment } from "@/slices/leadsSlice";
import { useAppDispatch, useAppSelector } from "@/store";
import { formatCurrency } from "@/utils/formatCurrency";
import { isReadableBill, readingHasUsage } from "@/helpers/energyBill";
import { BillPicker, BillReadingForm, EnergySummary } from "./AiQuoteBill";

const errText = (err, fallback) => (typeof err === "string" ? err : err?.message || fallback);
const money = (value) => formatCurrency(value, { withCents: true });
const allOf = (list) => new Set(list.map((_, index) => index));

const EXAMPLES = "e.g. 6.6 kW system with premium panels, allow for a double-storey install, keep it under $9,000";
const BILL_EXAMPLES = "e.g. add a 10 kWh battery, premium panels, stay under $12,000";

/** What a set of lines comes to with the quote's tax settings. */
const totalsOf = (items, costs, quote) => {
  const subtotal = itemsSubtotal(items);
  return {
    subtotal,
    ...quoteGstBreakdown({ itemsTotal: subtotal.total, additionalCosts: costs, taxTreatment: quote.taxTreatment, gstRatePct: quote.gstRatePct }),
  };
};

export default function AiQuoteModal({ opp, quote, startWith = "job", onApplied, onClose }) {
  const dispatch = useAppDispatch();
  const [source, setSource] = useState(startWith === "bill" ? "bill" : "job");
  const [instructions, setInstructions] = useState("");
  const [thinking, setThinking] = useState(false);
  const [suggestion, setSuggestion] = useState(null);
  const [error, setError] = useState("");
  const [keptItems, setKeptItems] = useState(new Set());
  const [keptCosts, setKeptCosts] = useState(new Set());
  const existingLines = quote.items.length + quote.additionalCosts.length;
  const [mode, setMode] = useState("replace");
  const [applying, setApplying] = useState(false);

  // The bill: which one (null = the newest readable), what the AI read off it.
  const attachments = useAppSelector((s) => s.leads.attachments);
  const bills = attachments.filter((a) => a.category === "bill");
  const [billId, setBillId] = useState(null);
  const chosenBillId = billId ?? bills.find(isReadableBill)?.id ?? null;
  const [uploading, setUploading] = useState(false);
  const [readingBill, setReadingBill] = useState(false);
  const [billDoc, setBillDoc] = useState(null); // { id, filename } — the bill read
  const [reading, setReading] = useState(null); // its figures, as the estimator corrects them

  const fromBill = source === "bill";
  const busy = thinking || applying || readingBill || uploading;

  const readBill = async (documentId) => {
    setReadingBill(true);
    setError("");
    try {
      const result = await dispatch(readAiBill({ id: opp.id, body: { documentId } })).unwrap();
      setBillDoc(result.document);
      setReading(result.reading);
    } catch (err) {
      setError(errText(err, "Could not read the bill."));
    } finally {
      setReadingBill(false);
    }
  };

  // An uploaded bill is filed with the job's bills, then read straight away.
  const uploadBill = async (file) => {
    if (!isReadableBill(file)) {
      setError("The AI reads a bill from a PDF or a photo (JPG, PNG, WEBP or HEIC).");
      return;
    }
    setUploading(true);
    setError("");
    let uploaded;
    try {
      uploaded = await dispatch(uploadOpportunityAttachment({ id: opp.id, category: "bill", file })).unwrap();
    } catch (err) {
      setError(errText(err, "Could not upload the bill."));
      return;
    } finally {
      setUploading(false);
    }
    setBillId(uploaded.id);
    await readBill(uploaded.id);
  };

  const ask = async () => {
    setThinking(true);
    setError("");
    try {
      const body = fromBill ? { instructions, bill: reading } : { instructions };
      const next = await dispatch(suggestAiQuote({ id: opp.id, body })).unwrap();
      setSuggestion(next);
      setKeptItems(allOf(next.items));
      setKeptCosts(allOf(next.costs));
    } catch (err) {
      setError(errText(err, "Could not get an AI quote."));
    } finally {
      setThinking(false);
    }
  };

  const toggle = (setKept, index) =>
    setKept((kept) => {
      const next = new Set(kept);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const items = suggestion ? suggestion.items.filter((_, index) => keptItems.has(index)) : [];
  const costs = suggestion ? suggestion.costs.filter((_, index) => keptCosts.has(index)) : [];
  // What the ticked lines come to — on top of the draft's own lines when adding.
  const totals = totalsOf(mode === "add" ? [...quote.items, ...items] : items, mode === "add" ? [...quote.additionalCosts, ...costs] : costs, quote);
  // The payback is on the whole proposal, ticked or not: the savings are the whole system's.
  const proposalTotal = suggestion?.energy ? totalsOf(suggestion.items, suggestion.costs, quote).grandTotal : 0;

  const apply = async () => {
    setApplying(true);
    setError("");
    try {
      await dispatch(
        applyAiQuote({
          id: opp.id,
          body: {
            mode: existingLines ? mode : "replace",
            items: items.map(({ itemKey, brand, quantity }) => ({ itemKey, brand, quantity })),
            costs,
            // The title and type are only filled in where the estimator has not set them.
            ...(quote.project ? {} : { project: suggestion.project }),
            ...(quote.projectType ? {} : { projectType: suggestion.projectType }),
            ...(fromBill && billDoc ? { billDocumentId: billDoc.id } : {}),
          },
        }),
      ).unwrap();
      onApplied({ items: items.length, costs: costs.length, fromBill: fromBill && Boolean(billDoc) });
    } catch (err) {
      setError(errText(err, "Could not add the lines to the draft."));
      setApplying(false);
    }
  };

  const nothingKept = !items.length && !costs.length;
  // Where the dialog is: choosing, checking the bill's figures, or reviewing a proposal.
  const step = suggestion ? "review" : fromBill && reading ? "bill" : "start";

  const backToBill = () => {
    setSuggestion(null);
    setError("");
  };
  const chooseAnotherBill = () => {
    setReading(null);
    setBillDoc(null);
    setError("");
  };

  let actions;
  if (step === "review") {
    actions = (
      <>
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={applying}>
          Cancel
        </button>
        {fromBill ? (
          <button type="button" className="btn btn-ghost" onClick={backToBill} disabled={busy}>
            <ArrowLeft size={14} /> Bill figures
          </button>
        ) : null}
        <button type="button" className="btn btn-ghost" onClick={ask} disabled={busy}>
          <RefreshCw size={14} /> {thinking ? "Thinking…" : "Ask again"}
        </button>
        <button type="button" className="btn btn-primary" onClick={apply} disabled={busy || nothingKept}>
          {applying ? "Adding…" : existingLines && mode === "replace" ? "Replace draft lines" : "Add to draft"}
        </button>
      </>
    );
  } else if (step === "bill") {
    actions = (
      <>
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={thinking}>
          Cancel
        </button>
        <button type="button" className="btn btn-ghost" onClick={chooseAnotherBill} disabled={busy}>
          <ArrowLeft size={14} /> Another bill
        </button>
        <button type="button" className="btn btn-primary" onClick={ask} disabled={busy || !readingHasUsage(reading)}>
          <Sparkles size={14} /> {thinking ? "Building…" : "Build quote from bill"}
        </button>
      </>
    );
  } else if (fromBill) {
    actions = (
      <>
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={() => readBill(chosenBillId)} disabled={busy || !chosenBillId}>
          <Zap size={14} /> {readingBill ? "Reading…" : "Read bill"}
        </button>
      </>
    );
  } else {
    actions = (
      <>
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={thinking}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" onClick={ask} disabled={thinking}>
          <Sparkles size={14} /> {thinking ? "Thinking…" : "Build quote"}
        </button>
      </>
    );
  }

  const instructionsField = (
    <Field label={suggestion ? "Change something" : "Instructions"} hint="optional">
      <textarea
        rows={2}
        maxLength={1000}
        value={instructions}
        disabled={busy}
        placeholder={
          suggestion
            ? "e.g. swap to a hybrid inverter and add a 10 kWh battery - then Ask again"
            : fromBill
              ? BILL_EXAMPLES
              : EXAMPLES
        }
        onChange={(e) => setInstructions(e.target.value)}
      />
    </Field>
  );

  return (
    <Modal
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          {fromBill ? <Zap size={18} /> : <Sparkles size={18} />} {fromBill ? "Quote from an electricity bill" : "Build quote with AI"}
        </span>
      }
      className="document"
      // Only a reading or a proposal on screen is worth a "close without saving?".
      confirmClose={Boolean(suggestion || reading) && !applying}
      closeWarning={
        suggestion
          ? "The proposed quote has not been added to the draft and will be lost."
          : "The figures read from the bill, and any corrections, will be lost. The bill stays on the job."
      }
      onClose={onClose}
      actions={actions}
    >
      {step === "start" ? (
        <div className="segmented ai-quote-source" role="tablist" aria-label="Build the quote from">
          <button type="button" role="tab" aria-selected={!fromBill} className={fromBill ? "" : "active"} disabled={busy} onClick={() => setSource("job")}>
            <Sparkles size={14} /> From the job details
          </button>
          <button type="button" role="tab" aria-selected={fromBill} className={fromBill ? "active" : ""} disabled={busy} onClick={() => setSource("bill")}>
            <Zap size={14} /> From an electricity bill
          </button>
        </div>
      ) : null}

      <p className="lede" style={{ marginBottom: 16, maxWidth: "none" }}>
        {step === "start" && fromBill
          ? "Choose the customer's electricity bill or upload it. The AI reads the usage and tariff off it, you check the figures, then it sizes the system and proposes the quote."
          : step === "bill"
            ? "Check what the AI read off the bill and correct anything it got wrong - the system is sized from these figures."
            : "The AI reads this job's details and the product catalog and proposes the quote's lines. You review them before anything is added, and item prices always come from the catalog."}
      </p>

      {step === "start" && fromBill ? (
        <BillPicker bills={bills} selectedId={chosenBillId} onSelect={setBillId} onUpload={uploadBill} uploading={uploading} disabled={busy} />
      ) : null}
      {step === "start" && !fromBill ? instructionsField : null}

      {step === "bill" ? (
        <>
          <BillReadingForm document={billDoc} reading={reading} onChange={setReading} disabled={busy} />
          <div style={{ marginTop: 16 }}>{instructionsField}</div>
        </>
      ) : null}

      {step === "review" ? instructionsField : null}

      {step === "start" && !busy ? (
        <p className="row-meta" style={{ marginTop: 10 }}>
          {fromBill
            ? "The bill file is sent to the AI service to be read. Bills show the customer's name and address; only the usage and tariff figures are kept, and nothing is saved to the quote until you add it."
            : "Sent to the AI service: the job's technical details and notes, the site's state and postcode, and the catalog. The customer's name, contact details and street address are not sent."}
        </p>
      ) : null}

      {error ? (
        <Alert tone="danger" style={{ marginTop: 14 }}>
          {error}
        </Alert>
      ) : null}

      {readingBill ? (
        <div style={{ marginTop: 16 }}>
          <LoadingState label="Reading the bill - this can take up to a minute…" />
        </div>
      ) : null}
      {thinking ? (
        <div style={{ marginTop: 16 }}>
          <LoadingState
            label={fromBill ? "Sizing the system from the bill and building the quote - this can take up to a minute…" : "Reading the job and the catalog - this can take up to a minute…"}
          />
        </div>
      ) : null}

      {suggestion && !thinking ? (
        <div style={{ marginTop: 18 }}>
          <div className="ai-quote-summary">
            <div className="row-title">
              {suggestion.project || "Proposed quote"}{" "}
              {suggestion.projectType ? <Badge tone="info">{suggestion.projectType}</Badge> : null}
            </div>
            {suggestion.summary ? <p>{suggestion.summary}</p> : null}
          </div>

          {suggestion.energy ? <EnergySummary energy={suggestion.energy} proposalTotal={proposalTotal} /> : null}

          <div className="table-wrap" style={{ marginTop: 14 }}>
            <table className="table stack">
              <thead>
                <tr>
                  <th>Add</th>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Unit Price</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {suggestion.items.map((item, index) => (
                  <tr key={`${item.itemKey}-${item.brand}`} className={keptItems.has(index) ? "" : "ai-quote-off"}>
                    <td data-label="Add">
                      <input
                        type="checkbox"
                        checked={keptItems.has(index)}
                        disabled={applying}
                        aria-label={`Add ${item.itemName} (${item.brand})`}
                        onChange={() => toggle(setKeptItems, index)}
                      />
                    </td>
                    <td data-label="Item">
                      <div className="row-title">{item.itemName}</div>
                      <div className="row-meta">{item.brand}</div>
                      {item.reason ? <div className="row-meta ai-quote-reason">{item.reason}</div> : null}
                    </td>
                    <td data-label="Qty">
                      {item.quantity} {item.unit}
                    </td>
                    <td data-label="Unit Price">{money(item.unitPrice)}</td>
                    <td data-label="Total">{money(lineTotal(item))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {suggestion.costs.length ? (
            <div className="table-wrap" style={{ marginTop: 14 }}>
              <table className="table stack">
                <thead>
                  <tr>
                    <th>Add</th>
                    <th>Cost, rebate or discount</th>
                    <th>Value</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {suggestion.costs.map((cost, index) => (
                    <tr key={`${cost.kind}-${cost.costType}-${index}`} className={keptCosts.has(index) ? "" : "ai-quote-off"}>
                      <td data-label="Add">
                        <input
                          type="checkbox"
                          checked={keptCosts.has(index)}
                          disabled={applying}
                          aria-label={`Add ${cost.costType}`}
                          onChange={() => toggle(setKeptCosts, index)}
                        />
                      </td>
                      <td data-label="Line">
                        <div className="row-title">
                          {cost.costType} <Badge tone="warning">AI estimate</Badge>
                        </div>
                        <div className="row-meta">{COST_KINDS[cost.kind].label}</div>
                        {cost.description ? <div className="row-meta ai-quote-reason">{cost.description}</div> : null}
                      </td>
                      <td data-label="Value">{cost.calcType === "percentage" ? `${cost.value}%` : money(cost.value)}</td>
                      <td data-label="Amount">{money(additionalCostAmount(cost, totals.subtotal.total))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          <div className="ai-quote-foot">
            <div className="ai-quote-notes">
              {suggestion.checks.length ? (
                <div>
                  <div className="row-title">Check before generating</div>
                  <ul>
                    {suggestion.checks.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {suggestion.assumptions.length ? (
                <div>
                  <div className="row-title">Assumed</div>
                  <ul>
                    {suggestion.assumptions.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {suggestion.dropped.length ? (
                <div>
                  <div className="row-title">Left out</div>
                  <ul>
                    {suggestion.dropped.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>

            <div className="list-stack ai-quote-totals">
              <div className="list-row">
                <span className="row-title">Pre-tax total</span>
                <span className="row-meta">{money(totals.preTaxTotal)}</span>
              </div>
              <div className="list-row">
                <span className="row-title">GST</span>
                <span className="row-meta">{money(totals.gst)}</span>
              </div>
              <div className="list-row">
                <span className="row-title">Grand total</span>
                <span className="row-meta">
                  <strong>{money(totals.grandTotal)}</strong>
                </span>
              </div>
            </div>
          </div>

          {existingLines ? (
            <div className="ai-quote-mode" role="radiogroup" aria-label="What to do with the lines already on the draft">
              <label>
                <input type="radio" name="ai-quote-mode" checked={mode === "replace"} disabled={applying} onChange={() => setMode("replace")} />
                Replace the {existingLines} line{existingLines === 1 ? "" : "s"} on the draft
              </label>
              <label>
                <input type="radio" name="ai-quote-mode" checked={mode === "add"} disabled={applying} onChange={() => setMode("add")} />
                Keep them and add these
              </label>
            </div>
          ) : null}
        </div>
      ) : null}
    </Modal>
  );
}
