// Public (no sign-in) endpoints behind the site-visit form. apiClient only
// attaches a bearer token when one exists, so these work signed out.
//
// The token in the link is the whole of the caller's authority: it names one
// site-visit task and nothing else. The server must never return the
// opportunity, the customer or any other job data beyond what the coordinator
// asked this person to bring back.

import { apiClient, unwrap } from "./client";

/**
 * What the person attending has been asked for.
 * → {
 *      status: "pending" | "submitted",
 *      submittedAt: string | null,
 *      title, description,          // what the coordinator wrote
 *      siteAddress,                 // where to go
 *      scheduledFor,                // when, if it is scheduled
 *      assigneeName,                // who it was handed to, for confirmation
 *      requestedFields: [{ key, label }],
 *      requestedDocuments: [{ key, label, type, comment }],
 *      photos: [{ id, filename, url, documentKey }]
 *    }
 */
export async function getSiteVisitTask(token) {
  return unwrap(await apiClient.get(`/public/site-visits/${encodeURIComponent(token)}`));
}

/**
 * body: { name, email?, phone?, fields: { [fieldKey]: value } }
 * At least one of email or phone is required — it is how the coordinator gets
 * back to them. Submitting notifies the coordinator and moves the task to
 * "submitted"; until then it stays pending.
 */
export async function submitSiteVisit(token, body) {
  return unwrap(await apiClient.post(`/public/site-visits/${encodeURIComponent(token)}`, body));
}

/**
 * One photo or document, uploaded as it is chosen rather than held until
 * submit — a site member on mobile data should not lose a dozen photos to one
 * failed request. `documentKey` ties the file to the slot it was asked for.
 * → { id, filename, url, documentKey }
 */
export async function uploadSiteVisitPhoto(token, file, documentKey) {
  const formData = new FormData();
  formData.append("file", file);
  if (documentKey) formData.append("documentKey", documentKey);
  return unwrap(
    await apiClient.post(`/public/site-visits/${encodeURIComponent(token)}/photos`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  );
}
