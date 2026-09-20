// Lead pack form: the customer and site, then the mandatory checklist — which
// folds in the optional client-visit capture and the potential-client
// decision, in that order.
//
// Type of lead comes first: it decides whether the customer is a business
// (business name + ABN) or a person, so nothing below it can be filled in
// wrongly. The checklist below is what Estimation needs confirmed with the
// customer before the lead can be marked Potential.

import { useState } from "react";
import { Building2, Check, ClipboardCheck, ExternalLink, HandHelping, Pencil, PhoneCall, Plus, Send, X } from "lucide-react";
import { formatDate } from "@/helpers/dateTimeHelpers";
import Alert from "@/components/Alert";
import Field from "@/components/Field";
import SectionHead from "@/components/SectionHead";
import Tabs from "@/components/Tabs";
import NumberInput from "@/components/NumberInput";
import FileDropzone from "@/components/FileDropzone";
import { AU_STATES } from "@/constants/stages";
import {
  commissionTiersFor,
  isBusinessLead,
  LEAD_TYPES,
  leadSourceLabel,
  MANUAL_LEAD_SOURCES,
} from "@/features/leads/leadSourceOptions";
import {
  ELECTRICAL_PHASES,
  FINANCE_OPTIONS,
  INSTALL_TIMEFRAMES,
  ROOF_TYPES,
  SERVICE_REQUIREMENTS,
  STOREY_OPTIONS,
  electricalPhaseLabel,
} from "@/features/leads/propertyOptions";
import { COMMON_LANGUAGES, DEFAULT_LANGUAGE } from "@/constants/languages";
import {
  BACKUP_OPTIONS,
  PERMIT_OPTIONS,
  SITE_TYPES,
  SWITCHBOARD_CONDITIONS,
  VPP_OPTIONS,
  inspectionStatusFrom,
  inspectionStatusLabel,
  systemSizeKw,
} from "@/constants/estimationInput";
import { TECHNICAL_GROUP } from "@/helpers/leadChecklist";
import { isAutomatedSource } from "@/features/leads/leadFormModel";
import { isBlank } from "@/utils/validators";
import ChecklistRow from "./ChecklistRow";

/** Heading above a run of estimation-input rows — the same titles estimation shows. */
function GroupHead({ title }) {
  return (
    <div className="input-group-head">
      <h4>{title}</h4>
    </div>
  );
}

const BILLING_OPTIONS = [
  { key: "yes", label: "Yes — bill to the site address" },
  { key: "no", label: "No — different billing address" },
];

/**
 * The client-contact question. It starts unanswered on purpose: the row only
 * ticks once someone says what happened, and a "yes" needs a logged attempt
 * behind it.
 */
const CONTACT_OPTIONS = [
  { key: "yes", label: "Yes — log every attempt below" },
  { key: "no", label: "No — we already had everything" },
];

/**
 * Radio group for a short set of answers (storeys, roof, phase, …), always
 * ending in "Other". An "Other" answer is stored as the text the user types,
 * so it reads naturally everywhere the value is shown; until something is
 * typed the question counts as unanswered.
 */
function ChoiceGroup({ name, options, value, otherLabel = "answer", disabled, error, onChange }) {
  const known = options.some((o) => o.key === value);
  const [otherPicked, setOtherPicked] = useState(false);
  const isOther = otherPicked || (!isBlank(value) && !known);

  return (
    <Field error={error}>
      <div className="choice-grid">
        {options.map((o) => (
          <label key={o.key} className="choice">
            <input
              type="radio"
              name={name}
              checked={!isOther && value === o.key}
              disabled={disabled}
              onChange={() => {
                setOtherPicked(false);
                onChange(o.key);
              }}
            />
            <span>
              {o.label}
              {o.hint ? <small>{o.hint}</small> : null}
            </span>
          </label>
        ))}
        <label className="choice">
          <input
            type="radio"
            name={name}
            checked={isOther}
            disabled={disabled}
            onChange={() => {
              setOtherPicked(true);
              if (known) onChange("");
            }}
          />
          <span>Other</span>
        </label>
      </div>
      {isOther ? (
        <input
          style={{ marginTop: 8 }}
          value={known ? "" : value}
          disabled={disabled}
          autoFocus={otherPicked && isBlank(value)}
          placeholder={`Type ${otherLabel}`}
          onChange={(e) => onChange(e.target.value)}
        />
      ) : null}
    </Field>
  );
}

