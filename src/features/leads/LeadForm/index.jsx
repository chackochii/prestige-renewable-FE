// Lead pack form: the customer and site, then the mandatory checklist — which
// folds in the optional client-visit capture and the potential-client
// decision, in that order.
//
// Type of lead comes first: it decides whether the customer is a business
// (business name + ABN) or a person, so nothing below it can be filled in
// wrongly. The checklist below is what Estimation needs confirmed with the
// customer before the lead can be marked Potential.

import { useEffect, useState } from "react";
import { Building2, Check, ChevronDown, ChevronRight, ClipboardCheck, ExternalLink, HandHelping, Pencil, PhoneCall, Plus, Send, X } from "lucide-react";
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
  LEGACY_INSTALL_TIMEFRAMES,
  ROOF_TYPES,
  SERVICE_REQUIREMENTS,
  STOREY_OPTIONS,
  electricalPhaseLabel,
  serviceRequirementKeys,
} from "@/features/leads/propertyOptions";
import { DEFAULT_LANGUAGE } from "@/constants/languages";
import {
  BACKUP_OPTIONS,
  SITE_TYPES,
  SWITCHBOARD_CONDITIONS,
  VPP_OPTIONS,
  systemSizeKw,
} from "@/constants/estimationInput";
import { TECHNICAL_GROUP } from "@/helpers/leadChecklist";
import { isAutomatedSource } from "@/features/leads/leadFormModel";
import { isBlank } from "@/utils/validators";
import ChecklistRow from "./ChecklistRow";

/**
 * Heading above a run of checklist rows — the same titles estimation shows.
 * With `onToggle` it collapses and expands the rows under it.
 */
function GroupHead({ title, count, open = true, onToggle }) {
  return (
    <div className="input-group-head">
      {onToggle ? (
        <button type="button" className="group-toggle" onClick={onToggle} aria-expanded={open}>
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
          <h4>{title}</h4>
        </button>
      ) : (
        <h4>{title}</h4>
      )}
      {count ? <span>{count}</span> : null}
    </div>
  );
}

const BILLING_OPTIONS = [
  { key: "yes", label: "Yes" },
  { key: "no", label: "No" },
];

/**
 * The client-contact question. It starts unanswered on purpose: the row only
 * ticks once someone says what happened, and a "yes" needs a logged attempt
 * behind it.
 */
const CONTACT_OPTIONS = [
  { key: "yes", label: "Yes - log every attempt below" },
  { key: "no", label: "No - we already had everything" },
];

/**
 * Radio group for a short set of answers (storeys, roof, phase, …). Only the
 * listed answers: every question asked this way is a fixed choice the API
 * checks against its own list (prestige-be opportunity model, isIn), so a
 * typed "Other" could never be saved — it failed the whole save while the
 * checklist showed the row as done, and on "had to contact the client?" it
 * quietly turned into "No" and dropped the logged attempts. Anything that
 * does not fit belongs in the comments.
 */
