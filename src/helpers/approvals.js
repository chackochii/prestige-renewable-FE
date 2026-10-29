// Approvals (stage 5) workflow rules, mirrored from the Sydpro process chart:
// the approvals a job needs run side by side; once all are in the job goes to
// procurement, and if any is not given it goes back to its salesperson. Pure
// functions over a job record from prestige-be (services/api/approvalsApi.js),
// so every panel agrees on where a job is.

import { APPROVAL_RESETS, APPROVAL_RULES, APPROVAL_TIMER_DEFAULTS, CHECKLIST_TYPES, ITEM_STATUSES } from "@/constants/approvals";
import { HANDOVER_ONLY_TYPES, approvalLabel } from "@/helpers/requiredApprovals";
import { hasPermission, hasRole, isSuperAdmin } from "@/constants/roles";
import { advancePermissionFor } from "@/helpers/stageAccess";

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
  return (Array.isArray(job?.items) ? job.items : [])
    .filter((item) => !HANDOVER_ONLY_TYPES.includes(item.key))
    // Finance only applies when the customer pays by finance; otherwise it is not applicable and not listed.
    .filter((item) => !(item.key === "finance" && job?.financeAssistance === "no"))
    // Heritage only applies when the DA checklist does not say the property is Not Listed.
    .filter((item, _, all) => !(item.key === "heritage" && all.some((other) => other.key === "da" && other.checklist?.heritage === "not_listed")))
    .map((item) => ({ ...item, label: approvalLabel(item.key, item.label), short: shortLabel(item) }));
}

/** The ones still counted — everything required that has not been marked not applicable. */
export function applicableItems(job) {
  return approvalItems(job).filter((item) => item.applicable !== false && item.status !== "not_applicable");
}

/** DNSP, DA and finance are worked through a checklist; the rest are recorded directly. */
export const hasChecklist = (item) => Boolean(item?.hasChecklist ?? CHECKLIST_TYPES.includes(item?.key));

