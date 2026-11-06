// The lead inbox: ad-platform leads (Meta, Google Ads) waiting for review.
// Guarded server-side by the leads.* permissions.

import { apiClient, unwrap, unwrapList } from "./client";

/** params: { businessUnitId (required), status?, source?, search?, page?, pageSize? } → { items, total, page, pageSize, counts } */
export async function listInboundLeads(params) {
  return unwrapList(await apiClient.get("/inbound-leads", { params }));
}

/** The lead with its answers, extras and the opportunities already holding its contact details. */
export async function getInboundLead(id) {
  return unwrap(await apiClient.get(`/inbound-leads/${id}`));
}

/** body: { overrides?: { …lead fields } } → { lead, opportunity } */
export async function convertInboundLead(id, body = {}) {
  return unwrap(await apiClient.post(`/inbound-leads/${id}/convert`, body));
}

/** body: { reason? } */
export async function rejectInboundLead(id, body = {}) {
  return unwrap(await apiClient.post(`/inbound-leads/${id}/reject`, body));
}

export async function reopenInboundLead(id) {
  return unwrap(await apiClient.post(`/inbound-leads/${id}/reopen`));
}

/** Meta only: fetch the lead's answers from the platform again. */
export async function refreshInboundLead(id) {
  return unwrap(await apiClient.post(`/inbound-leads/${id}/refresh`));
}
