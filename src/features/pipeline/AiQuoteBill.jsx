// The electricity-bill steps of the AI-assisted quote (AiQuoteModal):
//
//   BillPicker      — choose a bill already on the job, or upload one (it is
//                     filed with the job's other bills, like any upload).
//   BillReadingForm — what the AI read off the bill, every figure editable:
//                     the estimator corrects a misread before a quote is
//                     built from it.
//   EnergySummary   — beside the proposed lines: the usage, the size that
//                     would cover it, the quoted system's generation and
//                     indicative savings, and the payback on the proposal.
//
// The reading and the sizing come from the server (energyBillService); the
// only sum done here is the payback, because it depends on the lines shown.

import { useRef } from "react";
import { ExternalLink, FileText, Upload } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Field from "@/components/Field";
import NumberInput from "@/components/NumberInput";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { isReadableBill, readingHasUsage } from "@/helpers/energyBill";
import { formatCurrency } from "@/utils/formatCurrency";

const BILL_ACCEPT = ".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif";

const amount = (value, digits = 0) => Number(value).toLocaleString("en-AU", { maximumFractionDigits: digits });
const blank = (value) => value === null || value === undefined || value === "";

const TARIFF_LABELS = { flat: "Single rate", time_of_use: "Time of use", demand: "Demand", unknown: "Not sure" };
const CONFIDENCE_TONES = { high: "success", medium: "info", low: "warning" };

// ---- Choosing the bill ----------------------------------------------------------

export function BillPicker({ bills, selectedId, onSelect, onUpload, uploading, disabled }) {
  const inputRef = useRef(null);
  return (
    <div className="ai-bill-picker">
      {bills.length ? (
        <div className="list-stack" role="radiogroup" aria-label="Electricity bills on this job">
          {bills.map((bill) => {
            const readable = isReadableBill(bill);
            return (
              <label key={bill.id} className={`list-row ai-bill-option${readable ? "" : " is-off"}`}>
                <span className="ai-bill-option-main">
                  <input
                    type="radio"
                    name="ai-bill"
                    checked={selectedId === bill.id}
                    disabled={disabled || !readable}
                    onChange={() => onSelect(bill.id)}
                  />
                  <FileText size={15} />
                  <span className="row-lines">
                    <span className="row-title">{bill.filename}</span>
                    <span className="row-meta">
                      {readable ? `Added ${formatDate(bill.createdAt)}${bill.uploaderName ? ` by ${bill.uploaderName}` : ""}` : "The AI reads PDFs and photos only"}
                    </span>
                  </span>
                </span>
                {bill.url ? (
                  <a href={bill.url} target="_blank" rel="noreferrer" className="row-meta" onClick={(e) => e.stopPropagation()}>
                    Open <ExternalLink size={12} />
                  </a>
                ) : null}
              </label>
            );
          })}
        </div>
      ) : (
        <p className="row-meta" style={{ margin: 0 }}>
          No electricity bills on this job yet - upload one.
        </p>
      )}

      <div className="ai-bill-upload">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => inputRef.current?.click()} disabled={disabled || uploading}>
          <Upload size={14} /> {uploading ? "Uploading…" : "Upload a bill"}
        </button>
        <span className="row-meta">PDF or a photo (JPG, PNG, WEBP, HEIC), up to 10 MB. It is filed with the job&apos;s bills.</span>
        <input
          ref={inputRef}
          type="file"
          accept={BILL_ACCEPT}
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) onUpload(file);
          }}
        />
      </div>
    </div>
  );
}

// ---- Checking the reading -------------------------------------------------------------

function FigureField({ label, unit, field, reading, onChange, disabled, step = "any" }) {
  return (
    <Field label={label} hint={unit}>
      <NumberInput
        value={reading[field] ?? ""}
        step={step}
        min={0}
        disabled={disabled}
        placeholder="Not on the bill"
        onChange={(value) => onChange({ ...reading, [field]: value === "" ? null : value })}
      />
    </Field>
  );
}

