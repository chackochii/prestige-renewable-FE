// Cross-department requests and assignments, served by prestige-be's
// collaboration module.
//
// Authorisation is the API's job, not the caller's: reading a request needs
// leads.read (or estimation.read) in the record's business unit, only the
// assignee may respond or add progress, and only the requester may decide,
// edit or cancel. Internal progress notes and unsubmitted drafts never leave
// the server for anyone else. The frontend hides controls to match (see
// constants/collaboration.js), but that is a convenience, never the
// enforcement.

import { apiClient, unwrap, unwrapList } from "./client";

/**
 * params: { businessUnitId (required), scope: "assigned" | "raised" | "all",
 *           kind?, department?, status?, opportunityId?, overdue?, page?, pageSize? }
 *
 * "assigned" is the My Assigned Requests list; "raised" is the Waiting For
 * list. "all" must still be scoped server-side to what the caller may see.
 */
export async function listRequests(params) {
  return unwrapList(await apiClient.get("/collaboration/requests", { params }));
}

/** One request with its response, progress entries, attachments and history. */
export async function getRequest(id) {
  return unwrap(await apiClient.get(`/collaboration/requests/${id}`));
}

/** Everything raised against one job, for the read-only panels on its stages. */
export async function listOpportunityRequests(opportunityId) {
  return unwrap(await apiClient.get(`/opportunities/${opportunityId}/collaboration/requests`));
}

/**
 * Raised from a stage, so the stage travels with it.
 * body: { kind, department, assigneeId, stage, title, description, priority,
 *         dueAt, requestedFields?: [{ key, label, type }], scheduledFor? }
 */
export async function createRequest(opportunityId, body) {
  return unwrap(await apiClient.post(`/opportunities/${opportunityId}/collaboration/requests`, body));
}

/** Requester edits: { title?, description?, priority?, dueAt?, assigneeId? } */
export async function updateRequest(id, body) {
  return unwrap(await apiClient.patch(`/collaboration/requests/${id}`, body));
}

/**
 * The assignee answering an information request.
 * body: { fields: { [fieldKey]: value }, note?, draft?: boolean }
 * A draft stays private to the assignee; submitting notifies the requester
 * and moves the request to "responded".
 */
export async function submitResponse(id, body) {
  return unwrap(await apiClient.post(`/collaboration/requests/${id}/response`, body));
}

/**
 * The requester accepting a response or sending it back.
 * body: { outcome: "accepted" | "clarification_required" | "returned", note? }
 */
export async function decideResponse(id, body) {
  return unwrap(await apiClient.post(`/collaboration/requests/${id}/decision`, body));
}

/**
 * The assignee moving an assignment along.
 * body: { status, note?, scheduledFor?, internal?: boolean }
 * `internal: true` keeps the note inside the assignee's department — it must
 * never be returned to the requester.
 */
export async function addProgress(id, body) {
  return unwrap(await apiClient.post(`/collaboration/requests/${id}/progress`, body));
}

/**
 * category: "attachment" | "report" — reports are what the requester waits on.
 * documentKey ties the file to the photo/document slot the requester asked
 * for, so the response comes back labelled.
 */
export async function uploadRequestAttachment(id, category, file, documentKey) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("category", category);
  if (documentKey) formData.append("documentKey", documentKey);
  return unwrap(
    await apiClient.post(`/collaboration/requests/${id}/attachments`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  );
}

/**
 * Files a supplied photo or document into the job itself, so the requester can
 * keep working with it in their own fields.
 * body: { attachmentId, category } — category is an opportunity attachment
 * category (photo | sketch | bill | client_document). The server copies the
 * stored file rather than asking the browser to re-upload it.
 */
export async function fileAttachmentOnOpportunity(id, body) {
  return unwrap(await apiClient.post(`/collaboration/requests/${id}/attachments/file-on-job`, body));
}

/** body: { reason } — requester only, while the request is still open. */
export async function cancelRequest(id, body) {
  return unwrap(await apiClient.post(`/collaboration/requests/${id}/cancel`, body));
}

/** Action, actor, timestamp and status change for everything that happened. */
export async function listRequestHistory(id) {
  return unwrap(await apiClient.get(`/collaboration/requests/${id}/history`));
}
