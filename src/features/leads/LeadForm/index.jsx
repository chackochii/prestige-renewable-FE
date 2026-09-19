// Lead pack form: the customer and site, then the mandatory checklist — which
// folds in the optional client-visit capture and the potential-client
// decision, in that order.
//
// Type of lead comes first: it decides whether the customer is a business
// (business name + ABN) or a person, so nothing below it can be filled in
// wrongly. The checklist below is what Estimation needs confirmed with the
// customer before the lead can be marked Potential.

import { useEffect, useState } from "react";
import { Building2, Check, ClipboardCheck, PhoneCall, Plus, X } from "lucide-react";
import { formatDate } from "@/helpers/dateTimeHelpers";
import Field from "@/components/Field";
import SectionHead from "@/components/SectionHead";
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
} from "@/features/leads/propertyOptions";
import { COMMON_LANGUAGES, DEFAULT_LANGUAGE } from "@/constants/languages";
import { isAutomatedSource } from "@/features/leads/leadFormModel";
import { isBlank } from "@/utils/validators";
import ChecklistRow from "./ChecklistRow";

const SECTIONS = [
  { id: "lf-customer", label: "Customer", icon: Building2 },
  { id: "lf-checklist", label: "Checklist", icon: ClipboardCheck },
];

const BILLING_OPTIONS = [
  { key: "yes", label: "Yes — bill to the site address" },
  { key: "no", label: "No — different billing address" },
];

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

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
}) {
  const err = (field) => errors[field];
  const hasSalesperson = !isBlank(form.salespersonId) && showChecklist;
  const visibleSections = SECTIONS.filter((s) => s.id !== "lf-checklist" || hasSalesperson);
  const [active, setActive] = useState(visibleSections[0].id);
  const automated = isAutomatedSource(form.leadSource);
  const tiers = commissionTiersFor(unit);
  const business = isBusinessLead(form.leadType);
  // Records captured under an older, longer list (industrial, other) keep
  // their type rather than silently reverting to "Select type".
  const leadTypeOptions = LEAD_TYPES.some((t) => t.key === form.leadType) || isBlank(form.leadType)
    ? LEAD_TYPES
    : [...LEAD_TYPES, { key: form.leadType, label: form.leadType }];

  useEffect(() => {
    const nodes = visibleSections.map((s) => document.getElementById(s.id)).filter(Boolean);
    if (!nodes.length || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSalesperson]);

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
  const attemptDraftValid =
    attemptDraft.method.trim() && attemptDraft.contactedAt && (attemptDraft.reached || attemptDraft.reason.trim());
  const addContactAttempt = () => {
    if (!attemptDraftValid) return;
    set("contactAttempts", [...contactAttempts, attemptDraft]);
    setAttemptDraft(emptyAttemptDraft);
  };
  const removeContactAttempt = (i) => set("contactAttempts", contactAttempts.filter((_, idx) => idx !== i));

  // One boolean per mandatory row — the single source of truth for both the
  // row ticks and the "Potential" gate/progress bar below.
  const doneContact = !form.needsClientContact || contactAttempts.length > 0;
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
      <div className="form-nav">
        {visibleSections.map((s) => (
          <button
            key={s.id}
            type="button"
            className={active === s.id ? "active" : ""}
            onClick={() => {
              setActive(s.id);
              scrollTo(s.id);
            }}
          >
            <s.icon size={13} /> {s.label}
          </button>
        ))}
      </div>

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

          <Field label={business ? "Contact first name" : "First name"} error={err("customerFirstName")}>
            {input("customerFirstName", { autoComplete: "given-name" })}
          </Field>
          <Field label={business ? "Contact last name" : "Last name"} error={err("customerLastName")}>
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

      {hasSalesperson ? (
        <div className="section" id="lf-checklist">
          <SectionHead icon={<ClipboardCheck size={13} />} title="Mandatory checklist" />
          <p className="lede" style={{ marginBottom: 16 }}>
            What Estimation needs before this lead can move forward — confirm each one with the customer, or upload the
            document.
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
              <label className="check" style={{ marginBottom: form.needsClientContact ? 10 : 0 }}>
                <input
                  type="checkbox"
                  checked={form.needsClientContact}
                  disabled={disabled}
                  onChange={(e) => set("needsClientContact", e.target.checked)}
                />
                Need to contact client to collect mandatory details
              </label>
              {form.needsClientContact ? (
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
                    <Field>
                      <input
                        value={attemptDraft.method}
                        disabled={disabled}
                        onChange={(e) => setAttemptDraft((a) => ({ ...a, method: e.target.value }))}
                        placeholder="e.g. Phone call, email"
                      />
                    </Field>
                    <Field>
                      <input
                        type="date"
                        value={attemptDraft.contactedAt}
                        disabled={disabled}
                        onChange={(e) => setAttemptDraft((a) => ({ ...a, contactedAt: e.target.value }))}
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
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: 10 }}
                    disabled={disabled || !attemptDraftValid}
                    onClick={addContactAttempt}
                  >
                    <Plus size={14} /> Add attempt
                  </button>
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
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => scrollTo("lf-customer")}>
                Edit above
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
