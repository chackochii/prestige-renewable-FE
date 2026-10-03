// Approvals (stage 5) workflow rules, mirrored from the Sydpro process chart:
// the approvals a job needs run side by side; once all are in the job goes to
// procurement, and if any is not given it goes back to its salesperson. Pure
// functions over a job record from prestige-be (services/api/approvalsApi.js),
// so every panel agrees on where a job is.

import { APPROVAL_RULES, CHECKLIST_TYPES, ITEM_STATUSES } from "@/constants/approvals";

/** How an approval reads where there is no room for its full label (the board's status, the gate). */
const SHORT_LABELS = {
  dnsp: "DNSP",
  da: "DA",
  finance: "Finance",
  strata: "Strata",
  heritage: "Heritage",
  landlord: "Landlord",
  electrical_safety: "Electrical safety",
  rebate: "Rebate",
};

export const shortLabel = (item) => item?.short ?? SHORT_LABELS[item?.key] ?? item?.label ?? item?.key ?? "";

/** The approvals this job needs, in the unit's catalogue order (as the API returns them). */
export function approvalItems(job) {
  return (Array.isArray(job?.items) ? job.items : []).map((item) => ({ ...item, short: shortLabel(item) }));
}

/** The ones still counted — everything required that has not been marked not applicable. */
export function applicableItems(job) {
  return approvalItems(job).filter((item) => item.applicable !== false && item.status !== "not_applicable");
}

/** DNSP, DA and finance are worked through a checklist; the rest are recorded directly. */
export const hasChecklist = (item) => Boolean(item?.hasChecklist ?? CHECKLIST_TYPES.includes(item?.key));

export function itemStatus(item) {
  return ITEM_STATUSES[item?.status] ?? ITEM_STATUSES.not_started;
}

export function pendingItems(job) {
  return applicableItems(job).filter((item) => item.status !== "approved" && item.status !== "rejected");
}

export function rejectedItems(job) {
  return applicableItems(job).filter((item) => item.status === "rejected");
}

/**
 * The chart's "All approved?" decision: approved (→ procurement), rejected
 * (→ back to the salesperson) or pending (still waiting on someone). One
 * rejection decides it — nothing else can make the job approvable.
 */
export function approvalOutcome(job) {
  const applicable = applicableItems(job);
  if (!applicable.length) return "pending";
  if (rejectedItems(job).length) return "rejected";
  return applicable.every((item) => item.status === "approved") ? "approved" : "pending";
}

export function financeRequired(job) {
  return approvalItems(job).some((item) => item.key === "finance");
}

/** Past the stage's timeline without a decision either way. */
export function isOverdue(job, now = new Date()) {
  return approvalOutcome(job) === "pending" && Boolean(job?.slaDueAt) && new Date(job.slaDueAt) < now;
}

/** Which of the stage's rules have fired on this job. */
export function firedRules(job) {
  const keys = new Set((job?.notifications ?? []).map((notice) => notice.rule));
  return APPROVAL_RULES.filter((rule) => keys.has(rule.key));
}

/** What a person needs to know about a job at a glance: { key, label, tone }. */
export function approvalStatus(job) {
  const outcome = approvalOutcome(job);
  // Moved on already: every approval was in.
  if (outcome === "approved" || (job?.stage && Number(job.stage) > 5 && approvalItems(job).length))
    return { key: "approved", label: Number(job?.stage) > 5 ? "In procurement" : "Ready for procurement", tone: "success" };
  if (outcome === "rejected") return { key: outcome, label: `Back with ${job?.salesperson?.name ?? "sales"}`, tone: "danger" };
  if (!approvalItems(job).length) return { key: "none", label: "No approvals marked as required", tone: "neutral" };
  const waiting = pendingItems(job).map((item) => item.short);
  return { key: outcome, label: waiting.length ? `Awaiting ${waiting.join(" + ")}` : "Not started", tone: "warning" };
}
