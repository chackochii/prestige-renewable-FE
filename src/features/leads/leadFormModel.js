// Lead form model: empty form, opportunity → form, form → API payload, and
// validation. Field names match prestige-be's opportunity LEAD_FIELDS.

import { toDateInput } from "@/helpers/dateTimeHelpers";
import { isBlank, isDateInput, isEmail } from "@/utils/validators";
import { MANUAL_LEAD_SOURCES } from "./leadSourceOptions";

const MANUAL_SOURCE_KEYS = MANUAL_LEAD_SOURCES.map((s) => s.key);

export function emptyLeadForm() {
  return {
    leadType: "",
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
    contactName: "",
    contactRole: "",
    contactEmail: "",
    contactPhone: "",
    qualification: "nurture",
    qualificationAuthority: "",
    qualificationTiming: "",
    estimatedValue: "",
    nextAction: "",
    nextActionDueAt: "",
    energyAnnualKwh: "",
    energyHasBills: false,
    energyNotes: "",
    leadSource: "internal",
    referrerId: "",
    involvementTier: "lead_only",
    estimatorId: "",
    salespersonId: "",
    notes: "",
  };
}

const str = (v) => (v === null || v === undefined ? "" : String(v));

export function leadToForm(opp) {
  const base = emptyLeadForm();
  if (!opp) return base;
  return {
    ...base,
    leadType: str(opp.leadType),
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
    contactName: str(opp.contactName),
    contactRole: str(opp.contactRole),
    contactEmail: str(opp.contactEmail),
    contactPhone: str(opp.contactPhone),
    qualification: str(opp.qualification) || "nurture",
    qualificationAuthority: str(opp.qualificationAuthority),
    qualificationTiming: str(opp.qualificationTiming),
    estimatedValue: str(opp.estimatedValue),
    nextAction: str(opp.nextAction),
    nextActionDueAt: toDateInput(opp.nextActionDueAt),
    energyAnnualKwh: str(opp.energyAnnualKwh),
    energyHasBills: Boolean(opp.energyHasBills),
    energyNotes: str(opp.energyNotes),
    leadSource: str(opp.leadSource) || "internal",
    referrerId: str(opp.referrerId),
    involvementTier: str(opp.involvementTier) || "lead_only",
    estimatorId: str(opp.estimatorId),
    salespersonId: str(opp.salespersonId),
    notes: str(opp.notes),
  };
}

const trim = (v) => String(v ?? "").trim();
const idOrNull = (v) => (isBlank(v) ? null : Number(v));
const numberOrNull = (v) => (isBlank(v) ? null : Number(v));

/** True when the source was set by an integration and must not be edited by hand. */
export function isAutomatedSource(source) {
  return Boolean(source) && !MANUAL_SOURCE_KEYS.includes(source);
}

export function formToPayload(form) {
  const payload = {
    leadType: form.leadType || "",
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
    contactName: trim(form.contactName),
    contactRole: trim(form.contactRole),
    contactEmail: trim(form.contactEmail),
    contactPhone: trim(form.contactPhone),
    qualification: form.qualification,
    qualificationAuthority: trim(form.qualificationAuthority),
    qualificationTiming: trim(form.qualificationTiming),
    estimatedValue: numberOrNull(form.estimatedValue),
    nextAction: trim(form.nextAction),
    nextActionDueAt: form.nextActionDueAt || null,
    energyAnnualKwh: numberOrNull(form.energyAnnualKwh),
    energyHasBills: Boolean(form.energyHasBills),
    energyNotes: trim(form.energyNotes),
    estimatorId: idOrNull(form.estimatorId),
    salespersonId: idOrNull(form.salespersonId),
    notes: trim(form.notes),
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
  if (isBlank(form.customerLegalName)) errors.customerLegalName = "Enter the customer legal name.";
  if (!isBlank(form.customerEmail) && !isEmail(form.customerEmail)) errors.customerEmail = "Enter a valid customer email.";
  if (!isBlank(form.contactEmail) && !isEmail(form.contactEmail)) errors.contactEmail = "Enter a valid decision-maker email.";
  if (!isBlank(form.estimatedValue) && Number(form.estimatedValue) < 0) errors.estimatedValue = "Value cannot be negative.";
  if (!isBlank(form.energyAnnualKwh) && Number(form.energyAnnualKwh) < 0) errors.energyAnnualKwh = "Usage cannot be negative.";
  if (!isBlank(form.nextActionDueAt) && !isDateInput(form.nextActionDueAt))
    errors.nextActionDueAt = "Enter a valid due date.";
  if (!form.leadSource) errors.leadSource = "Select a lead source.";
  if (form.leadSource === "referrer" && isBlank(form.referrerId))
    errors.referrerId = "Select the referrer who introduced this lead.";
  if (form.qualification === "qualified") {
    if (isBlank(form.estimatorId)) errors.estimatorId = "Assign an estimator to qualify this lead.";
    if (isBlank(form.nextAction)) errors.nextAction = "Set the next action.";
    if (isBlank(form.nextActionDueAt)) errors.nextActionDueAt = "Set a due date.";
  }
  return errors;
}
