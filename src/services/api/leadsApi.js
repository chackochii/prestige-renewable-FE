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

/** category: "photo" | "sketch" */
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
