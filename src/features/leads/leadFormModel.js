// Lead form model: empty form, opportunity → form, form → API payload, and
// validation. Field names match prestige-be's opportunity LEAD_FIELDS.
//
// `qualification` has no direct UI control any more — it's derived from the
// Potential client? decision (see LeadForm): "yes" -> qualified, "no" ->
// disqualified, undecided -> nurture. This keeps leadGateItems/advanceState
// (stageTransition.js) and the qualification badges elsewhere working
// unchanged.

import { isBlank, isEmail } from "@/utils/validators";
import { emptyEstimationInput, estimationInputFromOpp } from "@/constants/estimationInput";
import { isBusinessLead, MANUAL_LEAD_SOURCES } from "./leadSourceOptions";

// The estimation-input rows (pre-site inspection through customer-specific
// notes) are optional parts of the lead checklist. They are held flat on the
// form and nested back under `estimationInput` when the lead is saved, so the
// estimator's review screen keeps reading one object.
const ESTIMATION_INPUT_KEYS = Object.keys(emptyEstimationInput());
const pickEstimationInput = (form) =>
  Object.fromEntries(ESTIMATION_INPUT_KEYS.map((key) => [key, form[key]]));

const MANUAL_SOURCE_KEYS = MANUAL_LEAD_SOURCES.map((s) => s.key);

export function emptyLeadForm() {
  return {
    ...emptyEstimationInput(),
    leadType: "",
    customerLegalName: "",
    customerTradingName: "",
    customerAbn: "",
    customerFirstName: "",
    customerLastName: "",
    customerEmail: "",
    customerPhone: "",
    // Asked in the checklist only when billing differs from the site address.
    billingSameAsSite: "",
    customerBillingAddress: "",
    // Blank means English; anything else is what the customer prefers.
    preferredLanguage: "",
    siteLine1: "",
    siteSuburb: "",
    siteState: "NSW",
    sitePostcode: "",
    siteJurisdiction: "NSW",
    siteContact: "",
    siteAccessNotes: "",
    siteMapUrl: "",
    qualification: "nurture",
    // "" until someone answers it — an unanswered question is not a "no".
    needsClientContact: "",
    contactAttempts: [],
    serviceRequirement: "",
    propertyStoreys: "",
    roofType: "",
    electricalPhase: "",
    energyAnnualKwh: "",
    energyHasBills: false,
    financeAssistance: "",
    financeNotes: "",
    siteRequirementsNone: false,
    siteSpecificRequirements: "",
    preferredInstallTimeframe: "",
    preferredInstallLocation: "",
    customerIntentConfirmed: false,
    customerComments: "",
    businessOffers: "",
    customerBudget: "",
    leadSource: "internal",
    leadSourceDetails: "",
    referrerId: "",
    involvementTier: "lead_only",
    hasOwnerDiscount: false,
    ownerDiscountName: "",
    ownerDiscountAmount: "",
    estimatorId: "",
    salespersonId: "",
    unassignedReason: "",
    customFields: [],
    potential: "",
    notPotentialReason: "",
  };
}

const str = (v) => (v === null || v === undefined ? "" : String(v));

/**
 * First and last name are captured separately. Records taken before they were
 * split keep the whole name in customerLegalName — for a person that is
 * "Jane Marie Smith", so everything but the final word is the first name. A
 * business name is never split.
 */
function personName(opp) {
  if (opp.customerFirstName || opp.customerLastName)
    return { first: str(opp.customerFirstName), last: str(opp.customerLastName) };
  if (isBusinessLead(opp.leadType)) return { first: "", last: "" };
  const parts = str(opp.customerLegalName).trim().split(/\s+/).filter(Boolean);
  if (parts.length < 2) return { first: parts[0] || "", last: "" };
  return { first: parts.slice(0, -1).join(" "), last: parts[parts.length - 1] };
}

