// Approvals (stage 5): which approvals a job needs, and each one lodged and
// decided. See prestige-be approvalsService.js.
//
// A job as the approvals screens read it:
//   { id, number, stage, lifecycle, customer, site, council, contact: { name, email, phone },
//     phase, existingSystem, system: { sizeKw, panels, inverter, battery }, acceptedValue,
//     financeAssistance, financeNotes, salesperson: { id, name } | null,
//     enteredAt, slaDueAt (while at the stage), requiredApprovals: [key],
//     catalogue: [{ key, label }], items: [item],
//     history?: [{ at, by, action, detail }], notifications?: [{ at, rule, to, priority, message }] }
// An item (one required approval):
//   { key, type, label, required, applicable, hasChecklist, status, authority, reference,
//     owner, submittedAt, decidedAt, note, documentName, checklist: {...} }
// status: not_started | submitted | approved | rejected | not_applicable

import { apiClient, unwrap } from "./client";

/** Stage-5 jobs with their required approvals, plus ones that moved on in the last 30 days. */
export async function getApprovalsBoard({ businessUnitId, search } = {}) {
  return unwrap(await apiClient.get("/opportunities/approvals", { params: { businessUnitId, search: search || undefined } }));
}

/** One job's approvals, with its history and the notifications this stage raised. */
export async function getJobApprovals(opportunityId) {
  return unwrap(await apiClient.get(`/opportunities/${opportunityId}/approvals`));
}

/**
 * Which approvals the job needs — keys from the unit's catalogue. Sales,
 * estimation or the coordinator; at stage 5 the rows follow. → the opportunity
 */
export async function setRequiredApprovals(opportunityId, keys) {
  return unwrap(await apiClient.put(`/opportunities/${opportunityId}/required-approvals`, { keys }));
}

/**
 * body: { status?, authority?, reference?, submittedAt?, decidedAt?, note?, documentName?, checklist? }
 * `checklist` merges into the answers held. → the job's approvals
 */
export async function updateApproval(opportunityId, type, body) {
  return unwrap(await apiClient.patch(`/opportunities/${opportunityId}/approvals/${encodeURIComponent(type)}`, body));
}