export function itemStatus(item) {
  // The finer statuses sit on the answers (a recorded approval's outcome, or a checklist's status).
  const finer = item?.checklist?.outcome ?? item?.checklist?.status;
  if (item?.status === "approved" && finer === "approved_conditions") return { key: "approved", label: "Approved with Conditions", tone: "success" };
  if (item?.status === "submitted" && finer === "info_requested") return { key: "submitted", label: "Further Information Requested", tone: "warning" };
  if (item?.status === "rejected" && (finer === "revoked" || finer === "expired"))
    return { key: "rejected", label: finer === "revoked" ? "Revoked" : "Expired", tone: "danger" };
  if (item?.status === "approved" && finer === "exempt") return { key: "approved", label: "Exempt", tone: "success" };
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

/**
 * The exit's three groups (UAT exit logic, Oct 2026): complete (approved, with
 * conditions, exempt, not applicable) counts towards it; open (not started,
 * lodged, further information) and failed (rejected, declined, revoked,
 * expired) block it. Approvals that do not apply are not counted at all.
 */
export function approvalGroup(item) {
  if (item?.status === "approved" || item?.status === "not_applicable") return "complete";
  if (item?.status === "rejected") return "failed";
  return "open";
}

/** A job that has moved on with an approval that has since failed (revoked, expired): it needs reviewing. */
/** Why an approval was rejected, as recorded: the checklist's reason, or a recorded approval's note. */
export function rejectionReasonOf(item) {
  const answers = item?.checklist ?? {};
  return answers.rejectionReason || answers.declineReason || answers.lapseReason || (item?.status === "rejected" ? item.note : null) || null;
}

/**
 * The approvals on this job that restart from Not Started after a redesign
 * with these changes (APPROVAL_RESETS values) - the rejected one always does.
 */
export function resetsFor(job, changes = [], rejectedKey = null) {
  const keys = new Set(APPROVAL_RESETS.filter((entry) => changes.includes(entry.value)).flatMap((entry) => entry.resets));
  return approvalItems(job).filter((item) => keys.has(item.key) || item.key === rejectedKey);
}

/** Where a job sent back from approvals went: "estimation" | "sales" | null (the API's approvalReturn). */
export function returnedTo(job) {
  return job?.approvalReturn?.to ?? job?.returnedTo ?? null;
}

export function reviewNeeded(job) {
  return Boolean(job?.approvalReview) || (Number(job?.stage) > 5 && approvalItems(job).some((item) => approvalGroup(item) === "failed"));
}

/**
 * Why the job needs an approval review, one line each: the quote revised after
 * approvals were lodged (the API's flag, with what it may break), and any
 * approval revoked or expired after the job moved on.
 */
export function reviewReasons(job) {
  const flag = job?.approvalReview;
  return [
    ...(flag ? [flag.reason, ...(Array.isArray(flag.lines) ? flag.lines : [])].filter(Boolean) : []),
    ...(Number(job?.stage) > 5
      ? approvalItems(job)
          .filter((item) => approvalGroup(item) === "failed")
          .map((item) => `${item.label} ${itemStatus(item).label.toLowerCase()}`)
      : []),
  ];
}

/** Why the job cannot leave approvals yet, one line per approval in the way; empty when it can. */
export function exitBlockers(job) {
  return approvalItems(job)
    .filter((item) => approvalGroup(item) !== "complete")
    .map((item) => `${item.label}: ${itemStatus(item).label.toLowerCase()}${approvalGroup(item) === "failed" ? " - resolve it first" : ""}`);
}

/** What a person needs to know about a job at a glance: { key, label, tone }. */
export function approvalStatus(job) {
  // Past approvals: sent, unless an approval has failed since.
  if (reviewNeeded(job)) return { key: "review", label: "Approval Review Needed", tone: "warning" };
  if (Number(job?.stage) > 5) return { key: "sent", label: "Sent to Procurement", tone: "success" };
  // The module header badge, checked in priority order (UAT exit logic, Oct 2026).
  const failed = approvalItems(job).filter((item) => approvalGroup(item) === "failed").length;
  if (failed) return { key: "rejected", label: failed === 1 ? "Approval Rejected" : `Approvals Rejected (${failed})`, tone: "danger" };
  if (returnedTo(job) === "sales" || returnedTo(job) === "estimation")
    return { key: "returned", label: returnedTo(job) === "sales" ? "Returned to Sales" : "Returned to Estimation", tone: "warning" };
  if (job?.lifecycle === "On Hold" || job?.onHold) return { key: "on_hold", label: "On Hold", tone: "neutral" };
  const progress = approvalProgress(job);
  if (progress.done < progress.total) return { key: "in_progress", label: `Approvals In Progress (${progress.label})`, tone: "info" };
  return { key: "ready", label: "Ready for Procurement", tone: "success" };
}

/** "3 of 5 Complete": the approvals on the job in the Complete group (approved, with conditions, exempt, not applicable), out of all of them. */
export function approvalProgress(job) {
  const items = approvalItems(job);
  const done = items.filter((item) => approvalGroup(item) === "complete").length;
  return { done, total: items.length, label: `${done} of ${items.length} Complete` };
}

const DAY_MS = 86400000;
const daysSince = (iso) => Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / DAY_MS));

const daysUntil = (iso) => Math.ceil((new Date(`${String(iso).slice(0, 10)}T23:59:59`).getTime() - Date.now()) / DAY_MS);

/** The unit's approval time limits (Unit settings), with the defaults for any not set. */
export function approvalTimers(unit) {
  const set = unit?.metadata?.approvalTimers ?? {};
  return Object.fromEntries(Object.entries(APPROVAL_TIMER_DEFAULTS).map(([key, fallback]) => [key, Number(set[key]) > 0 ? Number(set[key]) : fallback]));
}

/**
 * Who may send a job to Procurement and reopen its approvals (NF-23/24): the
 * roles picked on Unit settings (unit.metadata.approvalAccess), or - with none
 * picked - the role permissions (approvals.update to send, approvals.approve
 * to reopen). ADM always may.
 */
export function approvalAccess(unit, user) {
  const access = unit?.metadata?.approvalAccess ?? {};
  const allowed = (roles, permission) =>
    isSuperAdmin(user) || (Array.isArray(roles) && roles.length ? hasRole(user, roles) : hasPermission(user, permission));
  return { canSend: allowed(access.sendRoles, advancePermissionFor(5)), canReopen: allowed(access.reopenRoles, "approvals.approve") };
}

/** When anything last happened on one approval (NF-13): its last change, lodgement or added document or note. */
export function itemActivityAt(item) {
  const times = [item?.updatedAt, item?.submittedAt, ...(item?.checklist?.addenda ?? []).map((entry) => entry.at)]
    .filter(Boolean)
    .map((at) => new Date(at).getTime())
    .filter(Number.isFinite);
  return times.length ? new Date(Math.max(...times)).toISOString() : null;
}

