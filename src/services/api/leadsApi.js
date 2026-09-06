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