export function leadToForm(opp) {
  const base = emptyLeadForm();
  if (!opp) return base;
  const name = personName(opp);
  return {
    ...base,
    ...estimationInputFromOpp(opp),
    leadType: str(opp.leadType),
    customerLegalName: str(opp.customerLegalName),
    customerTradingName: str(opp.customerTradingName),
    customerAbn: str(opp.customerAbn),
    customerFirstName: name.first,
    customerLastName: name.last,
    customerEmail: str(opp.customerEmail),
    customerPhone: str(opp.customerPhone),
    // Older records predate the question: a billing address already on file
    // means it was captured separately from the site.
    billingSameAsSite: str(opp.billingSameAsSite) || (opp.customerBillingAddress ? "no" : ""),
    customerBillingAddress: str(opp.customerBillingAddress),
    preferredLanguage: str(opp.preferredLanguage),
    siteLine1: str(opp.siteLine1),
    siteSuburb: str(opp.siteSuburb),
    siteState: str(opp.siteState) || "NSW",
    sitePostcode: str(opp.sitePostcode),
    siteJurisdiction: str(opp.siteJurisdiction) || str(opp.siteState) || "NSW",
    siteContact: str(opp.siteContact),
    siteAccessNotes: str(opp.siteAccessNotes),
    siteMapUrl: str(opp.siteMapUrl),
    qualification: str(opp.qualification) || "nurture",
    needsClientContact: opp.needsClientContact == null ? "" : opp.needsClientContact ? "yes" : "no",
    contactAttempts: Array.isArray(opp.contactAttempts)
      ? opp.contactAttempts.map((a) => ({
          method: str(a?.method),
          contactedAt: str(a?.contactedAt),
          reached: a?.reached !== false,
          reason: str(a?.reason),
          notes: str(a?.notes),
        }))
      : [],
    serviceRequirement: str(opp.serviceRequirement),
    propertyStoreys: str(opp.propertyStoreys),
    roofType: str(opp.roofType),
    electricalPhase: str(opp.electricalPhase),
    energyAnnualKwh: str(opp.energyAnnualKwh),
    energyHasBills: Boolean(opp.energyHasBills),
    financeAssistance: str(opp.financeAssistance),
    financeNotes: str(opp.financeNotes),
    siteRequirementsNone: Boolean(opp.siteRequirementsNone),
    siteSpecificRequirements: str(opp.siteSpecificRequirements),
    preferredInstallTimeframe: str(opp.preferredInstallTimeframe),
    preferredInstallLocation: str(opp.preferredInstallLocation),
    customerIntentConfirmed: Boolean(opp.customerIntentConfirmed),
    customerComments: str(opp.customerComments),
    businessOffers: str(opp.businessOffers),
    customerBudget: str(opp.customerBudget),
    leadSource: str(opp.leadSource) || "internal",
    leadSourceDetails: str(opp.leadSourceDetails),
    referrerId: str(opp.referrerId),
    involvementTier: str(opp.involvementTier) || "lead_only",
    hasOwnerDiscount: Boolean(opp.hasOwnerDiscount),
    ownerDiscountName: str(opp.ownerDiscountName),
    ownerDiscountAmount: str(opp.ownerDiscountAmount),
    estimatorId: str(opp.estimatorId),
    salespersonId: str(opp.salespersonId),
    unassignedReason: str(opp.unassignedReason),
    customFields: Array.isArray(opp.customFields)
      ? opp.customFields.map((f) => ({ label: str(f?.label), value: str(f?.value) }))
      : [],
    potential: opp.qualification === "qualified" ? "yes" : opp.qualification === "disqualified" ? "no" : "",
    notPotentialReason: str(opp.notPotentialReason),
  };
}

const trim = (v) => String(v ?? "").trim();
/** The customer's name as one string, for records that display a single name. */
/** The site address as one line — what billing uses when it is the same. */
const siteAddress = (form) =>
  [trim(form.siteLine1), trim(form.siteSuburb), `${form.siteState || ""} ${trim(form.sitePostcode)}`.trim()]
    .filter(Boolean)
    .join(", ");
const fullName = (form) => [trim(form.customerFirstName), trim(form.customerLastName)].filter(Boolean).join(" ");
export const idOrNull = (v) => (isBlank(v) ? null : Number(v));
const numberOrNull = (v) => (isBlank(v) ? null : Number(v));

/** True when the source was set by an integration and must not be edited by hand. */
export function isAutomatedSource(source) {
  return Boolean(source) && !MANUAL_SOURCE_KEYS.includes(source);
}

/**
 * PATCH body for the generic lead-pack save. Salesperson/estimator/operational-
 * coordinator assignment are deliberately excluded — those go through their
 * own endpoints (assignSalesperson/assignEstimator/assignCoordinator in
 * leadsApi.js), called separately by LeadPackPanel/NewLeadPage.
 */
