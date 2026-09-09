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

/** Softer completeness checklist for the lead pack (not enforced by the API). */
export function leadCompletenessItems(opp) {
  if (!opp) return [];
  const missing = [];
  if (isBlank(opp.customerLegalName)) missing.push("Business name");
  if (isBlank(opp.siteLine1) || isBlank(opp.siteSuburb)) missing.push("Site street and suburb");
  if (isBlank(opp.energyAnnualKwh) && !opp.energyHasBills) missing.push("Energy usage or bills");
  if (!opp.leadSource) missing.push("Lead source");
  if (opp.leadSource === "referrer" && !opp.referrerId) missing.push("Referrer");
  return missing;
}

/** Whether the "Advance" action makes sense for this record. */
export function advanceState(opp) {
  if (!opp) return { canAdvance: false, missing: ["No record"] };
  if (opp.lifecycle && CLOSED_LIFECYCLES.includes(opp.lifecycle))
    return { canAdvance: false, missing: [`Record is ${opp.lifecycle.toLowerCase()}`] };
  if (Number(opp.stage) >= LAST_STAGE) return { canAdvance: false, missing: ["Already at the final stage"] };
  const missing = Number(opp.stage) === 1 ? leadGateItems(opp) : [];
  return { canAdvance: missing.length === 0, missing };
}
