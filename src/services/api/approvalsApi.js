// Approvals (stage 5): which approvals a job needs, and each one lodged and
// decided. See prestige-be approvalsService.js.
//
// A job as the approvals screens read it:
//   { id, number, stage, lifecycle, customer, site, council, contact: { name, email, phone },
//     phase, existingSystem, system: { sizeKw, panels, inverter, battery }, acceptedValue,
//     financeAssistance, financeNotes, salesperson: { id, name } | null,
//     enteredAt, slaDueAt (while at the stage), requiredApprovals: [key],
//     catalogue: [{ key, label }], items: [item],
//     history: [{ at, by, action, detail }], notifications: [{ at, rule, to, priority, message }] }
// The board and the single job return the same shape, so the approvals page
// is one request and opening a job on it is none.
// An item (one required approval):
//   { key, type, label, required, applicable, hasChecklist, status, authority, reference,
//     owner, submittedAt, decidedAt, note, documentName, checklist: {...} }
// status: not_started | submitted | approved | rejected | not_applicable

import { apiClient, unwrap } from "./client";

/** Stage-5 jobs (whole, as above) plus ones that moved on in the last 30 days. */
export async function getApprovalsBoard({ businessUnitId, search } = {}) {
  return unwrap(await apiClient.get("/opportunities/approvals", { params: { businessUnitId, search: search || undefined } }));
}

/** One job's approvals — the opportunity page's stage-5 panel, which has no board to read from. */
export async function getJobApprovals(opportunityId) {
  return unwrap(await apiClient.get(`/opportunities/${opportunityId}/approvals`));
}

/**
 * Which approvals the job needs — keys from the unit's catalogue. Sales,
 * estimation or the coordinator; at stage 5 the rows follow. → the
 * opportunity, or with `view: "approvals"` the job's approvals, so the
 * approvals screens get the new rows back in the same round trip.
 */
export async function setRequiredApprovals(opportunityId, keys, { view } = {}) {
  return unwrap(await apiClient.put(`/opportunities/${opportunityId}/required-approvals`, { keys }, { params: view ? { view } : undefined }));
}

/**
 * body: { status?, authority?, reference?, submittedAt?, decidedAt?, note?, documentName?, checklist? }
 * `checklist` merges into the answers held. → the job's approvals
 */
export async function updateApproval(opportunityId, type, body) {
  return unwrap(await apiClient.patch(`/opportunities/${opportunityId}/approvals/${encodeURIComponent(type)}`, body));
}
