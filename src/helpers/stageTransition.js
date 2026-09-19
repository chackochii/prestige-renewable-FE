// Stage gating rules mirrored from prestige-be (opportunityService.advanceStage)
// plus the completeness checklist the lead form shows. The API remains the
// source of truth — these only give people an early, readable list of what
// is still missing.

import { CLOSED_LIFECYCLES, LAST_STAGE } from "@/constants/stages";
import { isBlank } from "@/utils/validators";

/** Items still missing before a lead can leave stage 1. Hard gates first. */
export function leadGateItems(opp) {
  if (!opp) return [];
  const missing = [];
  if (opp.qualification !== "qualified") missing.push("Lead must be marked Potential to progress");
  if (!opp.estimatorId) missing.push("Assigned estimator");
  return missing;
}

export const SITE_EVIDENCE_TYPES = ["site_photo", "drawing"];

/**
 * What is still missing before the lead may be marked Qualified — a logged
 * client meeting and a site photo or sketch. Mirrors the API's rule.
 */
export function qualificationGateItems(opp) {
  if (!opp) return [];
  const missing = [];
  if (!(Array.isArray(opp.meetings) ? opp.meetings : []).length) missing.push("Log a client meeting");
  const docs = Array.isArray(opp.documents) ? opp.documents : [];
  if (!docs.some((d) => SITE_EVIDENCE_TYPES.includes(d.type))) missing.push("Attach a site photo or sketch");
  return missing;
}

/** Softer completeness checklist for the lead pack (not enforced by the API). */
export function leadCompletenessItems(opp) {
  if (!opp) return [];
  const missing = [];
  if (isBlank(opp.customerLegalName)) missing.push("Customer name");
  if (isBlank(opp.siteLine1) || isBlank(opp.siteSuburb)) missing.push("Site street and suburb");
  if (isBlank(opp.propertyStoreys)) missing.push("House type (single or double storey)");
  if (isBlank(opp.roofType)) missing.push("Roof type");
  if (isBlank(opp.electricalPhase)) missing.push("Electrical phase");
  if (isBlank(opp.energyAnnualKwh) && !opp.energyHasBills) missing.push("Energy usage or bills");
  if (isBlank(opp.preferredInstallTimeframe)) missing.push("Preferred installation timeframe");
  if (!opp.leadSource) missing.push("Lead source");
  if (opp.leadSource === "referrer" && !opp.referrerId) missing.push("Referrer");
  return missing;
}

/**
 * Estimation stage (2) status, derived from the record's own fields rather
 * than a separate status flag — mirrors advanceState()/leadGateItems() below.
 */
export function estimationState(opp) {
  if (!opp) return "awaiting_requirements";
  if (opp.estimationRequirementsReceived == null) return "awaiting_requirements";
  if (opp.estimationRequirementsReceived === false) return "on_hold";
  if (opp.estimationClientInfoNeeded === false) return "ready";
  if (opp.estimationClientInfoNeeded === true) return "awaiting_client_info";
  return "evaluating";
}

/** Items still missing before an opportunity can leave estimation (stage 2). */
export function estimationGateItems(opp) {
  if (!opp) return [];
  return estimationState(opp) === "ready" ? [] : ["Complete estimation (requirements, checklist, client input)"];
}

/** Items still missing before an opportunity can leave estimation without a priced quote. */
export function quoteGateItems(quote) {
  return quote?.items?.length ? [] : ["Add at least one item to the quote"];
}

/** Whether the "Advance" action makes sense for this record. */
export function advanceState(opp, { quote } = {}) {
  if (!opp) return { canAdvance: false, missing: ["No record"] };
  if (opp.lifecycle && CLOSED_LIFECYCLES.includes(opp.lifecycle))
    return { canAdvance: false, missing: [`Record is ${opp.lifecycle.toLowerCase()}`] };
  if (Number(opp.stage) >= LAST_STAGE) return { canAdvance: false, missing: ["Already at the final stage"] };
  const stage = Number(opp.stage);
  const missing =
    stage === 1 ? leadGateItems(opp) : stage === 2 ? [...estimationGateItems(opp), ...quoteGateItems(quote)] : [];
  return { canAdvance: missing.length === 0, missing };
}