function ChoiceGroup({ name, options, value, disabled, error, onChange }) {
  return (
    <Field error={error}>
      <div className="choice-grid">
        {options.map((o) => (
          <label key={o.key} className="choice">
            <input type="radio" name={name} checked={value === o.key} disabled={disabled} onChange={() => onChange(o.key)} />
            <span>
              {o.label}
              {o.hint ? <small>{o.hint}</small> : null}
            </span>
          </label>
        ))}
      </div>
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
  // Rendered under its own tab when the panel passes one in.
  requestsPanel = null,
  // Called as the person leaves a tab, so the panel can commit that tab's work.
  onTabChange,
  // Unlocks a saved lead for editing. Passed only when the person may edit;
  // without it a locked form just says why it is locked.
  onUnlock,
  // Bumped by the panel after a successful save: the form moves on to the
  // next tab (customer → checklist → assign to estimator).
  advanceTab = 0,
  // Told which tab a save moves on to (its label), or null on the last one —
  // so the panel's Save button can say "Save & continue to …".
  onNextTabChange,
  // "yyyy-mm-dd": the day the lead was created. Date fields cannot go earlier.
  minDate = "",
  // Told true when the Assign to Estimator tab is open and the lead could leave the
  // stage on save (checklist complete, Potential, estimator chosen).
  onReadyToProceedChange,
  // Told which tab is open, so the panel's Save checks that tab (and earlier ones) only.
  onActiveTabChange,
  // Told what the open tab still needs, as one "a, b, c" string ("" when it
  // is complete) — the panel's Continue button is disabled until it is.
  onTabBlockersChange,
}) {
  const err = (field) => errors[field];
  const hasSalesperson = !isBlank(form.salespersonId) && showChecklist;
  const [tab, setTab] = useState("customer");
  // The checklist and the decision need an owner before they mean anything;
  // requests do not, so they stay reachable on an unassigned lead.
  const needsSalesperson = ["checklist", "decision"].includes(tab);
  const activeTab = hasSalesperson || !needsSalesperson ? tab : "customer";
  // A save just went through: move on to the next tab, as far as Assign to Estimator.
  const tabOrder = hasSalesperson ? ["customer", "checklist", "decision"] : ["customer"];
  const nextTabKey = tabOrder.includes(activeTab) ? (tabOrder[tabOrder.indexOf(activeTab) + 1] ?? null) : null;
  const [seenAdvance, setSeenAdvance] = useState(advanceTab);
  if (advanceTab !== seenAdvance) {
    setSeenAdvance(advanceTab);
    if (nextTabKey) setTab(nextTabKey);
  }
  // The panel names the tab a save leads to on its Save button.
  const nextTabLabel = nextTabKey ? { checklist: "Checklist", decision: "Assign to Estimator" }[nextTabKey] : null;
  useEffect(() => {
    onNextTabChange?.(nextTabLabel);
  }, [nextTabLabel, onNextTabChange]);
  useEffect(() => {
    onActiveTabChange?.(activeTab);
  }, [activeTab, onActiveTabChange]);
  // The checklist groups work as an accordion: one open at a time, starting
  // on the first (Mandatory information). Opening another folds the rest;
  // clicking the open one folds it too.
  const [openGroup, setOpenGroup] = useState("mandatory");
  const [showAllGroups, setShowAllGroups] = useState(false);
  const isOpen = (key) => showAllGroups || openGroup === key;
  const toggleGroup = (key) => {
    setOpenGroup(isOpen(key) && !showAllGroups ? null : key);
    setShowAllGroups(false);
  };
  // A failed save must not leave its message inside a collapsed group: open them all.
  const errorKey = Object.keys(errors).filter((key) => errors[key]).sort().join(",");
  const [seenErrors, setSeenErrors] = useState(errorKey);
  if (errorKey !== seenErrors) {
    setSeenErrors(errorKey);
    if (errorKey) setShowAllGroups(true);
  }
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
  const inspectionNeeded = form.preSiteInspectionRequired === "yes";
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

  // English, or Other with the language typed in. "Other" stays open while it
  // is being typed, so the picker doesn't snap back to English on the first
  // keystroke; any language already on the record reads as Other.
  const [languageOther, setLanguageOther] = useState(false);
  const languageIsOther = languageOther || !isBlank(form.preferredLanguage);

  // Each attempt is typed straight into the lead. There is no draft to commit:
  // filling the boxes is logging the attempt, and anything half-typed is saved
  // with the lead like every other field rather than lost on the way out.
  const contactAttempts = form.contactAttempts || [];
  const blankAttempt = () => ({ method: "", contactedAt: "", reached: true, reason: "", notes: "" });
  const setAttempt = (i, key, value) =>
    set(
      "contactAttempts",
      contactAttempts.map((a, n) => (n === i ? { ...a, [key]: value } : a)),
    );
  const addContactAttempt = () => set("contactAttempts", [...contactAttempts, blankAttempt()]);
  const removeContactAttempt = (i) => set("contactAttempts", contactAttempts.filter((_, idx) => idx !== i));
  /** An attempt counts once it says how and when; the rest is detail. */
  const attemptLogged = (a) => !isBlank(a?.method) && !isBlank(a?.contactedAt);
  const loggedAttempts = contactAttempts.filter(attemptLogged);

  // One boolean per mandatory row — the single source of truth for both the
  // row ticks and the "Potential" gate/progress bar below.
  // Answered "no", or answered "yes" and backed up with a logged attempt.
  // An unanswered question is never complete.
  const doneContact =
    form.needsClientContact === "no" || (form.needsClientContact === "yes" && loggedAttempts.length > 0);
  const doneName = !isBlank(form.customerFirstName) && !isBlank(form.customerLastName);
  const doneAddress = !isBlank(form.siteLine1) && !isBlank(form.siteSuburb) && !isBlank(form.sitePostcode);
  const siteAddressLine = [form.siteLine1, form.siteSuburb, `${form.siteState || ""} ${form.sitePostcode || ""}`.trim()]
    .filter((part) => !isBlank(part))
    .join(", ");
  const serviceKeys = serviceRequirementKeys(form.serviceRequirement);
  const doneService = serviceKeys.length > 0 && (!serviceKeys.includes("other") || !isBlank(form.serviceRequirementOther));
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
  const doneFinance = !isBlank(form.financeAssistance);
  const doneSiteRequirements = form.siteRequirementsNone || !isBlank(form.siteSpecificRequirements);
  const doneTimeframe = !isBlank(form.preferredInstallTimeframe);
  const doneLocation = !isBlank(form.preferredInstallLocation);
  const doneComments = !isBlank(form.customerComments);
  const doneIntent = Boolean(form.customerIntentConfirmed);
  const doneSource = !isBlank(form.leadSource);
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
    { label: "Lead Source", done: doneSource },
    { label: "Initial requirements & comments", done: doneComments },
    { label: "Contact client", done: doneContact },
    { label: "Genuine interest", done: doneIntent },
    { label: "Customer details", done: doneCustomer, missing: customerMissing },
    { label: "Service requirement", done: doneService },
    { label: "Billing address", done: doneBilling },
    { label: "Building type", done: doneStoreys },
    { label: "Roof type", done: doneRoof },
    { label: "Electrical phase", done: donePhase },
    { label: "Electricity bills", done: doneBills },
    { label: "Finance assistance", done: doneFinance },
    { label: "Site Specific Requirements & Additional Costs", done: doneSiteRequirements },
    { label: "Preferred timeframe", done: doneTimeframe },
    { label: "Preferred Installation Location", done: doneLocation },
  ];
  // Everything the Potential gate needs, wherever it is asked.
  const outstanding = requiredRows.filter((r) => !r.done);
  const checklistComplete = outstanding.length === 0;
  // Where they got our details, genuine interest and the contact question are
  // asked on the Customer details tab; the Checklist tab counts its own rows.
  const CUSTOMER_TAB_ROWS = ["Lead Source", "Genuine interest", "Contact client", "Initial requirements & comments"];
  const checklistRows = requiredRows.filter((r) => !CUSTOMER_TAB_ROWS.includes(r.label));
  const checklistOutstanding = checklistRows.filter((r) => !r.done);
  const doneCount = checklistRows.length - checklistOutstanding.length;
  // What the open tab still needs before moving on to the next one.
  const tabBlockers =
    activeTab === "customer"
      ? [...customerMissing, ...outstanding.filter((r) => CUSTOMER_TAB_ROWS.includes(r.label)).map((r) => r.label)].join(", ")
      : activeTab === "checklist"
        ? checklistOutstanding.map((r) => r.label).join(", ")
        : "";
  useEffect(() => {
    onTabBlockersChange?.(tabBlockers);
  }, [tabBlockers, onTabBlockersChange]);
  const readyToProceed =
    activeTab === "decision" && checklistComplete && form.potential === "yes" && !isBlank(form.estimatorId);
  useEffect(() => {
    onReadyToProceedChange?.(readyToProceed);
  }, [readyToProceed, onReadyToProceedChange]);

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
                  count: `${doneCount}/${checklistRows.length}`,
                },
                { key: "decision", label: "Assign to Estimator", icon: <Check size={14} /> },
              ]
            : []),
          ...(requestsPanel
            ? [{ key: "requests", label: "Request / Response", icon: <HandHelping size={14} /> }]
            : []),
        ]}
        value={activeTab}
        onChange={(next) => {
          if (next !== activeTab) onTabChange?.(activeTab, next);
          setTab(next);
        }}
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
            <Field label="Lead Type" className="span-2" required error={err("leadType")}>
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
                <Field label="Business name" required error={err("customerLegalName")}>
                  {input("customerLegalName")}
                </Field>
                <Field label="ABN" hint="commercial leads only">
                  {input("customerAbn")}
                </Field>
              </>
            ) : null}

            <Field label="First name" required error={err("customerFirstName")}>
              {input("customerFirstName", { autoComplete: "given-name" })}
            </Field>
            <Field label="Last name" required error={err("customerLastName")}>
              {input("customerLastName", { autoComplete: "family-name" })}
            </Field>

            <Field label="Phone" required hint="Phone or Email" error={err("customerPhone")}>
              {input("customerPhone")}
            </Field>
            <Field label="Email" required hint="Phone or Email" error={err("customerEmail")}>
              {input("customerEmail", { type: "email" })}
            </Field>

            <Field label="Site address" className="span-2" required error={err("siteLine1")}>
              {input("siteLine1", { placeholder: "Street" })}
            </Field>
            <Field label="Suburb" required error={err("siteSuburb")}>{input("siteSuburb", { placeholder: "Suburb" })}</Field>
            <div className="form-grid" style={{ gap: 12 }}>
              <Field label="State">
                <select value={form.siteState} disabled={disabled} onChange={(e) => set("siteState", e.target.value)}>
                  {AU_STATES.map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </Field>
              <Field label="Postcode" required error={err("sitePostcode")}>
                {input("sitePostcode", { placeholder: "Postcode", inputMode: "numeric", maxLength: 4 })}
              </Field>
            </div>

            <div>
              <Field label="Preferred Language">
                <select
                  value={languageIsOther ? "__other" : ""}
                  disabled={disabled}
                  onChange={(e) => {
                    const other = e.target.value === "__other";
                    setLanguageOther(other);
                    set("preferredLanguage", "");
                  }}
                >
                  <option value="">{DEFAULT_LANGUAGE}</option>
                  <option value="__other">Other</option>
                </select>
              </Field>
              {languageIsOther ? (
                <div style={{ marginTop: 10 }}>
                  <Field label="Language">
                    {input("preferredLanguage", { placeholder: "Type the language", autoFocus: languageOther })}
                  </Field>
                </div>
              ) : null}
            </div>
          </div>

          {/* Asked on the first call with the customer, so they sit with the
              customer's details rather than in the checklist. */}
          <div className="checklist" style={{ marginTop: 20 }}>
            <GroupHead title="Contact & interest" />
              <ChecklistRow done={doneSource} label="Lead Source" required>
                <Field hint="feeds the referral reward program" error={err("leadSource")}>
                  {automated ? (
                    <input value={leadSourceLabel(form.leadSource)} disabled />
                  ) : (
                    <select value={form.leadSource} disabled={disabled} onChange={(e) => set("leadSource", e.target.value)}>
                      <option value="">Select lead source</option>
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
                    <Field
                      label="Referrer"
                      required
                      error={err("referrerId")}
                      hint={form.referrerId ? "registered referrer - counts towards the referral program" : "type a name, or pick a registered referrer"}
                    >
                      {/* Free text, with the registered referrers offered as you
                          type. A name that matches one links the lead to it. */}
                      <input
                        list="lf-referrers"
                        value={form.referrerName}
                        disabled={disabled}
                        maxLength={200}
                        placeholder="Who referred this lead"
                        onChange={(e) => {
                          const typed = e.target.value;
                          const match = referrers.find((r) => r.organisation?.trim().toLowerCase() === typed.trim().toLowerCase());
                          set("referrerName", typed);
                          set("referrerId", match ? String(match.id) : "");
                        }}
                      />
                      <datalist id="lf-referrers">
                        {referrers.map((r) => (
                          <option key={r.id} value={r.organisation} />
                        ))}
                      </datalist>
                    </Field>
                    <Field label="Involvement tier">
                      <select
                        value={form.involvementTier}
                        disabled={disabled}
                        onChange={(e) => set("involvementTier", e.target.value)}
                      >
                        <option value="none">None</option>
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

              <ChecklistRow done={doneContact} label="Have you contacted the client?" required>
                <p className="lede" style={{ margin: "0 0 10px" }}>
                  Did you have to contact the client to collect the mandatory details?
                </p>
                <ChoiceGroup
                  name="lf-contact"
                  options={CONTACT_OPTIONS}
                  value={form.needsClientContact}
                  disabled={disabled}
                  error={err("needsClientContact")}
                  onChange={(v) => {
                    set("needsClientContact", v);
                    // Straight into the first attempt rather than an empty panel.
                    if (v === "yes" && !contactAttempts.length) set("contactAttempts", [blankAttempt()]);
                  }}
                />
                {form.needsClientContact === "yes" ? (
                  <div style={{ marginTop: 12 }}>
                    {err("contactAttempts") ? (
                      <p className="field-error" style={{ marginBottom: 8 }}>
                        {err("contactAttempts")}
                      </p>
                    ) : null}

                    {contactAttempts.map((a, i) => (
                      <div key={i} className="attempt">
                        <div className="attempt-head">
                          <span className={`status-icon ${a.reached === false ? "failed" : "done"}`}>
                            <PhoneCall size={14} />
                          </span>
                          <span className="row-title">Attempt {i + 1}</span>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={disabled}
                            onClick={() => removeContactAttempt(i)}
                            aria-label={`Remove attempt ${i + 1}`}
                          >
                            <X size={14} />
                          </button>
                        </div>
                        <div className="form-grid">
                          <Field label="How you tried" required>
                            <input
                              value={a.method || ""}
                              disabled={disabled}
                              placeholder="e.g. Phone call, email"
                              onChange={(e) => setAttempt(i, "method", e.target.value)}
                            />
                          </Field>
                          <Field
                            label="When"
                            required
                            error={
                              minDate && a.contactedAt && String(a.contactedAt).slice(0, 10) < minDate
                                ? "Can't be before the lead was created"
                                : undefined
                            }
                          >
                            <input
                              type="date"
                              min={minDate || undefined}
                              value={a.contactedAt || ""}
                              disabled={disabled}
                              onChange={(e) => setAttempt(i, "contactedAt", e.target.value)}
                            />
                          </Field>
                        </div>
                        <label className="check" style={{ marginTop: 10 }}>
                          <input
                            type="checkbox"
                            checked={a.reached !== false}
                            disabled={disabled}
                            onChange={(e) => setAttempt(i, "reached", e.target.checked)}
                          />
                          Client was reached
                        </label>
                        {a.reached === false ? (
                          <Field label="Reason not reached" required>
                            <textarea
                              rows={2}
                              value={a.reason || ""}
                              disabled={disabled}
                              placeholder="e.g. No answer, voicemail left"
                              onChange={(e) => setAttempt(i, "reason", e.target.value)}
                            />
                          </Field>
                        ) : null}
                        <Field label="Notes" hint="what was discussed on this attempt">
                          <textarea
                            rows={2}
                            value={a.notes || ""}
                            disabled={disabled}
                            onChange={(e) => setAttempt(i, "notes", e.target.value)}
                          />
                        </Field>
                      </div>
                    ))}

                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      disabled={disabled}
                      onClick={addContactAttempt}
                    >
                      <Plus size={14} /> Add attempt
                    </button>
                    <p className="lede" style={{ margin: "8px 0 0" }}>
                      No response yet? Add another - every attempt is kept.
                    </p>
                  </div>
                ) : null}
              </ChecklistRow>

              <ChecklistRow done={doneIntent} label="Genuine interest" required>
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

              <ChecklistRow done={doneComments} label="Initial requirements & comments" required>
                <Field
                  hint="what they want from the system, anything else they asked for, financial options discussed"
                  error={err("customerComments")}
                >
                  {textarea("customerComments", { rows: 3, placeholder: "Initial customer requirements and comments" })}
                </Field>
              </ChecklistRow>

          </div>

          {/* Assigned once the contact and interest are known. */}
          <div className="form-grid" style={{ marginTop: 20 }}>
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
              <Field label="Reason no salesperson is assigned yet" className="span-2" required error={err("unassignedReason")}>
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
            Fields marked * are required before this lead can move forward. Optional fields are passed to the
            estimator, so add any details you have.
          </p>
            <div className="checklist-progress">
              <span className="cp-label">
                {doneCount} of {checklistRows.length} complete
              </span>
              <div className="cp-track">
                <i style={{ width: `${(doneCount / checklistRows.length) * 100}%` }} />
              </div>
            </div>

              <div className="checklist" style={{ marginBottom: 20 }}>
              <GroupHead
                title="Mandatory information"
                count={`${doneCount}/${checklistRows.length}`}
                open={isOpen("mandatory")}
                onToggle={() => toggleGroup("mandatory")}
              />
              {isOpen("mandatory") ? (
              <>
              {/* Name, phone and email are captured once, at the top of the form —
                  this row only confirms them, it never asks again. */}
              <ChecklistRow done={doneCustomer} label="Customer details" required>
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

              <ChecklistRow done={doneService} label="Job Requirement" required>
                <Field error={err("serviceRequirement")}>
                  <div className="choice-grid">
                    {SERVICE_REQUIREMENTS.map((o) => (
                      <label key={o.key} className="choice">
                        <input
                          type="checkbox"
                          checked={serviceKeys.includes(o.key)}
                          disabled={disabled}
                          onChange={(e) => {
                            const next = e.target.checked ? [...serviceKeys, o.key] : serviceKeys.filter((key) => key !== o.key);
                            set("serviceRequirement", SERVICE_REQUIREMENTS.map((x) => x.key).filter((key) => next.includes(key)).join(","));
                          }}
                        />
                        <span>{o.label}</span>
                      </label>
                    ))}
                  </div>
                </Field>
                {serviceKeys.includes("other") ? (
                  <div style={{ marginTop: 10 }}>
                    <Field label="Service required" required error={err("serviceRequirementOther")}>
                      {input("serviceRequirementOther", { placeholder: "e.g. Solar hot water, heat pump", maxLength: 120 })}
                    </Field>
                  </div>
                ) : null}
              </ChecklistRow>

              {/* The site address is captured above — only billing is asked here. */}
              <ChecklistRow done={doneBilling} label="Billing address" required>
                <p className="lede" style={{ margin: "0 0 10px" }}>
                  Is the billing address the same as the site address?
                </p>
                <ChoiceGroup
                  name="lf-billing"
                  options={BILLING_OPTIONS}
                  value={form.billingSameAsSite}
                  disabled={disabled}
                  error={err("billingSameAsSite")}
                  onChange={(v) => set("billingSameAsSite", v)}
                />
                {form.billingSameAsSite === "no" ? (
                  <div style={{ marginTop: 10 }}>
                    <Field label="Billing address" required error={err("customerBillingAddress")}>
                      {input("customerBillingAddress", { placeholder: "Street, suburb, state and postcode" })}
                    </Field>
                  </div>
                ) : null}
              </ChecklistRow>

              <ChecklistRow done={!isBlank(form.siteMapUrl)} label="Site access">
                <div className="form-grid">
                  <Field label="Map location" className="span-2" error={err("siteMapUrl")}>
                    {input("siteMapUrl", { placeholder: "Paste a Google Maps link" })}
                  </Field>
                  <Field label="Site contact" hint="Provide contact details if someone else will meet us on site.">
                    {input("siteContact", { placeholder: "Name and number" })}
                  </Field>
                  <Field label="Access notes" hint="gate codes, parking, hours">
                    {input("siteAccessNotes")}
                  </Field>
                </div>
              </ChecklistRow>

            <ChecklistRow done={doneStoreys} label="Building type" required>
                <ChoiceGroup
                  name="lf-storeys"
                  options={STOREY_OPTIONS}
                  value={form.propertyStoreys}
                  disabled={disabled}
                  error={err("propertyStoreys")}
                  onChange={(v) => set("propertyStoreys", v)}
                />
                {business ? (
                  <div style={{ marginTop: 10 }}>
                    <Field label="Building Details" hint="optional">
                      {input("buildingTypeDetails", { placeholder: "e.g. Warehouse, Shopping Complex" })}
                    </Field>
                  </div>
                ) : null}
              </ChecklistRow>

              <ChecklistRow done={doneRoof} label="Roof type" required>
                <ChoiceGroup
                  name="lf-roof"
                  options={ROOF_TYPES}
                  value={form.roofType}
                  disabled={disabled}
                  error={err("roofType")}
                  onChange={(v) => set("roofType", v)}
                />
              </ChecklistRow>

              <ChecklistRow done={donePhase} label="Electrical phase" required>
                <ChoiceGroup
                  name="lf-phase"
                  options={ELECTRICAL_PHASES}
                  value={form.electricalPhase}
                  disabled={disabled}
                  error={err("electricalPhase")}
                  onChange={(v) => set("electricalPhase", v)}
                />
              </ChecklistRow>

              <ChecklistRow done={doneBills} label="Electricity bills" required>
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

              <ChecklistRow done={doneFinance} label="Finance Assistance Required?" required>
                <ChoiceGroup
                  name="lf-finance"
                  options={FINANCE_OPTIONS}
                  value={form.financeAssistance}
                  disabled={disabled}
                  error={err("financeAssistance")}
                  onChange={(v) => set("financeAssistance", v)}
                />
              </ChecklistRow>

              <ChecklistRow done={doneSiteRequirements} label="Site Specific Requirements & Additional Costs" required>
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

              <ChecklistRow done={doneTimeframe} label="Expected Job Completion Timeframe" required>
                <Field error={err("preferredInstallTimeframe")}>
                  <select
                    value={form.preferredInstallTimeframe}
                    disabled={disabled}
                    onChange={(e) => set("preferredInstallTimeframe", e.target.value)}
                  >
                    <option value="">Select a timeframe</option>
                    {[
                      ...INSTALL_TIMEFRAMES,
                      // A lead saved under the old month-based list keeps its answer.
                      ...LEGACY_INSTALL_TIMEFRAMES.filter((t) => t.key === form.preferredInstallTimeframe),
                    ].map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </ChecklistRow>

              <ChecklistRow done={doneLocation} label="Preferred Installation Location" required>
                <Field hint="where on site the system goes" error={err("preferredInstallLocation")}>
                  {input("preferredInstallLocation", { placeholder: "e.g. north-facing roof, garage wall for the battery" })}
                </Field>
              </ChecklistRow>

              <ChecklistRow done={doneOffers} label="Business offers & budget">
                <div className="form-grid">
                  <Field label="Offers made" className="span-2" hint="promotions or pricing the customer was offered - leave blank if none">
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
              </>
              ) : null}

              </div>
            <div className="checklist" style={{ marginBottom: 20 }}>
              {/* ---- What estimation needs before BOQ preparation ---- */}

              <GroupHead title="Site & Inspection" open={isOpen("site")} onToggle={() => toggleGroup("site")} />
              {isOpen("site") ? (
              <>

                <ChecklistRow done={!isBlank(form.preSiteInspectionRequired)} label="Pre-Site Inspection Required?">
                <Field>{yesNo("preSiteInspectionRequired")}</Field>
                {inspectionNeeded ? (
                  <p className="lede" style={{ margin: "10px 0 0" }}>
                    Estimation raises the request and tracks the visit.
                  </p>
                ) : null}
              </ChecklistRow>

              {/* Site visit completed and site photos are only asked when no
                  pre-site inspection is required — when one is, the inspection
                  request brings the visit and its photos back. */}
              {!inspectionNeeded ? (
              <>
              {isBlank(form.preSiteInspectionRequired) ? (
                <ChecklistRow done={Boolean(form.siteVisitCompleted)} label="Site visit completed">
                  {checkbox("siteVisitCompleted", "Site visit completed")}
                </ChecklistRow>
              ) : null}

              {/* Optional, like every other estimation-input row: tick it when the
                  photos are already on file, or attach them here. */}
              <ChecklistRow
                done={sitePhotos.length > 0 || Boolean(form.sitePhotosOnFile)}
                label="Site photos"
              >
                <div style={{ marginBottom: 10 }}>
                  {checkbox("sitePhotosOnFile", "Site photos available on file")}
                </div>
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
              </ChecklistRow>
              </>
              ) : null}

              </>
              ) : null}

              <GroupHead title={TECHNICAL_GROUP} open={isOpen("technical")} onToggle={() => toggleGroup("technical")} />
              {isOpen("technical") ? (
              <>

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
                label="Mounting, Cabling & Other Site Constraints"
              >
                <div className="form-grid">
                  <Field label="Roof & Mounting Details" className="span-2" hint="Record roof type, mounting system (flush or tilt), rail type and any structural concerns">
                    {textarea("mountingRequirements")}
                  </Field>
                  <Field label="Cable Run & Conduit Requirements" className="span-2" hint="Note cable run lengths, any underground or external runs, and whether conduit or trunking is needed.">{textarea("cableRequirements")}</Field>
                  <Field label="Shading, Orientation & Site Constraints" className="span-2">{textarea("siteConstraints")}</Field>
                </div>
              </ChecklistRow>

              </>
              ) : null}

              <GroupHead title="Installation, Permits & Utility" open={isOpen("installation")} onToggle={() => toggleGroup("installation")} />
              {isOpen("installation") ? (
              <>

              <ChecklistRow
                done={!isBlank(form.specialRequirements)}
                label="Special installation requirements"
              >
                <Field label="Special requirements" hint="crane, scaffold, after-hours">
                  {textarea("specialRequirements")}
                </Field>
              </ChecklistRow>

              {/* Permits and approvals are the estimator's call, not a customer
                  conversation — they live in the estimation module. */}
              <ChecklistRow done={!isBlank(form.vppEligibility)} label="VPP requirements">
                {checkbox("vppDiscussed", "VPP requirements discussed with the customer, if applicable")}
                <div className="form-grid" style={{ marginTop: 10 }}>
                  <Field label="VPP incentive / eligibility">{selectField("vppEligibility", VPP_OPTIONS, "Select eligibility")}</Field>
                  <Field label="VPP requirements" hint="retailer, program">{input("vppNotes")}</Field>
                </div>
              </ChecklistRow>

              <ChecklistRow done={!isBlank(form.meterRequirements)} label="Utility & meter">
                <Field label="Utility or meter requirements" hint="NMI, meter change, network limits">
                  {input("meterRequirements")}
                </Field>
              </ChecklistRow>

              <ChecklistRow
                done={drawings.length > 0 || Boolean(form.drawingsOnFile)}
                label="Drawings, layouts & SLD"
              >
                <div style={{ marginBottom: 10 }}>
                  {checkbox("drawingsOnFile", "Drawings available on file")}
                </div>
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
              </ChecklistRow>

              </>
              ) : null}

              <GroupHead title="Customer-Specific Notes" open={isOpen("notes")} onToggle={() => toggleGroup("notes")} />
              {isOpen("notes") ? (
              <ChecklistRow
                done={!isBlank(form.inclusions) || !isBlank(form.exclusions)}
                label="Customer-specific notes"
              >
                <div className="form-grid">
                  <Field
                    label="Any Client Specific Requirements?"
                    className="span-2"
                    hint="optional"
                  >
                    {textarea("clientSpecialRequirements")}
                  </Field>
                  <Field label="Inclusions" hint="what the customer was promised">{textarea("inclusions")}</Field>
                  <Field label="Exclusions" hint="what is not covered">{textarea("exclusions")}</Field>
                </div>
              </ChecklistRow>
              ) : null}

            </div>
        </div>
      ) : null}

      {activeTab === "decision" ? (
        <div className="section" id="lf-decision">
            <div className="decision-card">
              <SectionHead icon={<Check size={13} />} title="Assign to Estimator" />
              {!checklistComplete ? (
                <div className="alert warning" style={{ marginBottom: 12 }}>
                  Complete the checklist before assigning an estimator - Estimation needs all of it. Still open:
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
              {/* No Potential / Not potential buttons: assigning the estimator is
                  what marks the lead Potential (qualified); clearing it undoes that. */}
              <div style={{ maxWidth: 320 }}>
                <Field label="Assign estimator" error={err("estimatorId")}>
                  <select
                    value={form.estimatorId}
                    disabled={disabled || !checklistComplete}
                    onChange={(e) => {
                      set("estimatorId", e.target.value);
                      set("potential", e.target.value ? "yes" : "");
                    }}
                  >
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
            </div>

            <div className="decision-card">
              <SectionHead icon={<ClipboardCheck size={13} />} title="Additional information" />
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
                <Plus size={14} /> Add item
              </button>
            </div>

            <div className="decision-card">
              <SectionHead icon={<ClipboardCheck size={13} />} title="Note for the estimator" />
              <Field hint="optional - anything estimation should know before they pick this up">
                {textarea("noteForEstimator", { rows: 2 })}
              </Field>
            </div>

        </div>
      ) : null}
    </>
  );
}