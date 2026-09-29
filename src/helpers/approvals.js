// Approvals (stage 5) workflow rules, mirrored from the Sydpro process chart:
// DA, DNSP, finance (if applicable) and additional approvals (if any) run side
// by side; once all are in the job goes to procurement, and if any is not
// given it goes back to its salesperson. Pure functions over a job record, so
// every panel agrees on where a job is — and so the rules can move to
// prestige-be unchanged. Until then the jobs come from lib/mockData/approvals.js.

import { APPROVAL_RULES, APPROVAL_TRACKS, ITEM_STATUSES } from "@/lib/mockData/approvals";

export function trackOf(key) {
  return APPROVAL_TRACKS.find((track) => track.key === key) ?? { key, label: key, short: key };
}

/** Each track with the job's item on it, in chart order. */
export function approvalItems(job) {
  const items = Array.isArray(job?.items) ? job.items : [];
  return APPROVAL_TRACKS.map((track) => {
    const item = items.find((candidate) => candidate.key === track.key) ?? { key: track.key, applicable: false, status: "not_applicable" };
    return { ...track, ...item, label: item.label || track.label };
  });
}

/** The approvals this job actually needs. */
export function applicableItems(job) {
  return approvalItems(job).filter((item) => item.applicable);
}

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
  return approvalItems(job).some((item) => item.key === "finance" && item.applicable);
}

/** Past the stage's timeline without a decision either way. */
export function isOverdue(job, now = new Date()) {
  return approvalOutcome(job) === "pending" && Boolean(job?.slaDueAt) && new Date(job.slaDueAt) < now;
}

export function ruleOf(key) {
  return APPROVAL_RULES.find((rule) => rule.key === key) ?? null;
}

/** Which of the stage's rules have fired on this job. */
export function firedRules(job) {
  const keys = new Set((job?.notifications ?? []).map((notice) => notice.rule));
  return APPROVAL_RULES.filter((rule) => keys.has(rule.key));
}

/** What a person needs to know about a job at a glance: { key, label, tone }. */
export function approvalStatus(job) {
  const outcome = approvalOutcome(job);
  if (outcome === "approved") return { key: outcome, label: "Ready for procurement", tone: "success" };
  if (outcome === "rejected")
    return { key: outcome, label: `Back with ${job?.assignedBack?.to ?? job?.salesperson ?? "sales"}`, tone: "danger" };
  const waiting = pendingItems(job).map((item) => item.short);
  return { key: outcome, label: waiting.length ? `Awaiting ${waiting.join(" + ")}` : "Not started", tone: "warning" };
}