export function formToPayload(form) {
  const business = isBusinessLead(form.leadType);
  const payload = {
    leadType: form.leadType,
    // customerLegalName stays the record's display name everywhere else in
    // the app: the business name for a commercial lead, the person's full
    // name for a residential one.
    customerLegalName: business ? trim(form.customerLegalName) : fullName(form),
    customerTradingName: trim(form.customerTradingName),
    customerAbn: business ? trim(form.customerAbn) : "",
    customerFirstName: trim(form.customerFirstName),
    customerLastName: trim(form.customerLastName),
    customerEmail: trim(form.customerEmail),
    customerPhone: trim(form.customerPhone),
    billingSameAsSite: trim(form.billingSameAsSite),
    customerBillingAddress: form.billingSameAsSite === "yes" ? siteAddress(form) : trim(form.customerBillingAddress),
    preferredLanguage: trim(form.preferredLanguage),
    siteLine1: trim(form.siteLine1),
    siteSuburb: trim(form.siteSuburb),
    siteState: form.siteState,
    sitePostcode: trim(form.sitePostcode),
    siteJurisdiction: form.siteJurisdiction || form.siteState,
    siteContact: trim(form.siteContact),
    siteAccessNotes: trim(form.siteAccessNotes),
    siteMapUrl: trim(form.siteMapUrl),
    qualification: form.potential === "yes" ? "qualified" : form.potential === "no" ? "disqualified" : "nurture",
    // null keeps "not answered yet" on the record, so it comes back unanswered.
    needsClientContact: isBlank(form.needsClientContact) ? null : form.needsClientContact === "yes",
    contactAttempts: form.needsClientContact === "yes"
      ? (form.contactAttempts || []).map((a) => ({
          method: trim(a.method),
          contactedAt: a.contactedAt || null,
          reached: a.reached !== false,
          reason: a.reached === false ? trim(a.reason) : "",
          notes: trim(a.notes),
        }))
      : [],
    serviceRequirement: trim(form.serviceRequirement),
    propertyStoreys: trim(form.propertyStoreys),
    roofType: trim(form.roofType),
    electricalPhase: trim(form.electricalPhase),
    energyAnnualKwh: numberOrNull(form.energyAnnualKwh),
    energyHasBills: Boolean(form.energyHasBills),
    financeAssistance: trim(form.financeAssistance),
    financeNotes: form.financeAssistance === "yes" ? trim(form.financeNotes) : "",
    siteRequirementsNone: Boolean(form.siteRequirementsNone),
    siteSpecificRequirements: form.siteRequirementsNone ? "" : trim(form.siteSpecificRequirements),
    preferredInstallTimeframe: form.preferredInstallTimeframe,
    preferredInstallLocation: trim(form.preferredInstallLocation),
    customerIntentConfirmed: Boolean(form.customerIntentConfirmed),
    customerComments: trim(form.customerComments),
    businessOffers: trim(form.businessOffers),
    customerBudget: numberOrNull(form.customerBudget),
    leadSourceDetails: trim(form.leadSourceDetails),
    // Owner discounts moved out of lead capture — passed back untouched so
    // anything already recorded against the job survives a save here.
    hasOwnerDiscount: Boolean(form.hasOwnerDiscount),
    ownerDiscountName: form.hasOwnerDiscount ? trim(form.ownerDiscountName) : "",
    ownerDiscountAmount: form.hasOwnerDiscount ? numberOrNull(form.ownerDiscountAmount) : null,
    customFields: (form.customFields || [])
      .map((f) => ({ label: trim(f.label), value: trim(f.value) }))
      .filter((f) => f.label || f.value),
    potential: form.potential || null,
    notPotentialReason: form.potential === "no" ? trim(form.notPotentialReason) : "",
    estimationInput: pickEstimationInput(form),
  };
  // Automated sources are owned by the integration that set them.
  if (!isAutomatedSource(form.leadSource)) {
    payload.leadSource = form.leadSource;
    payload.referrerId = form.leadSource === "referrer" ? idOrNull(form.referrerId) : null;
    payload.involvementTier = form.leadSource === "referrer" ? form.involvementTier || "lead_only" : null;
  }
  return payload;
}

