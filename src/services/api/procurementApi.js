// Procurement & delivery (stage 6). See prestige-be procurementService.js.
//
// A job as the procurement screens read it (helpers/procurement.js works the
// rules over this shape):
//   { id, number, stage, lifecycle, customer, site, acceptedValue,
//     salesperson, salespersonId, coordinator, coordinatorId, enteredAt, slaDueAt,
//     boq: [line], revisions: [{ round, at, by, reason, lines }],
//     quotes: [{ supplier, total, validUntil, receivedAt, note }],
//     approvals: [{ role, approver, status, requestedAt, decidedAt, note }],
//     purchaseOrders: [{ id, number, supplier, status, lines, total, sentAt, deliveryEta, scheduledFor, deliveredAt, receivedBy }],
//     greenDeal: { created, jobId?, createdAt?, by? },
//     checklist: { boq, quote, po, receipt, jobCreation },
//     variation: { proposalTotal, quotedTotal, pct, tier, approvers, pending, readyToOrder },
//     sections: { boq, quote, po, receipt, jobCreation } (complete or not, as the API reads it),
//     history: [{ at, by, action, detail }], notifications: [{ at, rule, to, priority, message }] }
// A BOQ line:
//   { key, kind: material | service, item, brand, unit, proposalQty, siteQty,
//     proposalUnitCost, quotedUnitCost | null, supplier, availability, leadTimeDays }
// The board and the single job return the same shape, so the procurement page
// is one request and opening a job on it is none. Every write returns the job.

import { apiClient, unwrap, unwrapList } from "./client";

/** Stage-6 jobs (whole) plus ones that moved on in the last 30 days. */
export async function getProcurementBoard(params = {}) {
  // params: { businessUnitId, search?, page, pageSize } → { items, total, page, pageSize, counts: { all, inStage, awaitingApproval, purchaseOrders, greenDeal } }
  return unwrapList(await apiClient.get("/opportunities/procurement", { params }));
}

/** One job's procurement record — the opportunity page's stage-6 panel, which has no board to read from. */
export async function getProcurementJob(opportunityId) {
  return unwrap(await apiClient.get(`/opportunities/${opportunityId}/procurement`));
}

/** section: boq | quote | po | receipt | jobCreation; patch: the answers that changed. */
export async function patchProcurementChecklist(opportunityId, section, patch) {
  return unwrap(await apiClient.patch(`/opportunities/${opportunityId}/procurement/checklist/${section}`, { patch }));
}

/**
 * body: { lines: [{ key, siteQty?, quotedUnitCost?, supplier?, availability?, leadTimeDays? }],
 *         add?: [{ item, brand?, unit?, kind?, siteQty, quotedUnitCost?, supplier? }], remove?: [key],
 *         revise?: boolean, reason? }
 */
export async function saveBoq(opportunityId, body) {
  return unwrap(await apiClient.put(`/opportunities/${opportunityId}/procurement/boq`, body));
}

/** body: { supplier, total, validUntil?, receivedAt?, note? } */
export async function addSupplierQuote(opportunityId, body) {
  return unwrap(await apiClient.post(`/opportunities/${opportunityId}/procurement/quotes`, body));
}

export async function removeSupplierQuote(opportunityId, index) {
  return unwrap(await apiClient.delete(`/opportunities/${opportunityId}/procurement/quotes/${index}`));
}

/** body: { supplier, lines: [key], total?, deliveryEta? } → the job, with the new draft on it */
export async function createPurchaseOrder(opportunityId, body) {
  return unwrap(await apiClient.post(`/opportunities/${opportunityId}/procurement/purchase-orders`, body));
}

/** body: { status?, supplier?, lines?, total?, deliveryEta?, scheduledFor?, deliveredAt?, receivedBy? } */
export async function updatePurchaseOrder(opportunityId, poId, body) {
  return unwrap(await apiClient.patch(`/opportunities/${opportunityId}/procurement/purchase-orders/${poId}`, body));
}

export async function deletePurchaseOrder(opportunityId, poId) {
  return unwrap(await apiClient.delete(`/opportunities/${opportunityId}/procurement/purchase-orders/${poId}`));
}

/** role: SMM | BO; body: { outcome: approved | rejected, note? } */
export async function decideVariation(opportunityId, role, body) {
  return unwrap(await apiClient.post(`/opportunities/${opportunityId}/procurement/approvals/${role}/decision`, body));
}
