// What the approvals checklists (constants/approvalChecklists.js) need beyond
// the shared rules in helpers/checklist.js: the conditions their items depend
// on, the NMI the finance application reuses, and how the checklists drive the
// approval tracks and the "All approved?" gate.
//
// A job's checklist answers live on its approval items (item.checklist, one
// set per DNSP / DA / finance item) — checklistOf gathers them as
// { dnsp: {...}, da: {...}, finance: {...} }, which is what the rules read.

import { APPROVAL_CHECKLISTS, CHECKLIST_OWNER, FINANCE_OPTIONS } from "@/constants/approvalChecklists";
import { hasChecklist } from "@/helpers/approvals";
import { isNmi, normaliseNmi, statusOf } from "@/helpers/checklist";

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
  if (da.solarNeedsDa === "no" && da.batteryNeedsDa === "no") return false;
  return null;
}

/** The rules' context for a job's approvals checklists (see helpers/checklist.js). */
export function approvalContext(checklist) {
  return {
    conditions: { daRequired: daRequired(checklist) },
    autoAnswered: (field) => (field.source === "nmi" ? Boolean(recordedNmi(checklist)) : undefined),
  };
}

/** Who each application is with, for the track cards on the overview. */
function authorityFor(section, answers, job) {
  if (section.key === "dnsp") return answers.network || null;
  if (section.key === "da") return job?.council || null;
  if (section.key === "finance") return FINANCE_OPTIONS.find((option) => option.value === answers.financeOption)?.label ?? null;
  return null;
}

/**
 * What a checklist's answers say about its approval — the status the track
 * shows and the records to keep with it. Sent to the API with the answers,
 * and shown straight away.
 */
export function derivedTrack(section, answers, job) {
  const status = statusOf(section, answers);
  return {
    status: status?.track ?? "not_started",
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
