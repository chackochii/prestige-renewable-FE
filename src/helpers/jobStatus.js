// The status badge on a pipeline card.
//
// Two of these matter more than the rest:
//
//   New     — a lead as it was captured and nothing more. No salesperson has
//             picked it up, so the mandatory checklist has not been opened and
//             all anyone has is the basic details.
//   Blocked — the job is sitting with somebody else. The stage is still ours,
//             but the next move is not: operations has the site visit, or
//             sales is chasing the client. The badge says so and its tooltip
//             names who it is with.
//
// Everything here is derived from fields the opportunity list already returns
// — same rule as helpers/waitingFor.js — so the board costs no extra request.

import { FIRST_STAGE } from "@/constants/stages";

const ESTIMATION_STAGE = 2;

/**
 * Who the job is waiting on at its current stage, as a sentence, or null when
 * nobody outside the stage owner is holding it.
 */
export function blockedOn(opp, userName) {
  if (!opp) return null;
  const stage = Number(opp.stage);
  const name = (id) => (id ? userName?.(id) : null);

  // Operations has the site visit until it comes back completed.
  if (
    stage === ESTIMATION_STAGE &&
    opp.estimationPreSiteInspectionRequired === true &&
    opp.estimationSiteVisitCompleted !== true
  ) {
    const crew = name(opp.estimationSiteVisitAssigneeId);
    if (crew) return `Assigned to ${crew} for the pre-site inspection`;
    const coordinator = name(opp.operationalCoordinatorId);
    if (coordinator) return `Assigned to ${coordinator} (operations coordinator) for the pre-site inspection`;
    return "Assigned to operations for the pre-site inspection — no coordinator yet";
  }

  // Sales is chasing the client for what estimation cannot price without.
  if (stage === ESTIMATION_STAGE && opp.estimationClientInfoNeeded === true) {
    const salesperson = name(opp.salespersonId);
    return salesperson
      ? `Assigned to ${salesperson} — waiting on client information`
      : "Assigned to sales — waiting on client information";
  }

  return null;
}

/** The statuses a job can show, for the pipeline's Status filter. */
export const JOB_STATUS_OPTIONS = [
  { key: "new", label: "New" },
  { key: "blocked", label: "Blocked" },
  { key: "variation", label: "Variation" },
  { key: "referral", label: "Referral" },
  { key: "none", label: "No status" },
];

/** Who captured the lead. Falls back to the lead owner where the API sends no author. */
export function createdById(opp) {
  return opp?.createdById ?? opp?.leadOwnerId ?? null;
}

/** A lead that is still only the details it was captured with. */
export function isNewLead(opp) {
  return Number(opp?.stage) === FIRST_STAGE && !opp?.salespersonId;
}

/**
 * The one status a card shows. Blocked outranks the rest — who is holding the
 * job is the thing worth seeing from across the board.
 */
export function jobStatus(opp, { userName } = {}) {
  const blocked = blockedOn(opp, userName);
  if (blocked) return { key: "blocked", label: "Blocked", tone: "danger", title: blocked };

  if (isNewLead(opp))
    return {
      key: "new",
      label: "New",
      tone: "info",
      title: "Captured with the basic details only — no salesperson assigned yet",
    };

  if (opp?.variationPending)
    return { key: "variation", label: "Variation", tone: "warning", title: "A variation is waiting to be checked" };

  if (opp?.leadSource === "referrer")
    return { key: "referral", label: "Referral", tone: "neutral", title: "Introduced by a referrer" };

  return null;
}