export function BillReadingForm({ document, reading, onChange, disabled }) {
  const timeOfUse =
    reading.tariffType === "time_of_use" ||
    [reading.peakRateCents, reading.shoulderRateCents, reading.offPeakRateCents].some((value) => !blank(value));
  const field = (label, unit, key, extra = {}) => (
    <FigureField key={key} label={label} unit={unit} field={key} reading={reading} onChange={onChange} disabled={disabled} {...extra} />
  );
  const gst = reading.ratesIncludeGst === true ? "yes" : reading.ratesIncludeGst === false ? "no" : "unknown";

  return (
    <div className="ai-bill-reading">
      <div className="ai-quote-summary">
        <div className="row-title ai-bill-head">
          <FileText size={15} /> {document.filename}
          <Badge tone={CONFIDENCE_TONES[reading.confidence] || "neutral"}>
            {reading.confidence === "high" ? "Read clearly" : reading.confidence === "low" ? "Unsure reading" : "Read"}
          </Badge>
        </div>
        <p>
          {[
            reading.retailer,
            reading.periodStart && reading.periodEnd ? `${formatDate(reading.periodStart)} – ${formatDate(reading.periodEnd)}` : null,
            reading.billingDays ? `${reading.billingDays} days` : null,
            TARIFF_LABELS[reading.tariffType] ? `${TARIFF_LABELS[reading.tariffType]} tariff` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "The AI could not find the retailer or the billing period."}
        </p>
      </div>

      {reading.confidence === "low" ? (
        <Alert tone="warning" style={{ marginTop: 12 }}>
          The AI was unsure of some figures - check each one against the bill before building the quote.
        </Alert>
      ) : null}

      <div className="ai-bill-section-title">Usage</div>
      <div className="ai-bill-grid">
        {field("Usage this bill", "kWh", "usageKwh")}
        {field("Days billed", "days", "billingDays", { step: 1 })}
        {field("Daily average", "kWh a day", "averageDailyKwh")}
        {field("12-month usage", "kWh, if printed", "annualUsageKwh")}
        {timeOfUse ? (
          <>
            {field("Peak usage", "kWh", "peakKwh")}
            {field("Shoulder usage", "kWh", "shoulderKwh")}
            {field("Off-peak usage", "kWh", "offPeakKwh")}
          </>
        ) : null}
        {field("Controlled load", "kWh", "controlledLoadKwh")}
        {field("Solar exported", "kWh", "solarExportKwh")}
      </div>

      <div className="ai-bill-section-title">Rates and charges</div>
      <div className="ai-bill-grid">
        <Field label="Tariff">
          <select
            value={reading.tariffType}
            disabled={disabled}
            onChange={(e) => onChange({ ...reading, tariffType: e.target.value })}
          >
            {Object.entries(TARIFF_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </Field>
        {timeOfUse ? (
          <>
            {field("Peak rate", "c/kWh", "peakRateCents")}
            {field("Shoulder rate", "c/kWh", "shoulderRateCents")}
            {field("Off-peak rate", "c/kWh", "offPeakRateCents")}
          </>
        ) : (
          field("Usage rate", "c/kWh", "flatRateCents")
        )}
        {field("Supply charge", "c a day", "supplyChargeCentsPerDay")}
        {field("Feed-in tariff", "c/kWh", "feedInCents")}
        {field("Bill total", "$ incl. GST", "totalAmount")}
        <Field label="Rates include GST">
          <select
            value={gst}
            disabled={disabled}
            onChange={(e) =>
              onChange({ ...reading, ratesIncludeGst: e.target.value === "yes" ? true : e.target.value === "no" ? false : null })
            }
          >
            <option value="yes">Yes</option>
            <option value="no">No - GST is added</option>
            <option value="unknown">Not sure</option>
          </select>
        </Field>
      </div>

      {reading.usageHistory?.length ? (
        <div style={{ marginTop: 14 }}>
          <div className="row-meta">Usage history on the bill (average a day)</div>
          <div className="ai-bill-history">
            {reading.usageHistory.map((entry) => (
              <span key={entry.label} className="ai-bill-chip">
                {entry.label} <strong>{amount(entry.averageDailyKwh, 1)} kWh</strong>
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {reading.notes?.length ? (
        <div className="ai-quote-notes" style={{ marginTop: 14 }}>
          <div>
            <div className="row-title">Noted on the bill</div>
            <ul>
              {reading.notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </div>
        </div>
      ) : null}

      {!readingHasUsage(reading) ? (
        <Alert tone="danger" style={{ marginTop: 14 }}>
          No usage to size the system from - enter the kWh used and the days billed, or the daily average.
        </Alert>
      ) : null}
    </div>
  );
}

// ---- Beside the proposal -----------------------------------------------------------

function Row({ label, value, meta }) {
  return (
    <div className="list-row">
      <span className="row-lines">
        <span className="row-title">{label}</span>
        {meta ? <span className="row-meta">{meta}</span> : null}
      </span>
      <span className="ai-bill-figure">{value}</span>
    </div>
  );
}

/** energy: the suggestion's `energy`; proposalTotal: what every proposed line comes to, incl. GST. */
export function EnergySummary({ energy, proposalTotal }) {
  const proposed = energy.proposed;
  const savings = proposed?.annualSavings;
  const payback = savings > 0 && proposalTotal > 0 ? proposalTotal / savings : null;
  const system = proposed
    ? [proposed.systemKw > 0 ? `${amount(proposed.systemKw, 2)} kW solar` : null, proposed.batteryKwh > 0 ? `${amount(proposed.batteryKwh, 1)} kWh battery` : null]
        .filter(Boolean)
        .join(" + ")
    : "";

  return (
    <div className="ai-bill-energy">
      <div className="list-stack">
        <div className="ai-bill-section-title" style={{ marginTop: 0 }}>
          From the bill
        </div>
        <Row label="Yearly use" value={`${amount(energy.annualKwh)} kWh`} meta={`From ${energy.annualBasis}`} />
        {energy.currentAnnualCost ? <Row label="Paid now" value={`~${formatCurrency(energy.currentAnnualCost)} a year`} meta="This bill's total, over a year" /> : null}
        <Row
          label="Solar to cover the use"
          value={`${amount(energy.solarKwToCoverUsage, 1)} kW`}
          meta={`At ${energy.yieldKwhPerKwDay} kWh a day per kW${energy.state ? ` in ${energy.state}` : ""}`}
        />
        <Row label="Battery for evening use" value={`${amount(energy.batteryKwhForEveningUse, 1)} kWh`} />
      </div>

      <div className="list-stack">
        <div className="ai-bill-section-title" style={{ marginTop: 0 }}>
          The quoted system
        </div>
        {proposed ? (
          <>
            <Row label="System" value={system} />
            {proposed.annualGenerationKwh ? (
              <Row label="Generation" value={`~${amount(proposed.annualGenerationKwh)} kWh a year`} meta={`Covers about ${proposed.usageCoveredPct}% of the use`} />
            ) : (
              <Row label="Use covered" value={`about ${proposed.usageCoveredPct}%`} />
            )}
            <Row
              label="Estimated savings"
              value={savings === null ? "-" : `~${formatCurrency(savings)} a year`}
              meta={savings === null ? "Add the bill's usage rate to see them" : null}
            />
            {payback ? <Row label="Payback" value={`~${amount(payback, 1)} years`} meta={`On the proposal's ${formatCurrency(proposalTotal)}`} /> : null}
          </>
        ) : (
          <p className="row-meta" style={{ margin: 0 }}>
            The proposal has no panels or battery whose size could be read, so no savings are worked out.
          </p>
        )}
      </div>

      <details className="ai-bill-assumptions">
        <summary>How these figures are worked out - indicative, not a guarantee</summary>
        <ul>
          {energy.assumptions.map((line) => (
            <li key={line}>{line}</li>
          ))}
        </ul>
      </details>
    </div>
  );
}
