// Opportunities (a "lead" is an opportunity at stage 1). Guarded server-side
// by the leads.* permissions.

import { apiClient, unwrap, unwrapList } from "./client";

/** params: { businessUnitId (required), stage?, lifecycle?, search?, page?, pageSize? } */
export async function listOpportunities(params) {
  return unwrapList(await apiClient.get("/opportunities", { params }));
}

export async function getOpportunity(id) {
  return unwrap(await apiClient.get(`/opportunities/${id}`));
}

/** body: lead fields + businessUnitId */
export async function createLead(body) {
  return unwrap(await apiClient.post("/opportunities", body));
}

/** body: lead fields (all optional) and, optionally, lifecycle */
export async function updateLead(id, body) {
  return unwrap(await apiClient.patch(`/opportunities/${id}`, body));
}

/** Moves to the next stage the unit runs; stage gates apply server-side. */
export async function advanceOpportunity(id) {
  return unwrap(await apiClient.post(`/opportunities/${id}/advance`));
}

/** Only records still at stage 1 can be removed. */
export async function deleteLead(id) {
  await apiClient.delete(`/opportunities/${id}`);
}

/** Manually added job-history entries for an opportunity, newest first. */
export async function listOpportunityHistory(id) {
  return unwrap(await apiClient.get(`/opportunities/${id}/history`));
}

/** body: { note } */
export async function addOpportunityHistory(id, body) {
  return unwrap(await apiClient.post(`/opportunities/${id}/history`, body));
}

/** Client meeting / site visit log for a lead, newest first. */
export async function listOpportunityMeetings(id) {
  return unwrap(await apiClient.get(`/opportunities/${id}/meetings`));
}

/** body: { attendees, outcome, nextStep } */
export async function addOpportunityMeeting(id, body) {
  return unwrap(await apiClient.post(`/opportunities/${id}/meetings`, body));
}

/** Site photos and sketches attached to a lead. */
export async function listOpportunityAttachments(id) {
  return unwrap(await apiClient.get(`/opportunities/${id}/attachments`));
}

