// Recording a plain approval — strata, heritage, landlord consent, rebate
// pre-approval, anything without a checklist of its own. One column, so it
// reads in any card width. The status comes first and decides which fields
// show and which are needed before it saves (UAT Status Logic, Oct 2026):
//
//   Not Started                   — approving party
//   Lodged                        — + reference number, lodgement date (party and date required)
//   Further Information Requested — + notes (required)
//   Approved                      — + decision date, approval evidence (both required)
//   Approved with Conditions      — + conditions (conditions and evidence required)
//   Rejected                      — approving party, decision date, notes (date and reason required)
//   Not Applicable                — notes (the reason, required)
//
// The record keeps the five statuses the API knows; the finer ones (further
// information, with conditions) are kept as the outcome on the approval's
// answers (item.checklist), with the conditions and the evidence, which goes
// on the job's attachments. Approved, Approved with Conditions and Not
// Applicable complete it; Rejected sends the job back and blocks procurement.
//
// Some approvals carry extra fields (kept on the answers too): strata — the
// plan number and the manager's contact; landlord consent — the landlord's
// name and contact; rebate pre-approval — the rebates, their amounts, the
// certificate provider and the quote date, pre-filled from the accepted quote
// and flagged where they differ from it, so the customer's price matches.

import { useState } from "react";
import Alert from "@/components/Alert";
import Field from "@/components/Field";
import { FilePicker } from "@/components/ChecklistForm";
import { today } from "@/helpers/checklist";
import { NO_REBATE, OTHER_REBATE, QUOTE_REBATE_OPTION, rebateOptionsFor } from "@/constants/rebates";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { formatCurrency } from "@/utils/formatCurrency";

const day = (iso) => (iso ? String(iso).slice(0, 10) : "");
/** Who usually gives each kind of approval: the first pre-fills the box, the rest are suggestions. */
const APPROVING_PARTIES = {
  strata: ["Owners Corporation", "Strata Manager"],
  heritage: ["Council", "Heritage NSW"],
  landlord: ["Property Owner", "Landlord"],
  rebate: ["Certificate Provider"],
};

/** The extra text fields each approval type asks for, kept on its answers. */
const EXTRA_FIELDS = {
  strata: [
    { key: "strataPlan", label: "Strata Plan Number", placeholder: "e.g. SP12345" },
    { key: "strataManagerContact", label: "Strata Manager Contact", placeholder: "Name, phone or email" },
  ],
  landlord: [
    { key: "landlordName", label: "Landlord Name" },
    { key: "landlordContact", label: "Landlord Contact", placeholder: "Phone or email" },
  ],
  rebate: [{ key: "certificateProvider", label: "Certificate Provider", placeholder: "e.g. the installer's ACP" }],
};

/** A rebate saved before the rebate options existed (a quote builder type) as the option it is. */
const asOption = (type) => QUOTE_REBATE_OPTION[type] ?? (/^[a-z0-9_]+$/.test(type) ? type : OTHER_REBATE);

/** The statuses offered, in order: the record's status, the fields each shows and the ones it cannot be saved without. */
const STATUSES = [
  { value: "not_started", label: "Not Started", record: "not_started", shown: ["party"], required: [] },
  { value: "submitted", label: "Lodged", record: "submitted", shown: ["party", "reference", "submittedAt"], required: ["party", "submittedAt"] },
  {
    value: "info_requested",
    label: "Further Information Requested",
    record: "submitted",
    shown: ["party", "reference", "submittedAt", "note"],
    required: ["note"],
  },
  {
    value: "approved",
    label: "Approved",
    record: "approved",
    shown: ["party", "reference", "submittedAt", "note", "decidedAt", "expiresOn", "evidence"],
    required: ["decidedAt", "evidence"],
  },
  {
    value: "approved_conditions",
    label: "Approved with Conditions",
    record: "approved",
    shown: ["party", "reference", "submittedAt", "note", "decidedAt", "expiresOn", "evidence", "conditions"],
    required: ["decidedAt", "conditions", "evidence"],
  },
  { value: "rejected", label: "Rejected", record: "rejected", shown: ["party", "decidedAt", "note"], required: ["decidedAt", "note"] },
  { value: "not_applicable", label: "Not Applicable", record: "not_applicable", shown: ["note"], required: ["note"] },
  // Failed after it was given: blocks the exit like a rejection (and flags a review once the job has moved on).
  { value: "revoked", label: "Revoked", record: "rejected", shown: ["party", "decidedAt", "note"], required: ["decidedAt", "note"] },
  { value: "expired", label: "Expired", record: "rejected", shown: ["party", "decidedAt", "note"], required: ["decidedAt"] },
];