export default function LeadForm({
  form,
  set,
  errors = {},
  estimators = [],
  sales = [],
  referrers = [],
  unit,
  disabled = false,
  showChecklist = true,
  billFiles = [],
  onUploadBills,
  uploadingBills = false,
  // Optional estimation-input rows: uploads and the pre-site inspection the
  // operations coordinator runs.
  drawings = [],
  sitePhotos = [],
  onUploadDrawings,
  onUploadSitePhotos,
  uploadingCategory = null,
  inspection = null,
  onRequestInspection,
  // Rendered under its own tab when the panel passes one in.
  requestsPanel = null,
  // Unlocks a saved lead for editing. Passed only when the person may edit;
  // without it a locked form just says why it is locked.
  onUnlock,
}) {
  const err = (field) => errors[field];
  const hasSalesperson = !isBlank(form.salespersonId) && showChecklist;
  const [tab, setTab] = useState("customer");
  // The checklist and the decision need an owner before they mean anything;
  // requests do not, so they stay reachable on an unassigned lead.
  const needsSalesperson = ["checklist", "decision"].includes(tab);
  const activeTab = hasSalesperson || !needsSalesperson ? tab : "customer";
  const automated = isAutomatedSource(form.leadSource);
  const tiers = commissionTiersFor(unit);
  const business = isBusinessLead(form.leadType);
  // Records captured under an older, longer list (industrial, other) keep
  // their type rather than silently reverting to "Select type".
  const leadTypeOptions = LEAD_TYPES.some((t) => t.key === form.leadType) || isBlank(form.leadType)
    ? LEAD_TYPES
    : [...LEAD_TYPES, { key: form.leadType, label: form.leadType }];

  const input = (field, props = {}) => (
    <input
      value={form[field]}
      disabled={disabled}
      onChange={(e) => set(field, e.target.value)}
      autoComplete="off"
      {...props}
    />
  );

  const textarea = (field, props = {}) => (
    <textarea rows={2} value={form[field]} disabled={disabled} onChange={(e) => set(field, e.target.value)} {...props} />
  );

  const selectField = (field, options, placeholder) => (
    <select value={form[field]} disabled={disabled} onChange={(e) => set(field, e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </select>
  );
  const yesNo = (field, placeholder = "Select") => (
    <select value={form[field]} disabled={disabled} onChange={(e) => set(field, e.target.value)}>
      <option value="">{placeholder}</option>
      <option value="yes">Yes</option>
      <option value="no">No</option>
    </select>
  );
  const checkbox = (field, label) => (
    <label className="check">
      <input type="checkbox" checked={Boolean(form[field])} disabled={disabled} onChange={(e) => set(field, e.target.checked)} />
      {label}
    </label>
  );
  const togglePermit = (key) =>
    set("permits", (form.permits || []).includes(key) ? form.permits.filter((k) => k !== key) : [...(form.permits || []), key]);

  const inspectionNeeded = form.preSiteInspectionRequired === "yes";
  const inspectionStatus = inspectionStatusFrom(inspection);
  const retrofit = form.isRetrofit === "yes";
  const sizeKw = systemSizeKw(form);

  const customFields = form.customFields || [];
  const setCustomField = (i, key, value) =>
    set(
      "customFields",
      customFields.map((f, idx) => (idx === i ? { ...f, [key]: value } : f)),
    );
  const addCustomField = () => set("customFields", [...customFields, { label: "", value: "" }]);
  const removeCustomField = (i) => set("customFields", customFields.filter((_, idx) => idx !== i));

  // "Other" stays open while the language is being typed, so the picker
  // doesn't snap back to English on the first keystroke.
  const languageListed = COMMON_LANGUAGES.includes(form.preferredLanguage);
  const [languageOther, setLanguageOther] = useState(false);
  const languageIsOther = languageOther || (!isBlank(form.preferredLanguage) && !languageListed);

  const contactAttempts = form.contactAttempts || [];
  const emptyAttemptDraft = { method: "", contactedAt: "", reached: true, reason: "", notes: "" };
  const [attemptDraft, setAttemptDraft] = useState(emptyAttemptDraft);
  const attemptDraftMissing = [
    isBlank(attemptDraft.method) ? "how you tried" : null,
    attemptDraft.contactedAt ? null : "the date",
    !attemptDraft.reached && isBlank(attemptDraft.reason) ? "a reason they weren't reached" : null,
  ].filter(Boolean);
  const attemptDraftValid = attemptDraftMissing.length === 0;
  const addContactAttempt = () => {
    if (!attemptDraftValid) return;
    set("contactAttempts", [...contactAttempts, attemptDraft]);
    setAttemptDraft(emptyAttemptDraft);
  };
  // This form can sit inside a <form> (the new-lead page), where Enter in a
  // text box would submit the lead instead of logging the attempt.
  const attemptKeyDown = (e) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    addContactAttempt();
  };
  const removeContactAttempt = (i) => set("contactAttempts", contactAttempts.filter((_, idx) => idx !== i));

  // One boolean per mandatory row — the single source of truth for both the
  // row ticks and the "Potential" gate/progress bar below.
  // Answered "no", or answered "yes" and backed up with a logged attempt.
  // An unanswered question is never complete.
  const doneContact =
    form.needsClientContact === "no" || (form.needsClientContact === "yes" && contactAttempts.length > 0);
  const doneName = !isBlank(form.customerFirstName) && !isBlank(form.customerLastName);
  const doneAddress = !isBlank(form.siteLine1) && !isBlank(form.siteSuburb) && !isBlank(form.sitePostcode);
  const siteAddressLine = [form.siteLine1, form.siteSuburb, `${form.siteState || ""} ${form.sitePostcode || ""}`.trim()]
    .filter((part) => !isBlank(part))
    .join(", ");
  const doneService = !isBlank(form.serviceRequirement);
  const doneBilling =
    form.billingSameAsSite === "no"
      ? !isBlank(form.customerBillingAddress)
      : !isBlank(form.billingSameAsSite);
  const doneEmail = !isBlank(form.customerEmail);
  const donePhone = !isBlank(form.customerPhone);
  const doneMeasurements = !isBlank(form.roofMeasurements);
  const doneStoreys = !isBlank(form.propertyStoreys);
  const doneRoof = !isBlank(form.roofType);
  const donePhase = !isBlank(form.electricalPhase);
  const doneBills = form.energyHasBills || billFiles.length > 0;
  const doneUsage = !isBlank(form.energyAnnualKwh);
  const doneFinance = !isBlank(form.financeAssistance) && (form.financeAssistance !== "yes" || !isBlank(form.financeNotes));
  const doneSiteRequirements = form.siteRequirementsNone || !isBlank(form.siteSpecificRequirements);
  const doneTimeframe = !isBlank(form.preferredInstallTimeframe);
  const doneLocation = !isBlank(form.preferredInstallLocation);
  const doneComments = !isBlank(form.customerComments);
  const doneIntent = Boolean(form.customerIntentConfirmed);
  const doneSource = !isBlank(form.leadSource) && (automated || !isBlank(form.leadSourceDetails));
  // Offers and budget are recorded when there are any — never a blocker.
  const doneOffers = !isBlank(form.businessOffers) || !isBlank(form.customerBudget);

  // Customer details are entered at the top of the form; the checklist row only
  // confirms them, so it must say exactly which part is still missing.
  const customerMissing = [
    [!isBlank(form.leadType), "type of lead"],
    [!business || !isBlank(form.customerLegalName), "business name"],
    [!isBlank(form.customerFirstName), "first name"],
    [!isBlank(form.customerLastName), "last name"],
    [donePhone, "phone"],
    [doneEmail, "email"],
    [!isBlank(form.siteLine1), "site street"],
    [!isBlank(form.siteSuburb), "suburb"],
    [!isBlank(form.sitePostcode), "postcode"],
  ]
    .filter(([done]) => !done)
    .map(([, label]) => label);
  const doneCustomer = customerMissing.length === 0;

  // One entry per mandatory row — the single source of truth for the row
  // ticks, the progress bar and the "Potential" gate below.
  const requiredRows = [
    { label: "Contact client", done: doneContact },
    { label: "Customer details", done: doneCustomer, missing: customerMissing },
    { label: "Service requirement", done: doneService },
    { label: "Billing address", done: doneBilling },
    { label: "Roof / site measurements", done: doneMeasurements },
    { label: "House type", done: doneStoreys },
    { label: "Roof type", done: doneRoof },
    { label: "Electrical phase", done: donePhase },
    { label: "Electricity bills", done: doneBills },
    { label: "Annual usage", done: doneUsage },
    { label: "Finance assistance", done: doneFinance },
    { label: "Site requirements & extra costs", done: doneSiteRequirements },
    { label: "Preferred timeframe", done: doneTimeframe },
    { label: "Preferred location", done: doneLocation },
    { label: "Genuine interest", done: doneIntent },
    { label: "Initial requirements & comments", done: doneComments },
    { label: "Where they got our details", done: doneSource },
  ];
  const outstanding = requiredRows.filter((r) => !r.done);
  const doneCount = requiredRows.length - outstanding.length;
  const checklistComplete = outstanding.length === 0;

  return (
    <>
      <Tabs
        items={[
          { key: "customer", label: "Customer details", icon: <Building2 size={14} /> },
          ...(hasSalesperson
            ? [
                {
                  key: "checklist",
                  label: "Checklist",
                  icon: <ClipboardCheck size={14} />,
                  count: `${doneCount}/${requiredRows.length}`,
                },
                { key: "decision", label: "Notes & decision", icon: <Check size={14} /> },
              ]
            : []),
          ...(requestsPanel
            ? [{ key: "requests", label: "Request / Response", icon: <HandHelping size={14} /> }]
            : []),
        ]}
        value={activeTab}
        onChange={setTab}
      />

      {/* The Edit button sits in the card head, above the tabs and often off
          screen by the time you are deep in the checklist — so say here, on
          whichever tab you are on, why nothing can be filled in. */}
      {disabled ? (
        <Alert tone="info" style={{ marginBottom: 16 }}>
          <span style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span>
              This lead is read-only.{" "}
              {onUnlock ? "Unlock it to fill in the checklist." : "Editing needs the \u201cUpdate Leads\u201d permission."}
            </span>
            {onUnlock ? (
              <button type="button" className="btn btn-primary btn-sm" style={{ marginLeft: "auto" }} onClick={onUnlock}>
                <Pencil size={14} /> Edit lead details
              </button>
            ) : null}
          </span>
        </Alert>
      ) : null}

      {activeTab === "customer" ? (
        <div className="section" id="lf-customer">
          <SectionHead icon={<Building2 size={13} />} title="Customer" />
          <div className="form-grid">
            {/* First: a commercial lead is a business with an ABN, a
                residential one is a person — the rest of the section follows. */}
            <Field label="Type of lead" className="span-2" error={err("leadType")}>
              <select value={form.leadType} disabled={disabled} onChange={(e) => set("leadType", e.target.value)}>
                <option value="">Select type</option>
                {leadTypeOptions.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>

            {business ? (
              <>
                <Field label="Business name" error={err("customerLegalName")}>
                  {input("customerLegalName")}
                </Field>
                <Field label="ABN" hint="commercial leads only">
                  {input("customerAbn")}
                </Field>
              </>
            ) : null}

            <Field label="First name" error={err("customerFirstName")}>
              {input("customerFirstName", { autoComplete: "given-name" })}
            </Field>
            <Field label="Last name" error={err("customerLastName")}>
              {input("customerLastName", { autoComplete: "family-name" })}
            </Field>

            <Field label="Phone" error={err("customerPhone")}>
              {input("customerPhone")}
            </Field>
            <Field label="Email" error={err("customerEmail")}>
              {input("customerEmail", { type: "email" })}
            </Field>

            <Field label="Site address" className="span-2" error={err("siteLine1")}>
              {input("siteLine1", { placeholder: "Street" })}
            </Field>
            <Field label="Suburb" error={err("siteSuburb")}>{input("siteSuburb", { placeholder: "Suburb" })}</Field>
            <div className="form-grid" style={{ gap: 12 }}>
              <Field label="State">
                <select value={form.siteState} disabled={disabled} onChange={(e) => set("siteState", e.target.value)}>
                  {AU_STATES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Postcode" error={err("sitePostcode")}>
                {input("sitePostcode", { placeholder: "Postcode", inputMode: "numeric", maxLength: 4 })}
              </Field>
            </div>

            <Field label="Salesperson" hint="unlocks the mandatory checklist once set">
              <select value={form.salespersonId} disabled={disabled} onChange={(e) => set("salespersonId", e.target.value)}>
                <option value="">Later</option>
                {sales.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
            </Field>
            {isBlank(form.salespersonId) ? (
              <Field label="Reason no salesperson is assigned yet" className="span-2" error={err("unassignedReason")}>
                <textarea
                  rows={2}
                  value={form.unassignedReason}
                  disabled={disabled}
                  onChange={(e) => set("unassignedReason", e.target.value)}
                />
              </Field>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeTab === "requests" ? requestsPanel : null}

      {activeTab === "checklist" ? (
        <div className="section" id="lf-checklist">
          <p className="lede" style={{ marginBottom: 16 }}>
            The counted rows are needed before this lead can move forward. The optional rows below them travel to
            estimation with the lead — fill in what you have.
          </p>
            <div className="checklist-progress">
              <span className="cp-label">
                {doneCount} of {requiredRows.length} complete
              </span>
              <div className="cp-track">
                <i style={{ width: `${(doneCount / requiredRows.length) * 100}%` }} />
              </div>
            </div>

              <div className="checklist" style={{ marginBottom: 20 }}>
              <ChecklistRow done={doneContact} label="Contact client?">
                <p className="lede" style={{ margin: "0 0 10px" }}>
                  Did you have to contact the client to collect the mandatory details?
                </p>
                <ChoiceGroup
                  name="lf-contact"
                  otherLabel="answer"
                  options={CONTACT_OPTIONS}
                  value={form.needsClientContact}
                  disabled={disabled}
                  error={err("needsClientContact")}
                  onChange={(v) => set("needsClientContact", v)}
                />
                {form.needsClientContact === "yes" ? (
                  <div>
                    {contactAttempts.length ? (
                      <div className="list-stack" style={{ marginBottom: 10 }}>
                        {contactAttempts.map((a, i) => (
                          <div key={i} className="list-row">
                            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                              <span className={`status-icon ${a.reached === false ? "failed" : "done"}`}>
                                <PhoneCall size={14} />
                              </span>
                              <div>
                                <div className="row-title">
                                  Attempt {i + 1} · {a.method} · {a.reached === false ? "Not reached" : "Reached"}
                                </div>
                                <div className="row-meta">
                                  {formatDate(a.contactedAt)}
                                  {a.reached === false && a.reason ? ` — ${a.reason}` : ""}
                                </div>
                                {a.notes ? <div className="row-meta">{a.notes}</div> : null}
                              </div>
                            </div>
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              disabled={disabled}
                              onClick={() => removeContactAttempt(i)}
                              aria-label="Remove attempt"
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : null}
                    {err("contactAttempts") ? (
                      <p className="field-error" style={{ marginBottom: 8 }}>
                        {err("contactAttempts")}
                      </p>
                    ) : null}
                    <p className="lede" style={{ marginBottom: 8 }}>
                      No response yet? Log another attempt — every attempt is kept.
                    </p>
                    <div className="form-grid" style={{ marginBottom: 8 }}>
                      <Field label="How you tried" hint="required">
                        <input
                          value={attemptDraft.method}
                          disabled={disabled}
                          onChange={(e) => setAttemptDraft((a) => ({ ...a, method: e.target.value }))}
                          onKeyDown={attemptKeyDown}
                          placeholder="e.g. Phone call, email"
                        />
                      </Field>
                      <Field label="When" hint="required">
                        <input
                          type="date"
                          value={attemptDraft.contactedAt}
                          disabled={disabled}
                          onChange={(e) => setAttemptDraft((a) => ({ ...a, contactedAt: e.target.value }))}
                          onKeyDown={attemptKeyDown}
                        />
                      </Field>
                    </div>
                    <label className="check" style={{ marginBottom: attemptDraft.reached ? 0 : 10 }}>
                      <input
                        type="checkbox"
                        checked={attemptDraft.reached}
                        disabled={disabled}
                        onChange={(e) => setAttemptDraft((a) => ({ ...a, reached: e.target.checked }))}
                      />
                      Client was reached
                    </label>
                    {!attemptDraft.reached ? (
                      <Field label="Reason not reached">
                        <textarea
                          rows={2}
                          value={attemptDraft.reason}
                          disabled={disabled}
                          onChange={(e) => setAttemptDraft((a) => ({ ...a, reason: e.target.value }))}
                          placeholder="e.g. No answer, voicemail left"
                        />
                      </Field>
                    ) : null}
                    <Field label="Notes" hint="what was discussed on this attempt">
                      <textarea
                        rows={2}
                        value={attemptDraft.notes}
                        disabled={disabled}
                        onChange={(e) => setAttemptDraft((a) => ({ ...a, notes: e.target.value }))}
                      />
                    </Field>
                    <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={disabled || !attemptDraftValid}
                        onClick={addContactAttempt}
                      >
                        <Plus size={14} /> Add attempt
                      </button>
                      {!disabled && !attemptDraftValid ? (
                        <span className="row-meta">Still needed: {attemptDraftMissing.join(", ")}</span>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </ChecklistRow>

              {/* Name, phone and email are captured once, at the top of the form —
                  this row only confirms them, it never asks again. */}
              <ChecklistRow done={doneCustomer} label="Customer details">
                <p className="lede" style={{ margin: 0 }}>
                  {business ? "Commercial" : form.leadType ? "Residential" : "Type not set"}
                  {business && form.customerLegalName ? ` · ${form.customerLegalName}` : ""}
                  {doneName ? ` · ${form.customerFirstName} ${form.customerLastName}` : " · Name incomplete"}
                  {business ? ` · ABN ${form.customerAbn || "not supplied"}` : ""}
                </p>
                <p className="lede" style={{ margin: "4px 0 0" }}>
                  {donePhone ? form.customerPhone : "Phone not entered"} · {doneEmail ? form.customerEmail : "Email not entered"}
                </p>
                <p className="lede" style={{ margin: "4px 0 0" }}>
                  {doneAddress ? siteAddressLine : "Site address incomplete"}
                </p>
                {customerMissing.length ? (
                  <p className="field-error" style={{ marginTop: 6 }}>
                    Still needed above: {customerMissing.join(", ")}
                  </p>
                ) : null}
                <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => setTab("customer")}>
                  Edit customer details
                </button>
              </ChecklistRow>

              <ChecklistRow done={doneService} label="Service requirement">
                <ChoiceGroup
                  name="lf-service"
                  otherLabel="service requirement"
                  options={SERVICE_REQUIREMENTS}
                  value={form.serviceRequirement}
                  disabled={disabled}
                  error={err("serviceRequirement")}
                  onChange={(v) => set("serviceRequirement", v)}
                />
              </ChecklistRow>

              {/* The site address is captured above — only billing is asked here. */}
              <ChecklistRow done={doneBilling} label="Billing address">
                <p className="lede" style={{ margin: "0 0 10px" }}>
                  Is the site address also the billing address?
                </p>
                <ChoiceGroup
                  name="lf-billing"
                  otherLabel="billing address"
                  options={BILLING_OPTIONS}
                  value={form.billingSameAsSite}
                  disabled={disabled}
                  error={err("billingSameAsSite")}
                  onChange={(v) => set("billingSameAsSite", v)}
                />
                {form.billingSameAsSite === "no" ? (
                  <div style={{ marginTop: 10 }}>
                    <Field label="Billing address" error={err("customerBillingAddress")}>
                      {input("customerBillingAddress", { placeholder: "Street, suburb, state and postcode" })}
                    </Field>
                  </div>
                ) : null}
              </ChecklistRow>

              {/* Optional: only recorded when the customer would rather not deal
                  in English, so the lead can go to a native speaker. */}
              <ChecklistRow done label="Preferred language">
                <Field hint="optional — leave as English unless the customer asked otherwise">
                  <select
                    value={languageIsOther ? "__other" : form.preferredLanguage}
                    disabled={disabled}
                    onChange={(e) => {
                      const value = e.target.value;
                      setLanguageOther(value === "__other");
                      set("preferredLanguage", value === "__other" ? "" : value);
                    }}
                  >
                    <option value="">{DEFAULT_LANGUAGE}</option>
                    {COMMON_LANGUAGES.map((language) => (
                      <option key={language} value={language}>
                        {language}
                      </option>
                    ))}
                    <option value="__other">Other…</option>
                  </select>
                </Field>
                {languageIsOther ? (
                  <div style={{ marginTop: 10 }}>
                    <Field label="Language">
                      {input("preferredLanguage", { placeholder: "Type the language", autoFocus: true })}
                    </Field>
                  </div>
                ) : null}
              </ChecklistRow>

              <ChecklistRow done={!isBlank(form.siteMapUrl)} label="Site access">
                <div className="form-grid">
                  <Field label="Map location" className="span-2" error={err("siteMapUrl")}>
                    {input("siteMapUrl", { placeholder: "Paste a Google Maps link" })}
                  </Field>
                  <Field label="Site contact" hint="if someone else meets us there">
                    {input("siteContact", { placeholder: "Name and number" })}
                  </Field>
                  <Field label="Access notes" hint="gate codes, parking, hours">
                    {input("siteAccessNotes")}
                  </Field>
                </div>
              </ChecklistRow>

              <ChecklistRow done={doneMeasurements} label="Roof / site measurements">
              <Field hint="dimensions, usable area, tilt — what estimation sizes the system from">
                {textarea("roofMeasurements")}
              </Field>
            </ChecklistRow>

            <ChecklistRow done={doneStoreys} label="House type">
                <ChoiceGroup
                  name="lf-storeys"
                  otherLabel="house type"
                  options={STOREY_OPTIONS}
                  value={form.propertyStoreys}
                  disabled={disabled}
                  error={err("propertyStoreys")}
                  onChange={(v) => set("propertyStoreys", v)}
                />
              </ChecklistRow>

              <ChecklistRow done={doneRoof} label="Roof type">
                <ChoiceGroup
                  name="lf-roof"
                  otherLabel="roof type"
                  options={ROOF_TYPES}
                  value={form.roofType}
                  disabled={disabled}
                  error={err("roofType")}
                  onChange={(v) => set("roofType", v)}
                />
              </ChecklistRow>

              <ChecklistRow done={donePhase} label="Electrical phase">
                <ChoiceGroup
                  name="lf-phase"
                  otherLabel="electrical phase"
                  options={ELECTRICAL_PHASES}
                  value={form.electricalPhase}
                  disabled={disabled}
                  error={err("electricalPhase")}
                  onChange={(v) => set("electricalPhase", v)}
                />
              </ChecklistRow>

              <ChecklistRow done={doneBills} label="Electricity bills">
                <label className="check" style={{ marginBottom: 10 }}>
                  <input
                    type="checkbox"
                    checked={form.energyHasBills}
                    disabled={disabled}
                    onChange={(e) => set("energyHasBills", e.target.checked)}
                  />
                  Bills available on file
                </label>
                {onUploadBills ? (
                  <FileDropzone files={billFiles} onSelect={onUploadBills} disabled={disabled} uploading={uploadingBills} />
                ) : (
                  <p className="dropzone-empty" style={{ margin: 0 }}>
                    Upload available once this lead is saved.
                  </p>
                )}
              </ChecklistRow>

              <ChecklistRow done={doneUsage} label="Annual usage (kWh)">
                <Field error={err("energyAnnualKwh")}>
                  <NumberInput
                    value={form.energyAnnualKwh}
                    disabled={disabled}
                    min={0}
                    onChange={(v) => set("energyAnnualKwh", v)}
                  />
                </Field>
              </ChecklistRow>

              <ChecklistRow done={doneFinance} label="Finance assistance">
                <ChoiceGroup
                  name="lf-finance"
                  otherLabel="finance assistance"
                  options={FINANCE_OPTIONS}
                  value={form.financeAssistance}
                  disabled={disabled}
                  error={err("financeAssistance")}
                  onChange={(v) => set("financeAssistance", v)}
                />
                {form.financeAssistance === "yes" ? (
                  <div style={{ marginTop: 10 }}>
                    <Field label="What they need" hint="lender, loan type, deposit" error={err("financeNotes")}>
                      {textarea("financeNotes", { placeholder: "e.g. zero-interest loan, 24 months" })}
                    </Field>
                  </div>
                ) : null}
              </ChecklistRow>

              <ChecklistRow done={doneSiteRequirements} label="Site requirements & extra costs">
                <label className="check" style={{ marginBottom: form.siteRequirementsNone ? 0 : 10 }}>
                  <input
                    type="checkbox"
                    checked={form.siteRequirementsNone}
                    disabled={disabled}
                    onChange={(e) => set("siteRequirementsNone", e.target.checked)}
                  />
                  None identified at this site
                </label>
                {!form.siteRequirementsNone ? (
                  <Field
                    hint="switchboard upgrade, asbestos, crane or scaffold access, long cable runs"
                    error={err("siteSpecificRequirements")}
                  >
                    {textarea("siteSpecificRequirements", { placeholder: "Anything that could add cost on site" })}
                  </Field>
                ) : null}
              </ChecklistRow>

              <ChecklistRow done={doneTimeframe} label="Preferred timeframe">
                <Field error={err("preferredInstallTimeframe")}>
                  <select
                    value={form.preferredInstallTimeframe}
                    disabled={disabled}
                    onChange={(e) => set("preferredInstallTimeframe", e.target.value)}
                  >
                    <option value="">When does the customer want it installed?</option>
                    {INSTALL_TIMEFRAMES.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </ChecklistRow>

              <ChecklistRow done={doneLocation} label="Preferred location">
                <Field hint="where on site the system goes" error={err("preferredInstallLocation")}>
                  {input("preferredInstallLocation", { placeholder: "e.g. north-facing roof, garage wall for the battery" })}
                </Field>
              </ChecklistRow>

              <ChecklistRow done={doneIntent} label="Genuine interest">
                <label className="check" style={{ margin: 0 }}>
                  <input
                    type="checkbox"
                    checked={form.customerIntentConfirmed}
                    disabled={disabled}
                    onChange={(e) => set("customerIntentConfirmed", e.target.checked)}
                  />
                  Customer confirmed they are genuinely interested in proceeding
                </label>
                {err("customerIntentConfirmed") ? (
                  <p className="field-error" style={{ marginTop: 6 }}>
                    {err("customerIntentConfirmed")}
                  </p>
                ) : null}
              </ChecklistRow>

              <ChecklistRow done={doneComments} label="Initial requirements & comments">
                <Field
                  hint="what they want from the system, anything else they asked for, financial options discussed"
                  error={err("customerComments")}
                >
                  {textarea("customerComments", { rows: 3, placeholder: "Initial customer requirements and comments" })}
                </Field>
              </ChecklistRow>

              <ChecklistRow done={doneSource} label="Where they got our details">
                <Field hint="feeds the referral reward program" error={err("leadSource")}>
                  {automated ? (
                    <input value={leadSourceLabel(form.leadSource)} disabled />
                  ) : (
                    <select value={form.leadSource} disabled={disabled} onChange={(e) => set("leadSource", e.target.value)}>
                      {MANUAL_LEAD_SOURCES.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  )}
                </Field>
                {!automated && !isBlank(form.leadSource) ? (
                  <div style={{ marginTop: 10 }}>
                    <Field label="Source details" error={err("leadSourceDetails")}>
                      <input
                        value={form.leadSourceDetails}
                        disabled={disabled}
                        onChange={(e) => set("leadSourceDetails", e.target.value)}
                        placeholder="Who referred, or where this lead came from"
                      />
                    </Field>
                  </div>
                ) : null}
                {form.leadSource === "referrer" ? (
                  <div className="form-grid" style={{ marginTop: 10 }}>
                    <Field label="Referrer" error={err("referrerId")}>
                      <select value={form.referrerId} disabled={disabled} onChange={(e) => set("referrerId", e.target.value)}>
                        <option value="">Select</option>
                        {referrers.map((r) => (
                          <option key={r.id} value={r.id}>
                            {r.organisation}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Involvement tier">
                      <select
                        value={form.involvementTier}
                        disabled={disabled}
                        onChange={(e) => set("involvementTier", e.target.value)}
                      >
                        {tiers.map((t) => (
                          <option key={t.key} value={t.key}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </Field>
                  </div>
                ) : null}
              </ChecklistRow>

              <ChecklistRow done={doneOffers} label="Business offers & budget">
                <div className="form-grid">
                  <Field label="Offers made" className="span-2" hint="promotions or pricing the customer was offered — leave blank if none">
                    {textarea("businessOffers", { rows: 2, placeholder: "e.g. free monitoring for 12 months" })}
                  </Field>
                  <Field label="Customer budget" hint="if they gave one" error={err("customerBudget")}>
                    <NumberInput
                      value={form.customerBudget}
                      disabled={disabled}
                      min={0}
                      onChange={(v) => set("customerBudget", v)}
                    />
                  </Field>
                </div>
              </ChecklistRow>

              </div>
            <div className="checklist" style={{ marginBottom: 20 }}>
              {/* ---- What estimation needs before BOQ preparation ---- */}

              <GroupHead title="Site & Inspection" />

                <ChecklistRow done={!isBlank(form.preSiteInspectionRequired)} label="Pre-site inspection">
                <Field label="Inspection required">{yesNo("preSiteInspectionRequired")}</Field>
                {inspectionNeeded ? (
                  <div style={{ marginTop: 10 }}>
                    <div className="form-grid">
                      <Field label="Site crew member" hint="assigned by operations">
                        <input type="text" value={inspection?.assigneeName || "Not assigned yet"} disabled readOnly />
                      </Field>
                      <Field label="Inspection status" hint="tracked from the request">
                        <input type="text" value={inspectionStatusLabel(inspectionStatus)} disabled readOnly />
                      </Field>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
                      {inspection ? (
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onRequestInspection?.(inspection)}>
                          <ExternalLink size={14} /> Open the pre-site inspection form
                        </button>
                      ) : onRequestInspection ? (
                        <button type="button" className="btn btn-primary btn-sm" disabled={disabled} onClick={() => onRequestInspection(null)}>
                          <Send size={14} /> Request pre-site inspection
                        </button>
                      ) : null}
                    </div>
                    <div style={{ marginTop: 10 }}>
                      {checkbox("siteVisitCompleted", "Site visit completed and findings reviewed")}
                    </div>
                    <div style={{ marginTop: 10 }}>
                      <h3>Site photos</h3>
                      {onUploadSitePhotos ? (
                        <FileDropzone
                          files={sitePhotos}
                          onSelect={onUploadSitePhotos}
                          disabled={disabled}
                          uploading={uploadingCategory === "photo"}
                        />
                      ) : (
                        <p className="dropzone-empty" style={{ margin: 0 }}>
                          Uploads are available once the lead is saved.
                        </p>
                      )}
                    </div>
                  </div>
                ) : null}
              </ChecklistRow>

              <GroupHead title={TECHNICAL_GROUP} />

              <ChecklistRow
                done={!isBlank(form.existingElectrical) || !isBlank(form.switchboardCondition)}
                label="Existing electrical system"
              >
                <div className="form-grid">
                  <Field label="Electrical phase" hint="confirmed during lead qualification">
                    <input
                      type="text"
                      value={electricalPhaseLabel(form.electricalPhase) || "Not confirmed yet"}
                      disabled
                      readOnly
                    />
                  </Field>
                  <Field label="Main switchboard / DB">
                    {selectField("switchboardCondition", SWITCHBOARD_CONDITIONS, "Select condition")}
                  </Field>
                  <Field label="Switchboard upgrade required">{yesNo("switchboardUpgrade")}</Field>
                  <Field label="Switchboard / DB location" className="span-2">
                    {input("switchboardLocation", { placeholder: "e.g. garage wall, external meter box" })}
                  </Field>
                  <Field label="Existing system" className="span-2" hint="mains, cabling, metering, known issues">
                    {textarea("existingElectrical")}
                  </Field>
                  <Field label="Electrical load requirements" className="span-2" hint="existing and planned loads, EV, pool">
                    {textarea("loadRequirements")}
                  </Field>
                </div>
              </ChecklistRow>

              <ChecklistRow done={!isBlank(form.isRetrofit)} label="Existing solar, inverter & battery">
                <Field label="Retrofit to an existing system?">{yesNo("isRetrofit")}</Field>
                {retrofit ? (
                  <div className="form-grid" style={{ marginTop: 10 }}>
                    <Field label="Existing solar (kW)">
                      <NumberInput
                        value={form.existingSolarKw}
                        min={0}
                        step="0.1"
                        disabled={disabled}
                        onChange={(v) => set("existingSolarKw", v)}
                      />
                    </Field>
                    <Field label="Existing inverter">{input("existingInverter", { placeholder: "Brand and model" })}</Field>
                    <Field label="Existing battery">{input("existingBattery", { placeholder: "Brand, model and kWh" })}</Field>
                    <Field label="Notes" className="span-2" hint="age, condition, warranty, what stays">
                      {textarea("existingSystemNotes")}
                    </Field>
                  </div>
                ) : null}
              </ChecklistRow>

              <ChecklistRow
                done={!isBlank(form.panelQty) || !isBlank(form.inverterBrandModel)}
                label="New system specification"
              >
                <div className="form-grid">
                  <Field label="Solar panel quantity">
                    <NumberInput value={form.panelQty} min={0} disabled={disabled} onChange={(v) => set("panelQty", v)} />
                  </Field>
                  <Field label="Panel capacity (W)" hint={sizeKw ? `System capacity ${sizeKw.toFixed(2)} kW` : "per panel"}>
                    <NumberInput
                      value={form.panelCapacityW}
                      min={0}
                      disabled={disabled}
                      onChange={(v) => set("panelCapacityW", v)}
                    />
                  </Field>
                  <Field label="Preferred brands / models" className="span-2">{input("preferredBrands")}</Field>
                  <Field label="Inverter brand & model" className="span-2">{input("inverterBrandModel")}</Field>
                  <Field label="Battery brand & model">{input("batteryBrandModel", { placeholder: "If applicable" })}</Field>
                  <Field label="Battery capacity (kWh)">
                    <NumberInput
                      value={form.batteryCapacityKwh}
                      min={0}
                      step="0.1"
                      disabled={disabled}
                      onChange={(v) => set("batteryCapacityKwh", v)}
                    />
                  </Field>
                  <Field label="Backup requirement">{selectField("backupRequirement", BACKUP_OPTIONS, "Select backup")}</Field>
                  <Field label="Backup duration" hint="how long it has to run">
                    {input("backupDuration", { placeholder: "e.g. 8 hours essentials" })}
                  </Field>
                </div>
              </ChecklistRow>

              <ChecklistRow
                done={!isBlank(form.mountingRequirements) || !isBlank(form.siteConstraints)}
                label="Mounting, shading & site constraints"
              >
                <div className="form-grid">
                  <Field label="Mounting / roof structure" className="span-2" hint="tilt frames, rail type, structural notes">
                    {textarea("mountingRequirements")}
                  </Field>
                  <Field label="Cable, conduit & trunking" className="span-2">{textarea("cableRequirements")}</Field>
                  <Field label="Shading, orientation & constraints" className="span-2">{textarea("siteConstraints")}</Field>
                </div>
              </ChecklistRow>

              <GroupHead title="Installation, Permits & Utility" />

              <ChecklistRow
                done={!isBlank(form.specialRequirements)}
                label="Special installation requirements"
              >
                <Field label="Special requirements" hint="crane, scaffold, after-hours">
                  {textarea("specialRequirements")}
                </Field>
              </ChecklistRow>

              <ChecklistRow
                done={(form.permits || []).length > 0 || !isBlank(form.vppEligibility)}
                label="Permits, approvals & VPP"
              >
                <div className="choice-grid">
                  {PERMIT_OPTIONS.map((permit) => (
                    <label key={permit.key} className="choice">
                      <input
                        type="checkbox"
                        checked={(form.permits || []).includes(permit.key)}
                        disabled={disabled}
                        onChange={() => togglePermit(permit.key)}
                      />
                      <span>{permit.label}</span>
                    </label>
                  ))}
                </div>
                <div style={{ marginTop: 10 }}>
                  {checkbox("vppDiscussed", "VPP requirements discussed with the customer, if applicable")}
                </div>
                <div className="form-grid" style={{ marginTop: 10 }}>
                  <Field label="VPP incentive / eligibility">{selectField("vppEligibility", VPP_OPTIONS, "Select eligibility")}</Field>
                  <Field label="VPP requirements" hint="retailer, program">{input("vppNotes")}</Field>
                  <Field label="Permit / approval notes" className="span-2">{input("permitNotes")}</Field>
                </div>
              </ChecklistRow>

              <ChecklistRow
                done={!isBlank(form.meterRequirements) || drawings.length > 0}
                label="Utility, meter & drawings"
              >
                <Field label="Utility or meter requirements" hint="NMI, meter change, network limits">
                  {input("meterRequirements")}
                </Field>
                <div style={{ marginTop: 10 }}>
                  <h3>Drawings, layouts & SLD</h3>
                  {onUploadDrawings ? (
                    <FileDropzone
                      files={drawings}
                      onSelect={onUploadDrawings}
                      disabled={disabled}
                      uploading={uploadingCategory === "sketch"}
                    />
                  ) : (
                    <p className="dropzone-empty" style={{ margin: 0 }}>
                      Uploads are available once the lead is saved.
                    </p>
                  )}
                </div>
              </ChecklistRow>

              <GroupHead title="Customer-Specific Notes" />

              <ChecklistRow
                done={!isBlank(form.inclusions) || !isBlank(form.exclusions)}
                label="Customer-specific notes"
              >
                <div className="form-grid">
                  <Field label="Inclusions" hint="what the customer was promised">{textarea("inclusions")}</Field>
                  <Field label="Exclusions" hint="what is not covered">{textarea("exclusions")}</Field>
                </div>
              </ChecklistRow>

            </div>
        </div>
      ) : null}

      {activeTab === "decision" ? (
        <div className="section" id="lf-decision">
            <div className="decision-card">
              <SectionHead icon={<ClipboardCheck size={13} />} title="Custom fields" />
              <div className="list-stack" style={{ marginBottom: 10 }}>
                {customFields.map((f, i) => (
                  <div key={i} className="form-grid" style={{ alignItems: "start" }}>
                    <Field>
                      <input
                        placeholder="Field name"
                        value={f.label}
                        disabled={disabled}
                        onChange={(e) => setCustomField(i, "label", e.target.value)}
                      />
                    </Field>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <Field>
                          <input
                            placeholder="Value"
                            value={f.value}
                            disabled={disabled}
                            onChange={(e) => setCustomField(i, "value", e.target.value)}
                          />
                        </Field>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={disabled}
                        onClick={() => removeCustomField(i)}
                        aria-label="Remove field"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={addCustomField} disabled={disabled}>
                <Plus size={14} /> Add custom field
              </button>
            </div>

            <div className="decision-card">
              <SectionHead icon={<ClipboardCheck size={13} />} title="Note for the estimator" />
              <Field hint="optional — anything estimation should know before they pick this up">
                {textarea("noteForEstimator", { rows: 2 })}
              </Field>
            </div>

            <div className="decision-card">
              <SectionHead icon={<Check size={13} />} title="Potential client?" />
              {!checklistComplete ? (
                <div className="alert warning" style={{ marginBottom: 12 }}>
                  Complete the checklist before marking this lead Potential — Estimation needs all of it. Still open:
                  <ul>
                    {outstanding.map((r) => (
                      <li key={r.label}>
                        {r.label}
                        {r.missing?.length ? ` (${r.missing.join(", ")})` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              <div className="decision-actions">
                <button
                  type="button"
                  className={`btn ${form.potential === "yes" ? "btn-primary" : "btn-ghost"}`}
                  disabled={disabled || !checklistComplete}
                  onClick={() => set("potential", "yes")}
                >
                  Potential
                </button>
                <button
                  type="button"
                  className={`btn ${form.potential === "no" ? "btn-danger" : "btn-ghost"}`}
                  disabled={disabled}
                  onClick={() => set("potential", "no")}
                >
                  Not potential
                </button>
              </div>

              {form.potential === "no" ? (
                <div style={{ marginTop: 14, maxWidth: 480 }}>
                  <Field label="Reason" error={err("notPotentialReason")}>
                    <textarea
                      rows={2}
                      value={form.notPotentialReason}
                      disabled={disabled}
                      onChange={(e) => set("notPotentialReason", e.target.value)}
                    />
                  </Field>
                </div>
              ) : null}

              {form.potential === "yes" ? (
                <div style={{ marginTop: 14, maxWidth: 320 }}>
                  <Field label="Assign estimator" error={err("estimatorId")}>
                    <select value={form.estimatorId} disabled={disabled} onChange={(e) => set("estimatorId", e.target.value)}>
                      <option value="">Select estimator</option>
                      {estimators.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.name}
                          {u.title ? ` · ${u.title}` : ""}
                        </option>
                      ))}
                    </select>
                    {estimators.length === 0 ? (
                      <span className="field-error">No one in this unit can be assigned yet. Add users in Admin.</span>
                    ) : null}
                  </Field>
                </div>
              ) : null}
            </div>
        </div>
      ) : null}
    </>
  );
}