export function validateLeadForm(form) {
  const errors = {};
  // Type comes first on the form: it decides whether the customer is a
  // business (name + ABN) or a person.
  if (isBlank(form.leadType)) errors.leadType = "Select the type of lead.";
  if (isBusinessLead(form.leadType) && isBlank(form.customerLegalName))
    errors.customerLegalName = "Enter the business name.";
  if (isBlank(form.customerFirstName)) errors.customerFirstName = "Enter the first name.";
  if (isBlank(form.customerLastName)) errors.customerLastName = "Enter the last name.";
  if (!isBlank(form.customerEmail) && !isEmail(form.customerEmail)) errors.customerEmail = "Enter a valid customer email.";
  if (isBlank(form.customerPhone) && isBlank(form.customerEmail)) {
    errors.customerPhone = "Enter a phone number or email.";
    if (!errors.customerEmail) errors.customerEmail = "Enter a phone number or email.";
  }
  if (isBlank(form.salespersonId) && isBlank(form.unassignedReason))
    errors.unassignedReason = "Enter the reason no salesperson is assigned yet.";

  // Everything below has a visible field only once a salesperson is set
  // (that's what unlocks the Mandatory checklist in LeadForm) — never
  // require something the user can't see or fill in.
  if (isBlank(form.salespersonId)) return errors;

  if (!isBlank(form.energyAnnualKwh) && Number(form.energyAnnualKwh) < 0) errors.energyAnnualKwh = "Usage cannot be negative.";
  if (form.billingSameAsSite === "no" && isBlank(form.customerBillingAddress))
    errors.customerBillingAddress = "Enter the billing address.";
  if (form.financeAssistance === "yes" && isBlank(form.financeNotes))
    errors.financeNotes = "Record what finance assistance the customer needs.";
  if (!form.leadSource) errors.leadSource = "Select a lead source.";
  if (form.leadSource === "referrer" && isBlank(form.referrerId))
    errors.referrerId = "Select the referrer who introduced this lead.";
  if (form.needsClientContact === "yes" && !(form.contactAttempts || []).length)
    errors.contactAttempts = "Log at least one contact attempt.";
  if ((form.contactAttempts || []).some((a) => a.reached === false && isBlank(a.reason)))
    errors.contactAttempts = "Enter a reason for every attempt where the client wasn't reached.";
  if (!isBlank(form.customerBudget) && Number(form.customerBudget) < 0)
    errors.customerBudget = "A budget cannot be negative.";
  if (form.potential === "no" && isBlank(form.notPotentialReason))
    errors.notPotentialReason = "Enter the reason this isn't a potential client.";
  // A lead is only "Potential" once Estimation has everything it needs — the
  // checklist above gates the decision, and these back it up on save.
  if (form.potential === "yes") {
    if (isBlank(form.estimatorId)) errors.estimatorId = "Assign an estimator for this potential client.";
    if (isBlank(form.needsClientContact))
      errors.needsClientContact = "Confirm whether the client had to be contacted for the mandatory details.";
    if (isBlank(form.serviceRequirement)) errors.serviceRequirement = "Record whether they want solar, battery or both.";
    if (isBlank(form.billingSameAsSite))
      errors.billingSameAsSite = "Confirm whether the site address is the billing address.";
    if (isBlank(form.customerComments)) errors.customerComments = "Record the initial customer requirements and comments.";
    if (isBlank(form.propertyStoreys)) errors.propertyStoreys = "Confirm whether the house is single or double storey.";
    if (isBlank(form.roofType)) errors.roofType = "Confirm the roof type.";
    if (isBlank(form.electricalPhase)) errors.electricalPhase = "Confirm the electrical phase.";
    if (isBlank(form.financeAssistance))
      errors.financeAssistance = "Record whether the customer needs finance assistance.";
    if (!form.siteRequirementsNone && isBlank(form.siteSpecificRequirements))
      errors.siteSpecificRequirements = "Record any site-specific requirements, or tick that there are none.";
    if (isBlank(form.preferredInstallTimeframe))
      errors.preferredInstallTimeframe = "Confirm the preferred installation timeframe.";
    if (isBlank(form.preferredInstallLocation))
      errors.preferredInstallLocation = "Confirm the preferred installation location.";
    if (!form.customerIntentConfirmed)
      errors.customerIntentConfirmed = "Confirm the customer is genuinely interested in proceeding.";
  }
  return errors;
}