/** category: "photo" | "sketch" | "bill" | "client_document" */
export async function uploadOpportunityAttachment(id, category, file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("category", category);
  return unwrap(
    await apiClient.post(`/opportunities/${id}/attachments`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  );
}

// ---- Lead Module assignment endpoints ---------------------------------
// One dedicated endpoint per role-assignment action, rather than folding
// these fields into the generic PATCH — each is a discrete "assign X" event
// prestige-be can validate, audit and (later) notify on independently.

/** body: { salespersonId: number|null, reason? } — reason required when leaving it unassigned. */
export async function assignSalesperson(id, body) {
  return unwrap(await apiClient.post(`/opportunities/${id}/assign-salesperson`, body));
}

/** body: { estimatorId } */
export async function assignEstimator(id, body) {
  return unwrap(await apiClient.post(`/opportunities/${id}/assign-estimator`, body));
}

/** body: { operationalCoordinatorId } */
export async function assignCoordinator(id, body) {
  return unwrap(await apiClient.post(`/opportunities/${id}/assign-coordinator`, body));
}

/** Tells prestige-be to notify whoever holds the Business Owner role about this lead. */
export async function notifyBusinessOwner(id) {
  return unwrap(await apiClient.post(`/opportunities/${id}/notify-owner`));
}

// ---- Estimation stage (2) workflow ------------------------------------
// One dedicated endpoint per gate, same reasoning as the assignment
// endpoints above — each is a discrete, auditable step prestige-be can
// validate and notify on independently, rather than a generic PATCH.
//
// Guarded by estimation.update, not leads.* — an Estimator should be able
// to work this stage without also being able to edit the lead pack (stage
// 1), which is what leads.update controls. The one exception is
// assign-coordinator above: it's shared with the Lead module's own
// coordinator picker, so it should accept either leads.update or
// estimation.update.

/** body: { received: boolean, checklistKeys?: string[], reason?: string } — reason required when received is false. */
export async function submitEstimationRequirements(id, body) {
  return unwrap(await apiClient.post(`/opportunities/${id}/estimation/requirements`, body));
}

/** body: { needed: boolean } */
export async function submitEstimationClientInfo(id, body) {
  return unwrap(await apiClient.post(`/opportunities/${id}/estimation/client-info`, body));
}

/**
 * body: { checklistValues: Record<string, string>, preSiteInspectionRequired: boolean,
 *         siteVisitAssigneeId?: number|null, siteVisitCompleted?: boolean }
 */
export async function submitEstimatorChecklist(id, body) {
  return unwrap(await apiClient.post(`/opportunities/${id}/estimation/checklist`, body));
}

/**
 * Estimation collecting an optional lead input the client had to supply.
 * body: { input } — a partial estimationInput, merged server-side. Guarded by
 * estimation.update: it is the estimator's work, not the lead pack.
 */
export async function collectEstimationInputs(id, body) {
  return unwrap(await apiClient.post(`/opportunities/${id}/estimation/collected-inputs`, body));
}

/**
 * The estimation-side gate: the estimator has reviewed what sales supplied and
 * confirms BOQ preparation can start. Returning it to sales instead goes
 * through submitEstimationRequirements({ received: false, reason }).
 */
export async function acceptEstimationInputs(id) {
  return unwrap(await apiClient.post(`/opportunities/${id}/estimation/accept-inputs`));
}

/**
 * Tells the assigned estimator the lead pack changed under them.
 * body: { summary? } — sent after a save that edits a lead already handed over.
 */
export async function notifyEstimator(id, body = {}) {
  return unwrap(await apiClient.post(`/opportunities/${id}/notify-estimator`, body));
}

/** The estimator clearing the "lead details changed" notice on their screen. */
export async function acknowledgeLeadChange(id) {
  return unwrap(await apiClient.post(`/opportunities/${id}/estimation/acknowledge-lead-change`));
}

/** Tells prestige-be to notify whoever holds the Sales Manager role about this lead. */
export async function notifySalesManager(id) {
  return unwrap(await apiClient.post(`/opportunities/${id}/notify-sales-manager`));
}

/** Tells prestige-be to notify whoever holds the Operations Coordinator role about this lead. */
export async function notifyOperationsCoordinator(id) {
  return unwrap(await apiClient.post(`/opportunities/${id}/notify-operations-coordinator`));
}

// ---- Quote (Create Quote / Quote Builder) ------------------------------
// A nested sub-resource, same pattern as history/meetings/attachments —
// fetched and stored separately from the opportunity, not embedded.
// Guarded by estimation.update, same reasoning as the estimation workflow
// endpoints above.

/** Returns the quote for this opportunity, or null if one hasn't been created yet. */
export async function getOpportunityQuote(id) {
  return unwrap(await apiClient.get(`/opportunities/${id}/quote`));
}

/** Creates the quote — server assigns quoteNumber and prefills customer/estimator/date. */
export async function createOpportunityQuote(id) {
  return unwrap(await apiClient.post(`/opportunities/${id}/quote`));
}

/** body: { project?, projectType?, projectTypeOther?, quoteDate?, taxTreatment?, gstRatePct? } */
export async function updateOpportunityQuote(id, body) {
  return unwrap(await apiClient.patch(`/opportunities/${id}/quote`, body));
}

/** body: { itemKey, itemName, brand, unit, quantity, unitPrice, discountPct } */
export async function addQuoteItem(id, body) {
  return unwrap(await apiClient.post(`/opportunities/${id}/quote/items`, body));
}

export async function updateQuoteItem(id, itemId, body) {
  return unwrap(await apiClient.patch(`/opportunities/${id}/quote/items/${itemId}`, body));
}

export async function deleteQuoteItem(id, itemId) {
  await apiClient.delete(`/opportunities/${id}/quote/items/${itemId}`);
}

/** body: { costType, calcType: "fixed"|"percentage", value, description } */
export async function addQuoteCost(id, body) {
  return unwrap(await apiClient.post(`/opportunities/${id}/quote/costs`, body));
}

export async function updateQuoteCost(id, costId, body) {
  return unwrap(await apiClient.patch(`/opportunities/${id}/quote/costs/${costId}`, body));
}

export async function deleteQuoteCost(id, costId) {
  await apiClient.delete(`/opportunities/${id}/quote/costs/${costId}`);
}

// ---- Quote versions ------------------------------------------------------
// A saved version is a frozen snapshot of the quote (see
// helpers/invoice.js#invoiceSnapshot). The PDF is rebuilt from that snapshot
// on view/download, so nothing needs storing but the snapshot itself.

/** Saved quote versions for this opportunity, newest first. */
export async function listQuoteVersions(id) {
  return unwrap(await apiClient.get(`/opportunities/${id}/quote/versions`));
}

/**
 * body: { quoteNumber, version, grandTotal, snapshot } — the server owns the
 * version number (ours is a hint, so two people saving at once can't collide)
 * and fills in createdAt and createdByName.
 */
export async function createQuoteVersion(id, body) {
  return unwrap(await apiClient.post(`/opportunities/${id}/quote/versions`, body));
}