const FIELD_NAMES = {
  party: "the approving party",
  submittedAt: "the lodgement date",
  decidedAt: "the decision date",
  evidence: "the approval evidence",
  conditions: "the conditions",
  note: "notes",
};

/** The status as the form offers it - approved with conditions read back from the answers. */
/** The status as the form offers it: the outcome on the answers while it still matches the record's status. */
const recordedStatus = (item) => {
  const outcome = STATUSES.find((status) => status.value === item.checklist?.outcome);
  return outcome && outcome.record === item.status ? outcome.value : (STATUSES.find((status) => status.value === item.status)?.value ?? "not_started");
};

// `lapseOnly` - the job has been sent on: only Revoked or Expired can be recorded.
export default function ApprovalItemForm({ item, job = null, onSave, onCancel, upload = null, lapseOnly = false }) {
  const parties = APPROVING_PARTIES[item.key] ?? [];
  const extras = EXTRA_FIELDS[item.key] ?? [];
  const isRebate = item.key === "rebate";
  const { unit } = useBusinessUnit();
  // The rebates on the accepted quote, by option - what the pre-approval is checked against.
  const quoteRebates = job?.quoteRebates ?? [];
  const quoted = new Map();
  for (const rebate of quoteRebates) quoted.set(asOption(rebate.type), (quoted.get(asOption(rebate.type)) ?? 0) + Number(rebate.amount || 0));
  const quotedOther = quoteRebates.find((rebate) => asOption(rebate.type) === OTHER_REBATE)?.type ?? "";
  const savedTypes = Array.isArray(item.checklist?.rebateTypes) ? item.checklist.rebateTypes.map(asOption) : null;
  const [form, setForm] = useState({
    status: recordedStatus(item),
    party: item.authority || parties[0] || "",
    conditions: item.checklist?.conditions ?? "",
    reference: item.reference ?? "",
    submittedAt: day(item.submittedAt),
    decidedAt: day(item.decidedAt),
    note: item.note ?? "",
    evidence: Array.isArray(item.checklist?.evidence) ? item.checklist.evidence : [],
    expiresOn: item.checklist?.expiresOn ?? "",
    ...Object.fromEntries(extras.map((field) => [field.key, item.checklist?.[field.key] ?? ""])),
    // Rebates start from the accepted quote until they are saved.
    rebateTypes: savedTypes ?? (isRebate ? [...quoted.keys()] : []),
    rebateAmounts:
      item.checklist?.rebateAmounts && savedTypes
        ? Object.fromEntries(Object.entries(item.checklist.rebateAmounts).map(([type, amount]) => [asOption(type), amount]))
        : isRebate
          ? Object.fromEntries([...quoted].map(([type, amount]) => [type, String(amount)]))
          : {},
    rebateName: item.checklist?.rebateName ?? quotedOther,
    rebateNotes: item.checklist?.rebateNotes ?? "",
    vppProvider: item.checklist?.vppProvider ?? "",
    quoteDate: item.checklist?.quoteDate ?? (isRebate ? day(job?.quoteDate) : ""),
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const set = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const id = `ap-${item.key}`;
  const rules = STATUSES.find((status) => status.value === form.status) ?? STATUSES[0];
  const shows = (key) => rules.shown.includes(key);
  const needs = (key) => rules.required.includes(key);
  const authority = form.party.trim();

  const save = async (event) => {
    event.preventDefault();
    const values = {
      party: authority,
      submittedAt: form.submittedAt,
      decidedAt: form.decidedAt,
      note: form.note.trim(),
      conditions: form.conditions.trim(),
      evidence: form.evidence.length ? "yes" : "",
    };
    const missing = rules.required.filter((key) => !values[key]);
    // What the chosen rebates need: the VPP provider, and a name and notes for Other.
    if (isRebate && form.rebateTypes.includes("pdrs_vpp") && !form.vppProvider.trim()) {
      setError("Record the VPP provider for the PDRS VPP incentive.");
      return;
    }
    if (isRebate && form.rebateTypes.includes(OTHER_REBATE) && (!form.rebateName.trim() || !form.rebateNotes.trim())) {
      setError("Record the rebate name and notes for the Other rebate.");
      return;
    }
    if (missing.length) {
      setError(`Record ${missing.map((key) => FIELD_NAMES[key]).join(", ")} to mark this as ${rules.label}.`);
      return;
    }
    // Approval dates: never in the future, and no decision before the submission.
    if ((shows("submittedAt") && form.submittedAt > today()) || (shows("decidedAt") && form.decidedAt > today())) {
      setError("Approval dates cannot be in the future.");
      return;
    }
    if (shows("decidedAt") && form.submittedAt && form.decidedAt && form.decidedAt < form.submittedAt) {
      setError("The decision date cannot be earlier than the lodgement date.");
      return;
    }
    if (shows("expiresOn") && form.expiresOn && form.decidedAt && form.expiresOn < form.decidedAt) {
      setError("Valid Until cannot be earlier than the decision date.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const withConditions = form.status === "approved_conditions";
      await onSave({
        status: rules.record,
        authority: shows("party") ? authority : item.authority ?? "",
        reference: form.reference.trim(),
        // Kept when a status hides it (a lodged approval later rejected); cleared only back at Not Started.
        submittedAt: (form.status !== "not_started" && form.submittedAt) || null,
        decidedAt: (shows("decidedAt") && form.decidedAt) || null,
        note: form.note.trim(),
        checklist: {
          evidence: form.evidence,
          outcome: form.status,
          conditions: withConditions ? form.conditions.trim() : "",
          expiresOn: shows("expiresOn") ? form.expiresOn : "",
          ...Object.fromEntries(extras.map((field) => [field.key, String(form[field.key] ?? "").trim()])),
          ...(isRebate
            ? {
                rebateTypes: form.rebateTypes,
                rebateAmounts: Object.fromEntries(form.rebateTypes.filter((type) => type !== NO_REBATE).map((type) => [type, form.rebateAmounts[type] ?? ""])),
                rebateName: form.rebateTypes.includes(OTHER_REBATE) ? form.rebateName.trim() : "",
                rebateNotes: form.rebateTypes.includes(OTHER_REBATE) ? form.rebateNotes.trim() : "",
                vppProvider: form.rebateTypes.includes("pdrs_vpp") ? form.vppProvider.trim() : "",
                quoteDate: form.quoteDate,
              }
            : {}),
        },
      });
    } catch (err) {
      setError(typeof err === "string" ? err : err?.message || "The approval could not be saved.");
      setBusy(false);
    }
  };

  return (
    <form className="approval-item-form" onSubmit={save} noValidate>
      <div className="approval-item-fields">
        <Field label="Status" required htmlFor={`${id}-status`}>
          <select id={`${id}-status`} value={form.status} onChange={(e) => set("status", e.target.value)}>
            {STATUSES.filter((status) => !lapseOnly || status.value === recordedStatus(item) || ["revoked", "expired"].includes(status.value)).map((status) => (
              <option key={status.value} value={status.value}>
                {status.label}
              </option>
            ))}
          </select>
        </Field>
        {shows("party") ? (
          <Field label="Approving Party" required={needs("party")} htmlFor={`${id}-party`}>
            <input
              id={`${id}-party`}
              value={form.party}
              maxLength={255}
              list={parties.length ? `${id}-parties` : undefined}
              placeholder="Who gives this approval"
              onChange={(e) => set("party", e.target.value)}
            />
            {parties.length ? (
              <datalist id={`${id}-parties`}>
                {parties.map((party) => (
                  <option key={party} value={party} />
                ))}
              </datalist>
            ) : null}
          </Field>
        ) : null}
        {/* The approval type's own fields - every status but Not Applicable. */}
        {form.status !== "not_applicable"
          ? extras.map((field) => (
              <Field key={field.key} label={field.label} hint="optional" htmlFor={`${id}-${field.key}`}>
                <input id={`${id}-${field.key}`} value={form[field.key]} maxLength={255} placeholder={field.placeholder} onChange={(e) => set(field.key, e.target.value)} />
              </Field>
            ))
          : null}
        {isRebate ? (
          <RebateFields
            id={id}
            options={rebateOptionsFor(job, unit, form.rebateTypes)}
            form={form}
            quoted={quoted}
            set={set}
            onNoRebate={() =>
              // No Rebate stands alone and makes the card Not Applicable.
              setForm((current) => ({ ...current, rebateTypes: [NO_REBATE], status: "not_applicable", note: current.note || "No rebate applies to this job." }))
            }
          />
        ) : null}
        {shows("reference") ? (
          <Field label="Reference Number" hint="optional" htmlFor={`${id}-reference`}>
            <input id={`${id}-reference`} value={form.reference} maxLength={120} onChange={(e) => set("reference", e.target.value)} />
          </Field>
        ) : null}
        {shows("submittedAt") ? (
          <Field label="Lodgement Date" required={needs("submittedAt")} htmlFor={`${id}-submitted`}>
            <input id={`${id}-submitted`} type="date" value={form.submittedAt} max={today()} onChange={(e) => set("submittedAt", e.target.value)} />
          </Field>
        ) : null}
        {shows("decidedAt") ? (
          <Field
            label={form.status === "revoked" ? "Revoked Date" : form.status === "expired" ? "Expiry Date" : "Decision Date"}
            required={needs("decidedAt")}
            htmlFor={`${id}-decided`}
          >
            <input
              id={`${id}-decided`}
              type="date"
              value={form.decidedAt}
              min={(shows("submittedAt") && form.submittedAt) || undefined}
              max={today()}
              onChange={(e) => set("decidedAt", e.target.value)}
            />
          </Field>
        ) : null}
        {shows("expiresOn") ? (
          <Field label="Valid Until" hint="optional - if the approval has an expiry date" htmlFor={`${id}-expires`}>
            <input id={`${id}-expires`} type="date" value={form.expiresOn} min={form.decidedAt || undefined} onChange={(e) => set("expiresOn", e.target.value)} />
          </Field>
        ) : null}
        {shows("evidence") ? (
          <Field label="Approval Evidence" required={needs("evidence")} htmlFor={`${id}-evidence`}>
            <FilePicker id={`${id}-evidence`} files={form.evidence} upload={upload} onChange={(files) => set("evidence", files)} />
          </Field>
        ) : null}
        {shows("conditions") ? (
          <Field label="Conditions" required={needs("conditions")} htmlFor={`${id}-conditions`}>
            <textarea id={`${id}-conditions`} rows={2} maxLength={2000} value={form.conditions} placeholder="The conditions on the approval" onChange={(e) => set("conditions", e.target.value)} />
          </Field>
        ) : null}
        {shows("note") ? (
          <Field
            label={form.status === "rejected" ? "Rejection Reason" : ["revoked", "expired"].includes(form.status) ? "Reason" : "Notes"}
            hint={needs("note") ? undefined : "optional"}
            required={needs("note")}
            htmlFor={`${id}-note`}
          >
            <textarea
              id={`${id}-note`}
              rows={2}
              maxLength={2000}
              value={form.note}
              placeholder={
                form.status === "rejected"
                  ? "Why it was not given"
                  : form.status === "not_applicable"
                    ? "Why this approval is not needed"
                    : form.status === "info_requested"
                      ? "What has been asked for"
                      : undefined
              }
              onChange={(e) => set("note", e.target.value)}
            />
          </Field>
        ) : null}
      </div>
      {error ? (
        <Alert tone="danger" style={{ marginTop: 10 }}>
          {error}
        </Alert>
      ) : null}
      <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
        <button type="submit" className="btn btn-primary btn-sm" disabled={busy}>
          {busy ? "Saving…" : "Save"}
        </button>
        {onCancel ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onCancel} disabled={busy}>
            Cancel
          </button>
        ) : null}
      </div>
    </form>
  );
}

/**
 * The rebates on a pre-approval: the options that apply to the job (several
 * at once), an amount for each, checked against the accepted quote, the VPP
 * provider and the Other rebate's name and notes when chosen, and the quote
 * date.
 */
function RebateFields({ id, options, form, quoted, set, onNoRebate }) {
  const chosen = form.rebateTypes;
  const toggle = (key, on) => {
    if (key === NO_REBATE) return on ? onNoRebate() : set("rebateTypes", []);
    set("rebateTypes", on ? [...chosen.filter((entry) => entry !== NO_REBATE), key] : chosen.filter((entry) => entry !== key));
  };
  const labelOf = (key) => options.find((option) => option.key === key)?.label ?? key;
  return (
    <>
      <Field label="Rebate Type" hint="more than one can apply" htmlFor={`${id}-rebates`}>
        <div className="choice-grid" id={`${id}-rebates`}>
          {options.map((option) => (
            <label key={option.key} className="choice" title={option.note}>
              <input type="checkbox" checked={chosen.includes(option.key)} onChange={(e) => toggle(option.key, e.target.checked)} />
              <span>
                {option.label}
                {option.note ? <small>{option.note}</small> : null}
              </span>
            </label>
          ))}
        </div>
      </Field>
      {chosen
        .filter((key) => key !== NO_REBATE)
        .map((key) => {
          const amount = form.rebateAmounts[key] ?? "";
          const onQuote = quoted.has(key);
          const differs = onQuote && amount !== "" && Math.abs(Number(amount) - quoted.get(key)) > 0.005;
          return (
            <Field
              key={key}
              label={`${key === OTHER_REBATE && form.rebateName ? form.rebateName : labelOf(key)} - Rebate Amount ($)`}
              htmlFor={`${id}-amount-${key}`}
              error={
                !onQuote
                  ? "Not on the accepted quote - add it there so the customer's price reflects the rebate."
                  : differs
                    ? `Differs from the quote (${formatCurrency(quoted.get(key), { withCents: true })}) - update the quote so the customer's price reflects it.`
                    : undefined
              }
            >
              <input
                id={`${id}-amount-${key}`}
                type="number"
                min={0}
                step="0.01"
                value={amount}
                onChange={(e) => set("rebateAmounts", { ...form.rebateAmounts, [key]: e.target.value })}
              />
            </Field>
          );
        })}
      {chosen.includes("pdrs_vpp") ? (
        <Field label="VPP Provider" required htmlFor={`${id}-vpp`}>
          <input id={`${id}-vpp`} value={form.vppProvider} maxLength={255} placeholder="The virtual power plant provider" onChange={(e) => set("vppProvider", e.target.value)} />
        </Field>
      ) : null}
      {chosen.includes(OTHER_REBATE) ? (
        <>
          <Field label="Rebate Name" required htmlFor={`${id}-rebate-name`}>
            <input id={`${id}-rebate-name`} value={form.rebateName} maxLength={120} onChange={(e) => set("rebateName", e.target.value)} />
          </Field>
          <Field label="Rebate Notes" required htmlFor={`${id}-rebate-notes`}>
            <textarea id={`${id}-rebate-notes`} rows={2} maxLength={2000} value={form.rebateNotes} onChange={(e) => set("rebateNotes", e.target.value)} />
          </Field>
        </>
      ) : null}
      {!chosen.includes(NO_REBATE) ? (
        <Field label="Quote Date" hint="from the accepted quote" htmlFor={`${id}-quote-date`}>
          <input id={`${id}-quote-date`} type="date" value={form.quoteDate} max={today()} onChange={(e) => set("quoteDate", e.target.value)} />
        </Field>
      ) : null}
    </>
  );
}