/** The date an approval stops being valid (Valid Until), or null. */
export function expiryOf(item) {
  return item?.checklist?.expiresOn || null;
}

/**
 * The time-based flags on one approval, as badges: Lodged too long (TR-01,
 * amber) and coming up to or past its Valid Until date (TR-03).
 */
export function timeFlags(item, timers) {
  const flags = [];
  // Lodged and nothing since (NF-13: the last activity, not just the lodgement date).
  const quiet = item.status === "submitted" && itemActivityAt(item) ? daysSince(itemActivityAt(item)) : 0;
  if (quiet > timers.staleLodgedDays)
    flags.push({ key: "stale", label: `Lodged, no update ${quiet} days`, tone: "warning", title: `Lodged and no activity for more than ${timers.staleLodgedDays} days - chase it up` });
  const expires = expiryOf(item);
  if (expires && approvalGroup(item) === "complete") {
    const left = daysUntil(expires);
    if (left < 0) flags.push({ key: "expired", label: "Past Valid Until", tone: "danger", title: `Valid until ${formatDay(expires)} - record it as Expired, or renew it` });
    else if (left <= timers.expiryWarningDays)
      flags.push({ key: "expiring", label: left === 0 ? "Expires today" : `Expires in ${left} day${left === 1 ? "" : "s"}`, tone: "warning", title: `Valid until ${formatDay(expires)}` });
  }
  return flags;
}

const formatDay = (iso) => new Date(`${String(iso).slice(0, 10)}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "short", year: "numeric" });

/** When anything last happened on the job's approvals: the newest history entry or approval change. */
export function lastActivityAt(job) {
  const times = [job?.lastActivityAt, job?.enteredAt, ...(job?.history ?? []).map((entry) => entry.at), ...(job?.items ?? []).map((item) => item.updatedAt)]
    .filter(Boolean)
    .map((at) => new Date(at).getTime())
    .filter(Number.isFinite);
  return times.length ? new Date(Math.max(...times)).toISOString() : null;
}

/** Days with no activity on a job at approvals, when that is past the unit's limit (TR-02); else null. */
export function idleFor(job, timers) {
  if (Number(job?.stage) !== 5 || job?.lifecycle !== "Active") return null;
  const last = lastActivityAt(job);
  if (!last) return null;
  const days = daysSince(last);
  return days > timers.idleDays ? days : null;
}

/** The next thing the job is waiting on - "Finance: lodged 5 days ago", "Strata: not started" - or null. */
export function waitingOn(job) {
  const rejected = rejectedItems(job)[0];
  if (rejected) return `${rejected.short}: rejected`;
  // Not started first - nothing happens on those until someone lodges them.
  const pending = pendingItems(job).sort((a, b) => (a.status === "not_started" ? 0 : 1) - (b.status === "not_started" ? 0 : 1))[0];
  if (!pending) return null;
  if (pending.status === "submitted" && pending.submittedAt) {
    const days = daysSince(pending.submittedAt);
    return `${pending.short}: lodged ${days === 0 ? "today" : `${days} day${days === 1 ? "" : "s"} ago`}`;
  }
  return `${pending.short}: ${itemStatus(pending).label.toLowerCase()}`;
}

/**
 * Where the job is against the stage's time limit: "Day 4 of 10" (green),
 * "2 days left" (amber) or "13 days overdue" (red). Null once it has moved on
 * or when there is no limit.
 */
export function approvalSla(job, now = Date.now()) {
  if (Number(job?.stage) !== 5 || !job?.slaDueAt) return null;
  const due = new Date(job.slaDueAt).getTime();
  const left = Math.ceil((due - now) / DAY_MS);
  if (due < now) {
    const over = Math.max(1, Math.floor((now - due) / DAY_MS));
    return { label: `${over} day${over === 1 ? "" : "s"} overdue`, tone: "danger" };
  }
  if (left <= 2) return { label: `${left} day${left === 1 ? "" : "s"} left`, tone: "warning" };
  if (!job.enteredAt) return { label: `${left} days left`, tone: "success" };
  const start = new Date(job.enteredAt).getTime();
  const total = Math.max(1, Math.round((due - start) / DAY_MS));
  return { label: `Day ${Math.min(total, daysSince(job.enteredAt) + 1)} of ${total}`, tone: "success" };
}
