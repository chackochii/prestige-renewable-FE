// What the approvals checklists (constants/approvalChecklists.js) need beyond
// the shared rules in helpers/checklist.js: the conditions their items depend
// on, the NMI the finance application reuses, and how the checklists drive the
// approval tracks and the "All approved?" gate.
//
// A job's checklist answers live on its approval items (item.checklist, one
// set per DNSP / DA / finance item) — checklistOf gathers them as
// { dnsp: {...}, da: {...}, finance: {...} }, which is what the rules read.

import { APPROVAL_CHECKLISTS, CHECKLIST_OWNER, FINANCE_LODGED_STATUSES, FINANCE_OPTIONS, FINANCE_PROVIDERS } from "@/constants/approvalChecklists";
import { approvalGroup, approvalItems, exitBlockers, hasChecklist } from "@/helpers/approvals";
import { blank, isNmi, normaliseNmi, statusBlockers, statusOf } from "@/helpers/checklist";
import { formatCurrency } from "@/utils/formatCurrency";

/** The checklist answers off the job's items, by section key. */
export const checklistOf = (job) =>
  Object.fromEntries((job?.items ?? []).filter(hasChecklist).map((item) => [item.key, item.checklist ?? {}]));

export const answersOf = (checklist, sectionKey) => checklist?.[sectionKey] ?? {};

/**
 * The section as it applies to a job: whether it is needed is decided by the
 * job's required approvals now, not by the checklist's own switch — so an
 * optional section (finance) reads as applying whenever the item is there.
 */
export const sectionFor = (section) => (section.optional ? { ...section, optional: false } : section);

/** The checklist section behind an approval item, or null for a plain approval. */
export const sectionOf = (item) => {
  const section = hasChecklist(item) ? APPROVAL_CHECKLISTS.find((candidate) => candidate.track === item.key) : null;
  return section ? sectionFor(section) : null;
};

/** The NMI recorded on the DNSP application — the finance application reuses it. */
export const recordedNmi = (checklist) => {
  const nmi = answersOf(checklist, "dnsp").nmi;
  return isNmi(nmi) ? normaliseNmi(nmi) : null;
};

/**
 * Does the job need a DA or development consent? True when the solar or the
 * battery does, false when neither does, null until both are answered.
 */
export function daRequired(checklist) {
  const da = answersOf(checklist, "da");
  if (da.solarNeedsDa === "yes" || da.batteryNeedsDa === "yes") return true;
  // "na": the job has no battery, so the battery cannot need one.
  if (da.solarNeedsDa === "no" && ["no", "na"].includes(da.batteryNeedsDa)) return false;
  return null;
}

/** What the job is for, from the lead's service requirements - or, on older jobs without them, from what was quoted. */
export function jobIncludes(job) {
  const services = Array.isArray(job?.services) ? job.services : [];
  const system = job?.system ?? {};
  const known = services.length > 0;
  return {
    solar: known ? services.includes("solar") : Boolean(system.panels),
    battery: known ? services.includes("battery") : Boolean(system.battery),
    ev: known ? services.includes("ev") : false,
  };
}

/**
 * The finance checklist's summary, as [label, value, missingText] rows - only
 * the rows that apply to this job (panels only with solar, battery only with
 * a battery, …). A row with no value is a gap that blocks Details Confirmed.
 */
export function financeSummaryRows(job, checklist) {
  const system = job?.system ?? {};
  const has = jobIncludes(job);
  const missing = "Not recorded on the job";
  return [
    ["Customer Name", job?.contact?.name, missing],
    ["Email", job?.contact?.email, missing],
    ["Mobile", job?.contact?.phone, missing],
    ["NMI", recordedNmi(checklist), "Not recorded yet - on the Network Connection Approval (DNSP)"],
    ...(has.solar ? [["System Size (kW)", system.sizeKw ? `${system.sizeKw} kW` : null, missing]] : []),
    ...(has.solar ? [["Panels", system.panels, missing]] : []),
    ...(has.solar || system.hybrid ? [["Inverter", system.inverter, missing]] : []),
    ...(has.battery || system.battery ? [["Battery", system.battery, missing]] : []),
    ...(has.ev || system.otherEquipment ? [["EV Charger / Other Equipment", system.otherEquipment, missing]] : []),
    ["Quote Total ($)", job?.acceptedValue !== null && job?.acceptedValue !== undefined ? formatCurrency(job.acceptedValue) : null, "No accepted proposal on the job"],
  ];
}

/** The customer pays by finance - the lead's finance answer, unless it is a firm "no". */
export const paysByFinance = (job) => job?.financeAssistance !== "no";

/**
 * The finance application went to the lender against one quote total and the
 * quote has changed since: the approved amount may no longer match.
 */
