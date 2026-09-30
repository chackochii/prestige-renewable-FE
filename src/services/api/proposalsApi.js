// Proposals (stage 3): sales sends the customer a link to their proposal from
// their own email app or Gmail (the server sends no mail), and the customer answers it
// there — accept (the job moves on to Approvals), ask to renegotiate, or
// decline. See prestige-be proposalService.js.
//
// A proposal as staff see it:
//   { id, number, version, status, expired, grandTotal,
//     quoteVersion: { id, version, quoteNumber },
//     sentTo, sentBy: { id, name }, sentAt, expiresAt,
//     emailSubject, emailMessage,
//     viewedAt, viewCount,
//     response: "accepted" | "rejected" | "renegotiate" | null, respondedAt, responseName, responseNote,
//     responseChannel: "customer" | "staff" | null, recordedBy }
// status: issued (sent) → presented (opened) → accepted | rejected | negotiation;
// withdrawn when a newer proposal replaced it before it was answered.

import { apiClient, unwrap } from "./client";

/** Stage-3 jobs with their latest proposal and quote, plus ones answered in the last 30 days. */
export async function getProposalBoard({ businessUnitId, search } = {}) {
  return unwrap(await apiClient.get("/opportunities/proposals", { params: { businessUnitId, search: search || undefined } }));
}

/** Every proposal sent on a job, newest first. */
export async function listProposals(opportunityId) {
  return unwrap(await apiClient.get(`/opportunities/${opportunityId}/proposals`));
}

/**
 * body: { quoteVersionId, to?, subject?, message? } → { proposal, link }
 * The link is only ever returned here — it goes into the email the app opens
 * in the sender's email app or Gmail.
 */
export async function sendProposal(opportunityId, body) {
  return unwrap(await apiClient.post(`/opportunities/${opportunityId}/proposals`, body));
}

/** A fresh link for a proposal still waiting on the customer; the old one stops working. → { proposal, link } */
export async function resendProposal(opportunityId, proposalId, body = {}) {
  return unwrap(await apiClient.post(`/opportunities/${opportunityId}/proposals/${proposalId}/resend`, body));
}

/** An answer the customer gave by phone. body: { outcome, note?, customerName? } → { proposal, opportunity } */
export async function recordProposalOutcome(opportunityId, proposalId, body) {
  return unwrap(await apiClient.post(`/opportunities/${opportunityId}/proposals/${proposalId}/outcome`, body));
}

// ---- Public: the customer's link (no sign-in) ----

/**
 * → { state: "open" | "expired" | "accepted" | "rejected" | "negotiation" | "withdrawn",
 *     number, version, sentAt, expiresAt, grandTotal, customerName,
 *     business: { name, legalName }, contact: { name, email, phone } | null, message,
 *     quoteVersion: { version, snapshot, createdAt } | null,
 *     response: { decision, at, name, note } | null }
 */
export async function getPublicProposal(token) {
  return unwrap(await apiClient.get(`/public/proposals/${encodeURIComponent(token)}`));
}

/** body: { decision: "accept" | "renegotiate" | "reject", name, note?, agree? } → the same shape, answered */
export async function respondToProposal(token, body) {
  return unwrap(await apiClient.post(`/public/proposals/${encodeURIComponent(token)}/respond`, body));
}
