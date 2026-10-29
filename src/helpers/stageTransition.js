// Stage gating rules mirrored from prestige-be (opportunityService.advanceStage)
// plus the completeness checklist the lead form shows. The API remains the
// source of truth — these only give people an early, readable list of what
// is still missing.

import { exitBlockers } from "@/helpers/approvals";
import { CLOSED_LIFECYCLES, LAST_STAGE } from "@/constants/stages";
import { procurementChecklistOf } from "@/constants/procurementChecklists";
import { answersOf, procurementContext, sectionComplete } from "@/helpers/procurementChecklist";
import { advanceDeniedReason } from "@/helpers/stageAccess";
import { isBlank } from "@/utils/validators";

/** Items still missing before a lead can leave stage 1. Hard gates first. */
export function leadGateItems(opp) {
  if (!opp) return [];
  const missing = [];
  if (opp.qualification !== "qualified") missing.push("Assign an estimator to progress");
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
  if (isBlank(opp.propertyStoreys)) missing.push("Building type (single or double storey)");
  if (isBlank(opp.roofType)) missing.push("Roof type");
  if (isBlank(opp.electricalPhase)) missing.push("Electrical phase");
  if (isBlank(opp.energyAnnualKwh) && !opp.energyHasBills) missing.push("Energy usage or bills");
  if (isBlank(opp.preferredInstallTimeframe)) missing.push("Preferred installation timeframe");
  if (!opp.leadSource) missing.push("Lead source");
  if (opp.leadSource === "referrer" && !opp.referrerId && !opp.referrerName) missing.push("Referrer");
  return missing;
}

/**
 * Estimation stage (2) status, derived from the record's own fields rather
 * than a separate status flag — mirrors advanceState()/leadGateItems() below.
 */
export function estimationState(opp) {
  if (!opp) return "evaluating";
  if (opp.estimationClientInfoNeeded === false) return "ready";
  if (opp.estimationClientInfoNeeded === true) return "awaiting_client_info";
  return "evaluating";
}

/** Items still missing before an opportunity can leave estimation (stage 2). */
export function estimationGateItems(opp) {
  if (!opp) return [];
  return estimationState(opp) === "ready" ? [] : ["Complete estimation (requirements checklist, client input)"];
}

/** Items still missing before an opportunity can leave estimation without a priced quote. */
export function quoteGateItems(quote) {
  return quote?.items?.length ? [] : ["In order to send a proposal, ensure that at least one priced item is added to the quote."];
}

/**
 * Whether the "Advance" action makes sense for this record. Pass `user` and the
 * stage's own permission is checked too — moving a record on belongs to the
 * department that owns the stage being left (see helpers/stageAccess).
 */
/**
 * What still stops a job leaving procurement (6) or construction (7), read off
 * its procurement record — mirrors prestige-be procurementBlocker and
 * constructionBlocker. Procurement ends at the PO release (CL-13); the
 * material receipt (CL-14) and the Green Deal job (CL-10) are construction's.
 */
function procurementGateItems(stage, job) {
  if (!job) return ["Open the procurement record (still loading)"];
  const checklist = job.checklist ?? {};
  const ctx = procurementContext(job, checklist);
  const done = (key) => sectionComplete(procurementChecklistOf(key), answersOf(checklist, key), ctx);
  if (stage === 6) return done("po") ? [] : ["Complete every item on PO release"];
  const missing = [];
  if (answersOf(checklist, "receipt").materialsReady !== true) missing.push("Materials confirmed ready (material receipt)");
  if (!done("jobCreation")) missing.push("Job created in Green Deal (job creation)");
  return missing;
}

/** Stage 5's way out: every approval that applies is complete - read from the approvals record, not just the list ticked. */
function approvalGateItems(opp, approvalJob) {
  if (!(Array.isArray(opp.requiredApprovals) && opp.requiredApprovals.length)) return [];
  if (!approvalJob) return ["Open the approvals (still loading)"];
  return exitBlockers(approvalJob);
}

export function advanceState(opp, { quote, user, procurementJob, approvalJob } = {}) {
  if (!opp) return { canAdvance: false, missing: ["No record"] };
  if (opp.lifecycle && CLOSED_LIFECYCLES.includes(opp.lifecycle))
    return { canAdvance: false, missing: [`Record is ${opp.lifecycle.toLowerCase()}`] };
  if (Number(opp.stage) >= LAST_STAGE) return { canAdvance: false, missing: ["Already at the final stage"] };
  const stage = Number(opp.stage);
  const missing =
    stage === 1
      ? leadGateItems(opp)
      : stage === 2
        ? [...estimationGateItems(opp), ...quoteGateItems(quote)]
        : stage === 3
          ? // The customer accepting (online, or recorded by sales) moves the job on by itself.
            ["This stage is complete when the customer accepts the proposal. The job will then move to Approvals automatically."]
          : stage === 5
            ? approvalGateItems(opp, approvalJob)
            : stage === 6 || stage === 7
              ? procurementGateItems(stage, procurementJob)
              : [];
  // Listed last: the checklist tells them what the record still needs, this
  // tells them it is not theirs to move even once it is complete.
  const denied = user === undefined ? null : advanceDeniedReason(user, stage);
  if (denied) missing.push(denied);
  return { canAdvance: missing.length === 0, missing };
}
