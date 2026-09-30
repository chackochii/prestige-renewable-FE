// What the approvals checklists (constants/approvalChecklists.js) need beyond
// the shared rules in helpers/checklist.js: the conditions their items depend
// on, the NMI the finance application reuses, and how the checklists drive the
// approval tracks and the "All approved?" gate.
//
// A job's checklist is { dnsp: {...}, da: {...}, finance: {...} } — one set of
// answers per section.

import { APPROVAL_CHECKLISTS, CHECKLIST_OWNER, FINANCE_OPTIONS } from "@/constants/approvalChecklists";
import { approvalItems, approvalOutcome } from "@/helpers/approvals";
import { isNmi, normaliseNmi, sectionApplies, statusOf } from "@/helpers/checklist";

export const answersOf = (checklist, sectionKey) => checklist?.[sectionKey] ?? {};

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
  if (section.key === "da") return job.council || null;
  if (section.key === "finance") return FINANCE_OPTIONS.find((option) => option.value === answers.financeOption)?.label ?? null;
  return null;
}

/**
 * The job with its approval tracks driven by the checklists: each checklist's
 * status becomes its track's status, with the reference and dates recorded
 * there. Tracks without a checklist (additional approvals) are left as they are.
 */
export function applyChecklist(job, checklist) {
  if (!job) return job;
  const items = approvalItems(job).map((item) => {
    const section = APPROVAL_CHECKLISTS.find((candidate) => candidate.track === item.key);
    if (!section) return item;
    const answers = answersOf(checklist, section.key);
    if (!sectionApplies(section, answers)) return { ...item, applicable: false, status: "not_applicable" };
    const status = statusOf(section, answers);
    return {
      ...item,
      applicable: true,
      status: status.track,
      authority: authorityFor(section, answers, job) ?? item.authority,
      reference: answers.reference || null,
      owner: item.owner || CHECKLIST_OWNER,
      submittedAt: answers.submittedOn || null,
      decidedAt: answers.decidedOn || null,
    };
  });
  return { ...job, items };
}

/** Every approval through — the stage's exit gate, which is where procurement starts. */
export const approvalsThrough = (job) => approvalOutcome(job) === "approved";
