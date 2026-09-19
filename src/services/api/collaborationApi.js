// Cross-department requests and assignments.
//
// NOT YET IMPLEMENTED IN prestige-be — this is the contract the frontend is
// written against, so the module can be wired up now and the routes added
// later. Until then every call 404s and the screens show their "couldn't
// load" state rather than breaking.
//
// Authorisation is the API's job, not the caller's. Every endpoint must scope
// what it returns to the signed-in user: a person may read a request only if
// they raised it, are assigned it, or hold the department's manager
// permission; they may respond only if assigned, and decide only if they
// raised it.
// The frontend hides controls to match (see constants/collaboration.js), but
// that is a convenience, never the enforcement.

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

/** category: "attachment" | "report" — reports are what the requester waits on. */
export async function uploadRequestAttachment(id, category, file) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("category", category);
  return unwrap(
    await apiClient.post(`/collaboration/requests/${id}/attachments`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  );
}

/** body: { reason } — requester only, while the request is still open. */
export async function cancelRequest(id, body) {
  return unwrap(await apiClient.post(`/collaboration/requests/${id}/cancel`, body));
}

/** Action, actor, timestamp and status change for everything that happened. */
export async function listRequestHistory(id) {
  return unwrap(await apiClient.get(`/collaboration/requests/${id}/history`));
}
