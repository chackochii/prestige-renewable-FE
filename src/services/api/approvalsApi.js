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

import { apiClient, unwrap, unwrapList } from "./client";

/** Stage-5 jobs (whole, as above) plus ones that moved on in the last 30 days. */
export async function getApprovalsBoard(params = {}) {
  // params: { businessUnitId, search?, page, pageSize } → { items, total, page, pageSize, counts: { all, pending, approved, rejected, overdue } }
  return unwrapList(await apiClient.get("/opportunities/approvals", { params }));
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
export async function setRequiredApprovals(opportunityId, keys, { view, custom } = {}) {
  // custom: [{ label }] — approvals the unit's list does not have, added to this job only.
  const body = custom?.length ? { keys, custom } : { keys };
  return unwrap(await apiClient.put(`/opportunities/${opportunityId}/required-approvals`, body, { params: view ? { view } : undefined }));
}

/**
 * body: { status?, authority?, reference?, submittedAt?, decidedAt?, note?, documentName?, checklist? }
 * `checklist` merges into the answers held. → the job's approvals
 */
export async function updateApproval(opportunityId, type, body) {
  return unwrap(await apiClient.patch(`/opportunities/${opportunityId}/approvals/${encodeURIComponent(type)}`, body));
}

/** After the job is sent on: a document or note on an approval, its status untouched. body: { note?, files?: [{ id, filename, url }] } → the job's approvals */
export async function addApprovalAddendum(opportunityId, type, body) {
  return unwrap(await apiClient.post(`/opportunities/${opportunityId}/approvals/${encodeURIComponent(type)}/addenda`, body));
}

/**
 * Resolve a rejected approval: body { option: resubmit | return_estimation |
 * return_sales | change_approach | close_lost, reason, newKey? | newLabel?
 * (change_approach), lostReason? (close_lost), changes?: ["system" | "total" |
 * "layout"] (return_estimation - which approvals reset, constants/approvals.js
 * APPROVAL_RESETS; empty: no relevant change) } → the job's approvals.
 */
export async function resolveRejection(opportunityId, type, body) {
  return unwrap(await apiClient.post(`/opportunities/${opportunityId}/approvals/${encodeURIComponent(type)}/resolve`, body));
}

/** Reopen the approvals of a job in procurement or construction (approvals.approve) → the job's approvals, back at stage 5. */
export async function reopenApprovals(opportunityId, reason) {
  return unwrap(await apiClient.post(`/opportunities/${opportunityId}/approvals/reopen`, { reason }));
}

/** Put a job at approvals On Hold, with a reason → the job's approvals. */
export async function holdApprovals(opportunityId, reason) {
  return unwrap(await apiClient.post(`/opportunities/${opportunityId}/approvals/hold`, { reason }));
}

/** Take a job off hold → the job's approvals. */
export async function resumeApprovals(opportunityId) {
  return unwrap(await apiClient.post(`/opportunities/${opportunityId}/approvals/resume`));
}

/** Clear Approval Review Needed (a quote revised after approvals were lodged) → the job's approvals. */
export async function markApprovalsReviewed(opportunityId, note) {
  return unwrap(await apiClient.post(`/opportunities/${opportunityId}/approvals/review`, note ? { note } : {}));
}
