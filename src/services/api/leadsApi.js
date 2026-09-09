// Opportunities (a "lead" is an opportunity at stage 1). Guarded server-side
// by the leads.* permissions.

import { apiClient, unwrap, unwrapList } from "./client";
import { getToken } from "./tokenStore";

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

// ---- Lead pack attachments ------------------------------------------------
// Every mutation returns the refreshed opportunity (with meetings[] and
// documents[]), so the store keeps a single copy of the record.

/** body: { attendees, outcome?, nextStep?, at? } */
export async function addMeeting(id, body) {
  return unwrap(await apiClient.post(`/opportunities/${id}/meetings`, body));
}

export async function removeMeeting(id, meetingId) {
  return unwrap(await apiClient.delete(`/opportunities/${id}/meetings/${meetingId}`));
}

export async function listDocuments(id) {
  return unwrap(await apiClient.get(`/opportunities/${id}/documents`));
}

/**
 * files: File[] · meta: { type, stage?, label? } — type is the document
 * type (site_photo, drawing, lead, energy_bill, …).
 */
export async function uploadDocuments(id, files, meta = {}) {
  const form = new FormData();
  Array.from(files).forEach((file) => form.append("files", file, file.name));
  Object.entries(meta).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") form.append(key, String(value));
  });
  return unwrap(
    await apiClient.post(`/opportunities/${id}/documents`, form, {
      headers: { "Content-Type": "multipart/form-data" },
      timeout: 120000,
    }),
  );
}

export async function removeDocument(id, docId) {
  return unwrap(await apiClient.delete(`/opportunities/${id}/documents/${docId}`));
}

/**
 * Absolute URL for a document's file. The session token travels as a query
 * parameter because <img> tags and plain links cannot send a header.
 */
export function documentFileUrl(doc, { download = false } = {}) {
  if (!doc?.fileUrl) return null;
  const base = String(apiClient.defaults.baseURL || "/api").replace(/\/$/, "");
  const path = String(doc.fileUrl).replace(/^\/api/, "");
  const params = new URLSearchParams();
  const token = getToken();
  if (token) params.set("token", token);
  if (download) params.set("download", "1");
  const query = params.toString();
  return `${base}${path}${query ? `?${query}` : ""}`;
}
