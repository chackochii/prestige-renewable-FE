// Proposal (stage 3) rules shared by the proposals page, the stage-3 panel and
// the customer's page. The flow: sales sends the customer a link to their
// proposal from their own Gmail (the app opens it with the email written and
// downloads the PDF to attach); the customer accepts (the job moves on to
// Approvals), asks to renegotiate (sales revises the quote and sends a new
// version), or declines. Records come from services/api/proposalsApi.js.

import { formatDate } from "@/helpers/dateTimeHelpers";
import { formatCurrency } from "@/utils/formatCurrency";

export const PROPOSAL_STAGE_ID = 3;

/** Proposal statuses still waiting on the customer — the link can be answered. */
export const OPEN_STATUSES = ["issued", "presented"];

export const isOpen = (proposal) => Boolean(proposal) && OPEN_STATUSES.includes(proposal.status) && !proposal.expired;

/** Sales can act on it: waiting on the customer, or back with sales to revise. */
export const isLive = (proposal) => Boolean(proposal) && [...OPEN_STATUSES, "negotiation"].includes(proposal.status);

/** How a proposal reads in a list: { label, tone }. */
export function proposalStatus(proposal) {
  if (!proposal) return { label: "Not sent yet", tone: "neutral" };
  switch (proposal.status) {
    case "issued":
      return proposal.expired ? { label: "Link expired", tone: "danger" } : { label: "Sent — not opened yet", tone: "info" };
    case "presented":
      return proposal.expired ? { label: "Link expired", tone: "danger" } : { label: "Opened — awaiting answer", tone: "warning" };
    case "negotiation":
      return { label: "Customer wants changes", tone: "warning" };
    case "accepted":
      return { label: "Accepted — to Approvals", tone: "success" };
    case "rejected":
      return { label: "Declined", tone: "danger" };
    case "withdrawn":
      return { label: "Replaced by a newer proposal", tone: "neutral" };
    default:
      return { label: proposal.status, tone: "neutral" };
  }
}

/** The customer's answer in a sentence, for history-style rows. */
export function responseSummary(proposal) {
  if (!proposal?.response) return null;
  const who = proposal.responseName || "The customer";
  const how = proposal.responseChannel === "staff" ? ` (recorded by ${proposal.recordedBy?.name || "sales"})` : " (online)";
  const verb = { accepted: "accepted", rejected: "declined", renegotiate: "asked for changes" }[proposal.response] ?? proposal.response;
  return `${who} ${verb}${how}`;
}

/**
 * Which pile a job on the proposals board sits in:
 *   draft — nothing sent (or only withdrawn ones), waiting — with the customer,
 *   changes — the customer asked to renegotiate, accepted, declined.
 */
export function boardBucket(row) {
  const status = row?.proposal?.status;
  if (!status || status === "withdrawn") return "draft";
  if (OPEN_STATUSES.includes(status)) return "waiting";
  if (status === "negotiation") return "changes";
  if (status === "accepted") return "accepted";
  if (status === "rejected") return "declined";
  return "draft";
}

/**
 * The message the sender starts from; they can change every word of it.
 * proposalEmailBody adds the greeting ("Hi Alex,"), the link and the sign-off.
 */
export const DEFAULT_MESSAGE = [
  "Thank you for the opportunity to quote. Your proposal is ready — you can view and download it from the link below, and accept it online when you are happy to go ahead.",
  "",
  "If you would like anything changed, use the same link to let us know and we will revise it for you.",
].join("\n");

/**
 * The email as the customer reads it: greeting, the sender's message, the
 * link to view and answer the proposal, and the sign-off. Plain text, because
 * a Gmail compose link can only carry plain text.
 */
export function proposalEmailBody({ customerFirstName, message, link, proposal, senderName, businessName }) {
  const total = proposal?.grandTotal !== null && proposal?.grandTotal !== undefined ? formatCurrency(proposal.grandTotal, { withCents: true }) : "";
  return [
    `Hi ${customerFirstName || "there"},`,
    "",
    message || DEFAULT_MESSAGE,
    "",
    `View your proposal${proposal?.number ? ` ${proposal.number}` : ""}${total ? ` (${total})` : ""} and accept it online:`,
    link,
    "",
    `From the link you can also download the PDF, ask us for changes, or decline.${proposal?.expiresAt ? ` The link is valid until ${formatDate(proposal.expiresAt)}.` : ""}`,
    "",
    "Kind regards,",
    [senderName, businessName].filter(Boolean).join("\n"),
  ].join("\n");
}

/**
 * Gmail's compose window with the email filled in. Gmail compose links carry
 * the recipient, subject and body only — a file cannot be attached this way,
 * so the PDF is downloaded alongside for the sender to drag in.
 */
export function gmailComposeUrl({ to, subject, body }) {
  // encodeURIComponent rather than URLSearchParams: spaces must arrive as %20,
  // not "+", or Gmail shows the plus signs in the subject and body.
  const q = (value) => encodeURIComponent(value || "");
  return `https://mail.google.com/mail/?view=cm&fs=1&to=${q(to)}&su=${q(subject)}&body=${q(body)}`;
}

/**
 * A blank tab opened straight from a click, to be pointed at Gmail once the
 * proposal link is back from the server. Browsers only let a click open a
 * tab; one opened after waiting on a request is blocked as a popup. Null when
 * the browser refused anyway — the caller then offers a plain "Open Gmail".
 */
export function openPendingTab() {
  const tab = window.open("", "_blank");
  if (!tab) return null;
  try {
    tab.document.title = "Opening Gmail…";
    tab.document.body.innerHTML = '<p style="font:15px system-ui,sans-serif;padding:24px">Preparing your email…</p>';
  } catch {
    // A tab we cannot write to still navigates fine.
  }
  return tab;
}

/** Sends a tab opened by openPendingTab to `url`; false when there was no tab to send. */
export function navigateTab(tab, url) {
  if (!tab || tab.closed) return false;
  // Gmail gets no handle back on this app.
  tab.opener = null;
  tab.location.href = url;
  return true;
}