export function financeNeedsReview(answers, job) {
  if (!FINANCE_LODGED_STATUSES.includes(answers?.status)) return false;
  const was = answers?.submittedQuoteTotal;
  const now = job?.acceptedValue;
  if (was === undefined || was === null || was === "" || now === undefined || now === null) return false;
  return Math.abs(Number(now) - Number(was)) > 0.005;
}

/** The conditions on the approvals given with conditions, as [{ key, label, conditions }]. */
export function approvalConditions(job) {
  return approvalItems(job)
    .filter((item) => item.status === "approved" && (item.checklist?.outcome ?? item.checklist?.status) === "approved_conditions" && item.checklist?.conditions)
    .map((item) => ({ key: item.key, label: item.label, conditions: String(item.checklist.conditions) }));
}

/**
 * What stands between the job and Send to Procurement (UAT exit logic, Oct
 * 2026): every applicable approval complete, evidence on the recorded ones,
 * and finance not lodged against a quote that has since changed. The
 * conditions are reviewed in the confirmation itself.
 */
export function sendBlockers(job) {
  if (job?.onHold) return [`On Hold: ${job.onHold.reason || "resume the job first"}`];
  if (job?.approvalReview) return ["Approval Review Needed: the quote was revised after approvals were lodged - review it and mark it reviewed"];
  const waiting = exitBlockers(job);
  if (waiting.length) return [`Waiting on: ${approvalItems(job).filter((item) => approvalGroup(item) !== "complete").map((item) => item.label).join(", ")}`];
  const unproven = approvalItems(job).filter((item) => item.status === "approved" && !hasChecklist(item) && !item.checklist?.evidence?.length);
  const finance = approvalItems(job).find((item) => item.key === "finance" && financeNeedsReview(item.checklist, job));
  return [
    ...(unproven.length ? [`Attach the approval evidence: ${unproven.map((item) => item.label).join(", ")}`] : []),
    ...(finance ? [`${finance.label}: the quote has changed since it was lodged - review it`] : []),
  ];
}

/** The rules' context for a job's approvals checklists (see helpers/checklist.js). */
export function approvalContext(checklist, job = null) {
  return {
    conditions: { daRequired: daRequired(checklist) },
    autoAnswered: (field) => (field.source === "nmi" ? Boolean(recordedNmi(checklist)) : undefined),
    // An auto item with gaps in its record cannot be confirmed (blockWhenMissing).
    autoMissing: (source) => (source === "financeSummary" && job ? financeSummaryRows(job, checklist).some(([, value]) => blank(value)) : false),
    paysByFinance: paysByFinance(job),
    financeNeedsReview: (answers) => financeNeedsReview(answers, job),
  };
}

/** Who each application is with, for the track cards on the overview. */
function authorityFor(section, answers, job) {
  if (section.key === "dnsp") return answers.network || null;
  if (section.key === "da") return answers.council || job?.council || null;
  if (section.key === "finance") {
    const provider = answers.financeProvider === "other" ? answers.financeProviderOther : FINANCE_PROVIDERS.find((option) => option.value === answers.financeProvider)?.label;
    const product = answers.financeOption === "other" ? answers.financeOptionOther : FINANCE_OPTIONS.find((option) => option.value === answers.financeOption)?.label;
    return [provider, product].filter(Boolean).join(" · ") || null;
  }
  return null;
}

/**
 * What a checklist's answers say about its approval — the status the track
 * shows and the records to keep with it. Sent to the API with the answers,
 * and shown straight away.
 */
export function derivedTrack(section, answers, job) {
  const status = statusOf(section, answers);
  // Answers save as they are typed: a status whose records are not in yet
  // (Approved with no evidence) is not reported as decided - it stays lodged,
  // or not started, until they are.
  const blocked = statusBlockers(section, answers, approvalContext({ ...checklistOf(job), [section.key]: answers }, job)).length > 0;
  const track = blocked ? (answers.submittedOn ? "submitted" : "not_started") : (status?.track ?? "not_started");
  return {
    status: track,
    authority: authorityFor(section, answers, job),
    reference: answers.reference || null,
    submittedAt: answers.submittedOn || null,
    decidedAt: answers.decidedOn || null,
  };
}

/**
 * The job with its checklist-driven approvals read from their answers: the
 * DNSP, DA and finance tracks show what the coordinator has recorded there,
 * the moment it is typed. Plain approvals are left as the API has them.
 */
export function applyChecklist(job) {
  if (!job) return job;
  const items = (job.items ?? []).map((item) => {
    const section = sectionOf(item);
    if (!section) return item;
    const answers = item.checklist ?? {};
    return { ...item, ...derivedTrack(section, answers, job), owner: item.owner || CHECKLIST_OWNER };
  });
  return { ...job, items };
}
