// Lead form model: empty form, opportunity → form, form → API payload, and
// validation. Field names match prestige-be's opportunity LEAD_FIELDS.
//
// `qualification` has no direct UI control any more — it's derived from the
// Potential client? decision (see LeadForm): "yes" -> qualified, "no" ->
// disqualified, undecided -> nurture. This keeps leadGateItems/advanceState
// (stageTransition.js) and the qualification badges elsewhere working
// unchanged.

import { isBlank, isEmail } from "@/utils/validators";
import { MANUAL_LEAD_SOURCES } from "./leadSourceOptions";

const MANUAL_SOURCE_KEYS = MANUAL_LEAD_SOURCES.map((s) => s.key);

export function emptyLeadForm() {
  return {
    customerLegalName: "",
    customerTradingName: "",
    customerAbn: "",
    customerEmail: "",
    customerPhone: "",
    customerBillingAddress: "",
    siteLine1: "",
    siteSuburb: "",
    siteState: "NSW",
    sitePostcode: "",
    siteJurisdiction: "NSW",
    siteContact: "",
    siteAccessNotes: "",
    siteMapUrl: "",
    qualification: "nurture",
    leadType: "",
    needsClientContact: false,
    contactAttempts: [],
    energyAnnualKwh: "",
    energyHasBills: false,
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
    needsClientVisit: false,
    clientVisitReason: "",
    operationalCoordinatorId: "",
    customFields: [],
    potential: "",
    notPotentialReason: "",
  };
}

const str = (v) => (v === null || v === undefined ? "" : String(v));

export function leadToForm(opp) {
  const base = emptyLeadForm();
  if (!opp) return base;
  return {
    ...base,
    customerLegalName: str(opp.customerLegalName),
    customerTradingName: str(opp.customerTradingName),
    customerAbn: str(opp.customerAbn),
    customerEmail: str(opp.customerEmail),
    customerPhone: str(opp.customerPhone),
    customerBillingAddress: str(opp.customerBillingAddress),
    siteLine1: str(opp.siteLine1),
    siteSuburb: str(opp.siteSuburb),
    siteState: str(opp.siteState) || "NSW",
    sitePostcode: str(opp.sitePostcode),
    siteJurisdiction: str(opp.siteJurisdiction) || str(opp.siteState) || "NSW",
    siteContact: str(opp.siteContact),
    siteAccessNotes: str(opp.siteAccessNotes),
    siteMapUrl: str(opp.siteMapUrl),
    qualification: str(opp.qualification) || "nurture",
    leadType: str(opp.leadType),
    needsClientContact: Boolean(opp.needsClientContact),
    contactAttempts: Array.isArray(opp.contactAttempts)
      ? opp.contactAttempts.map((a) => ({
          method: str(a?.method),
          contactedAt: str(a?.contactedAt),
          reached: a?.reached !== false,
          reason: str(a?.reason),
        }))
      : [],
    energyAnnualKwh: str(opp.energyAnnualKwh),
    energyHasBills: Boolean(opp.energyHasBills),
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
    needsClientVisit: Boolean(opp.needsClientVisit),
    clientVisitReason: str(opp.clientVisitReason),
    operationalCoordinatorId: str(opp.operationalCoordinatorId),
    customFields: Array.isArray(opp.customFields)
      ? opp.customFields.map((f) => ({ label: str(f?.label), value: str(f?.value) }))
      : [],
    potential: opp.qualification === "qualified" ? "yes" : opp.qualification === "disqualified" ? "no" : "",
    notPotentialReason: str(opp.notPotentialReason),
  };
}

const trim = (v) => String(v ?? "").trim();
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
  const payload = {
    customerLegalName: trim(form.customerLegalName),
    customerTradingName: trim(form.customerTradingName),
    customerAbn: trim(form.customerAbn),
    customerEmail: trim(form.customerEmail),
    customerPhone: trim(form.customerPhone),
    customerBillingAddress: trim(form.customerBillingAddress),
    siteLine1: trim(form.siteLine1),
    siteSuburb: trim(form.siteSuburb),
    siteState: form.siteState,
    sitePostcode: trim(form.sitePostcode),
    siteJurisdiction: form.siteJurisdiction || form.siteState,
    siteContact: trim(form.siteContact),
    siteAccessNotes: trim(form.siteAccessNotes),
    siteMapUrl: trim(form.siteMapUrl),
    qualification: form.potential === "yes" ? "qualified" : form.potential === "no" ? "disqualified" : "nurture",
    leadType: form.leadType,
    needsClientContact: Boolean(form.needsClientContact),
    contactAttempts: form.needsClientContact
      ? (form.contactAttempts || []).map((a) => ({
          method: trim(a.method),
          contactedAt: a.contactedAt || null,
          reached: a.reached !== false,
          reason: a.reached === false ? trim(a.reason) : "",
        }))
      : [],
    energyAnnualKwh: numberOrNull(form.energyAnnualKwh),
    energyHasBills: Boolean(form.energyHasBills),
    leadSourceDetails: trim(form.leadSourceDetails),
    hasOwnerDiscount: Boolean(form.hasOwnerDiscount),
    ownerDiscountName: form.hasOwnerDiscount ? trim(form.ownerDiscountName) : "",
    ownerDiscountAmount: form.hasOwnerDiscount ? numberOrNull(form.ownerDiscountAmount) : null,
    needsClientVisit: Boolean(form.needsClientVisit),
    clientVisitReason: form.needsClientVisit ? trim(form.clientVisitReason) : "",
    customFields: (form.customFields || [])
      .map((f) => ({ label: trim(f.label), value: trim(f.value) }))
      .filter((f) => f.label || f.value),
    potential: form.potential || null,
    notPotentialReason: form.potential === "no" ? trim(form.notPotentialReason) : "",
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
  if (isBlank(form.customerLegalName)) errors.customerLegalName = "Enter the customer name.";
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
  if (!form.leadSource) errors.leadSource = "Select a lead source.";
  if (form.leadSource === "referrer" && isBlank(form.referrerId))
    errors.referrerId = "Select the referrer who introduced this lead.";
  if (isBlank(form.leadType)) errors.leadType = "Select a type.";
  if (form.needsClientVisit && isBlank(form.clientVisitReason))
    errors.clientVisitReason = "Enter the reason a client visit is needed.";
  if (form.needsClientVisit && isBlank(form.operationalCoordinatorId))
    errors.operationalCoordinatorId = "Assign an operational coordinator for the client visit.";
  if (form.needsClientContact && !(form.contactAttempts || []).length)
    errors.contactAttempts = "Log at least one contact attempt.";
  if ((form.contactAttempts || []).some((a) => a.reached === false && isBlank(a.reason)))
    errors.contactAttempts = "Enter a reason for every attempt where the client wasn't reached.";
  if (form.hasOwnerDiscount) {
    if (isBlank(form.ownerDiscountName)) errors.ownerDiscountName = "Enter the owner's name.";
    if (isBlank(form.ownerDiscountAmount)) errors.ownerDiscountAmount = "Enter the discount amount.";
    if (!isBlank(form.ownerDiscountAmount) && Number(form.ownerDiscountAmount) < 0)
      errors.ownerDiscountAmount = "Discount cannot be negative.";
  }
  if (form.potential === "no" && isBlank(form.notPotentialReason))
    errors.notPotentialReason = "Enter the reason this isn't a potential client.";
  if (form.potential === "yes" && isBlank(form.estimatorId))
    errors.estimatorId = "Assign an estimator for this potential client.";
  return errors;
}
