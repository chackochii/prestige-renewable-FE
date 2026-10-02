// Proposal (stage 3) rules shared by the proposals page, the stage-3 panel and
// the customer's page. The flow: sales sends the customer a link to their
// proposal from their own email — the device's email app or Gmail (the app
// opens it with the email written and downloads the PDF to attach); the
// customer accepts (the job moves on to Approvals), asks for changes (sales
// sends the job back to the estimator for a re-quote, then sends the revised
// version), or declines. Records come from services/api/proposalsApi.js.

import { formatDate } from "@/helpers/dateTimeHelpers";
import { formatCurrency } from "@/utils/formatCurrency";

export const PROPOSAL_STAGE_ID = 3;
export const ESTIMATION_STAGE_ID = 2;

/** Proposal statuses still waiting on the customer — the link can be answered. */
export const OPEN_STATUSES = ["issued", "presented"];

export const isOpen = (proposal) => Boolean(proposal) && OPEN_STATUSES.includes(proposal.status) && !proposal.expired;

/** Sales can act on it: waiting on the customer, or back with sales to revise. */
export const isLive = (proposal) => Boolean(proposal) && [...OPEN_STATUSES, "negotiation"].includes(proposal.status);

/** The customer said no to this one as it stands — the answers a re-quote starts from. */
export const wantsChanges = (proposal) => Boolean(proposal) && ["negotiation", "rejected"].includes(proposal.status);

/** A round of re-quoting still with the estimator. */
export const isRequoteOpen = (requote) => requote?.status === "open";

/** The badge a round shows: with the estimator, or back with the revised quote. */
export function requoteStatus(requote) {
  if (!requote) return null;
  return requote.status === "open" ? { label: "With the estimator", tone: "warning" } : { label: "Revised quote ready", tone: "success" };
}

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
    case "re-estimated":
      return { label: "Sent back for a re-quote", tone: "neutral" };
    case "withdrawn":
      return { label: "Replaced by a newer proposal", tone: "neutral" };
    default:
      return { label: proposal.status, tone: "neutral" };
  }
}

/**
 * Where a job stands on the proposals board, re-quote included: with the
 * estimator, or back with a revised quote that has not gone out yet. Falls
 * back to the proposal's own status.
 */
export function boardStatus(row) {
  const { proposal, requote } = row ?? {};
  if (isRequoteOpen(requote)) return { label: `With ${requote.estimator?.name || "the estimator"} — re-quote`, tone: "warning" };
  if (proposal?.status === "re-estimated" && requote?.status === "completed") return { label: "Revised quote ready — send it", tone: "info" };
  return proposalStatus(proposal && proposal.status !== "withdrawn" ? proposal : null);
}

/** How the customer's message reached us, for the attribution line under it. */
export function customerMessageSource(requote) {
  if (!requote?.customerMessage) return null;
  const who = requote.customerName || "The customer";
  if (requote.customerChannel === "customer") return `${who}, through the proposal link${requote.customerRespondedAt ? ` on ${formatDate(requote.customerRespondedAt, { withTime: true })}` : ""}`;
  if (requote.customerChannel === "staff") return `${who}, as recorded by sales${requote.customerRespondedAt ? ` on ${formatDate(requote.customerRespondedAt, { withTime: true })}` : ""}`;
  return `${who}, as told to ${requote.requestedBy?.name || "sales"}`;
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
 *   draft — nothing sent (or only withdrawn ones, or a revised quote back
 *   from the estimator and not sent yet), waiting — with the customer,
 *   changes — the customer asked to renegotiate, requote — with the
 *   estimator, accepted, declined.
 */
export function boardBucket(row) {
  if (isRequoteOpen(row?.requote)) return "requote";
  const status = row?.proposal?.status;
  if (!status || status === "withdrawn" || status === "re-estimated") return "draft";
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

/** The same, for a proposal sent after the customer asked for changes. */
export const REVISED_MESSAGE = [
  "Thank you for your feedback. We have revised your proposal as requested — you can view and download the updated version from the link below, and accept it online when you are happy to go ahead.",
  "",
  "If anything else needs changing, use the same link to let us know.",
].join("\n");

/**
 * The email as the customer reads it: greeting, the sender's message, the
 * link to view and answer the proposal, and the sign-off. Plain text, because
 * an email link can only carry plain text.
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
 * A mailto: link with the email filled in. It opens the email app already
 * signed in on the sender's device (Outlook, Mail, or Gmail when the browser
 * hands mail links to it). Like any email link it carries the recipient,
 * subject and body only — a file cannot be attached this way, so the PDF is
 * downloaded alongside for the sender to drag in.
 */
export function mailtoUrl({ to, subject, body }) {
  // encodeURIComponent, not URLSearchParams: a "+" is a literal plus in a
  // mailto link, so spaces must be %20. Line breaks go as CRLF (RFC 6068).
  const q = (value) => encodeURIComponent(value || "");
  const crlf = (value) => String(value || "").replace(/\r?\n/g, "\r\n");
  return `mailto:${q(to).replace(/%40/g, "@")}?subject=${q(subject)}&body=${q(crlf(body))}`;
}

/**
 * Gmail's compose window with the email filled in, in the form Gmail uses
 * today: /mail/u/0/?tf=cm with to, su and body. (The older ?view=cm&fs=1 is
 * redirected to this, and the ?extsrc=mailto&url= mail-handler form is no
 * longer reliable.) Spaces go as %20; when the browser has to sign in or pick
 * an account first, Google's sign-in page turns them into "+", which this
 * form reads as spaces too. /u/0/ is the account the browser is signed in to
 * first. Gmail on an iPhone's Safari opens the inbox instead of compose —
 * there, the email app button is the one to use.
 */
export function gmailComposeUrl({ to, subject, body }) {
  const q = (value) => encodeURIComponent(value || "");
  return `https://mail.google.com/mail/u/0/?tf=cm&fs=1&to=${q(to)}&su=${q(subject)}&body=${q(body)}`;
}

/**
 * Hands a mailto: link to the device's email app. Mail links do not leave the
 * page, so this is safe after waiting on the server.
 */
export function openMailApp(url) {
  const link = document.createElement("a");
  link.href = url;
  link.rel = "noreferrer";
  link.click();
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
