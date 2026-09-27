// Procurement & delivery (stage 6) workflow rules, mirrored from the Sydpro
// process chart: verify the BOQ/BOS, compare proposal against site (revising
// the BOQ where they differ), check the price variation, gather whichever
// approvals that variation calls for, send purchase orders and receive the
// deliveries, then create the Green Deal job. Pure functions over a job
// record, so the panels and the page agree on where a job is — and so the
// rules can move to prestige-be unchanged when the procurement API arrives.
// Until then the job records come from lib/mockData/procurement.js.

import {
  APPROVAL_TIERS,
  APPROVER_ROLES,
  AVAILABILITY,
  PROCUREMENT_STEPS,
  VARIATION_THRESHOLD_PCT,
} from "@/lib/mockData/procurement";

const qty = (value) => Number(value) || 0;
const isQuoted = (line) => line.quotedUnitCost !== null && line.quotedUnitCost !== undefined;

// ---- BOQ / BOS and its rounds -----------------------------------------------

/** The current round's lines. */
export function boqLines(job) {
  return Array.isArray(job?.boq) ? job.boq : [];
}

export function revisionsOf(job) {
  return Array.isArray(job?.revisions) ? job.revisions : [];
}

/** 1 for a BOQ never revised; each revision to the site figures adds one. */
export function currentRound(job) {
  return revisionsOf(job).length + 1;
}

/**
 * The accepted proposal's lines — round 1 — which the price variation is
 * always measured from, however many times the BOQ has been revised since.
 */
export function originalLines(job) {
  return revisionsOf(job)[0]?.lines ?? boqLines(job);
}

export function materialLines(job) {
  return boqLines(job).filter((line) => line.kind !== "service");
}

export function serviceLines(job) {
  return boqLines(job).filter((line) => line.kind === "service");
}

/** Lines where the site needs a different quantity from what was proposed, in the current round. */
export function mismatchedLines(job) {
  return boqLines(job).filter((line) => qty(line.proposalQty) !== qty(line.siteQty));
}

export function boqMatches(job) {
  return boqLines(job).length > 0 && mismatchedLines(job).length === 0;
}

/** True once every current line has a supplier's price against it. */
export function quotesReceived(job) {
  const lines = boqLines(job);
  return lines.length > 0 && lines.every(isQuoted);
}

export function quotedLineCount(job) {
  return boqLines(job).filter(isQuoted).length;
}

// ---- Availability -----------------------------------------------------------

/** { label, tone, detail } for a line's availability, worded for what the line is. */
export function availabilityOf(line) {
  const meta = AVAILABILITY[line?.availability] ?? AVAILABILITY.available;
  const label = line?.kind === "service" ? meta.service : meta.material;
  const detail = line?.leadTimeDays ? `${line.leadTimeDays} day${line.leadTimeDays === 1 ? "" : "s"}` : null;
  return { key: meta.key, label, tone: meta.tone, detail };
}

/** The longest lead time across the BOQ — the earliest everything can be on site. */
export function longestLeadTimeDays(job) {
  return boqLines(job).reduce((longest, line) => Math.max(longest, qty(line.leadTimeDays)), 0);
}

export function unavailableLines(job) {
  return boqLines(job).filter((line) => line.availability === "backorder");
}

// ---- Price variation --------------------------------------------------------

export function proposalTotal(job) {
  return originalLines(job).reduce((sum, line) => sum + qty(line.proposalQty) * qty(line.proposalUnitCost), 0);
}

export function quotedTotal(job) {
  return boqLines(job).reduce((sum, line) => sum + qty(line.siteQty) * qty(line.quotedUnitCost), 0);
}

/**
 * How far the quoted cost sits from the accepted proposal, as a signed
 * percentage — positive when it has gone up. Null until every line is
 * quoted, because a partial figure would read as a real one.
 */
export function priceVariationPct(job) {
  if (!quotesReceived(job)) return null;
  const base = proposalTotal(job);
  if (!base) return 0;
  return ((quotedTotal(job) - base) / base) * 100;
}

/**
 * Which approval tier a variation falls in: none | below | above. The chart
 * gates on the size of the variation, so a saving is treated the same as an
 * increase of the same size.
 */
export function variationTier(pct) {
  if (pct === null || pct === undefined) return null;
  const size = Math.abs(pct);
  if (size < 0.005) return "none";
  return size < VARIATION_THRESHOLD_PCT ? "below" : "above";
}

export function tierFor(job) {
  const tier = variationTier(priceVariationPct(job));
  return tier ? APPROVAL_TIERS[tier] : null;
}

// ---- Approvals --------------------------------------------------------------

export function requiredApprovers(job) {
  return tierFor(job)?.approvers ?? [];
}

export function approvalFor(job, roleCode) {
  return (job?.approvals ?? []).find((approval) => approval.role === roleCode) ?? null;
}

export function pendingApprovals(job) {
  return requiredApprovers(job).filter((role) => approvalFor(job, role)?.status !== "approved");
}

export function approvalsComplete(job) {
  return pendingApprovals(job).length === 0;
}

export function roleLabel(roleCode) {
  return APPROVER_ROLES[roleCode]?.label ?? roleCode;
}

// ---- Purchase orders & delivery ---------------------------------------------

export function purchaseOrders(job) {
  return Array.isArray(job?.purchaseOrders) ? job.purchaseOrders : [];
}

/** Orders that have actually gone to a supplier — drafts are prepared, not sent. */
export function sentOrders(job) {
  return purchaseOrders(job).filter((order) => order.status !== "draft");
}

export function purchaseOrdersSent(job) {
  return sentOrders(job).length > 0;
}

export function deliveredOrders(job) {
  return purchaseOrders(job).filter((order) => order.status === "delivered");
}

/** True when every sent order has been received on site. */
export function allDelivered(job) {
  const sent = sentOrders(job);
  return sent.length > 0 && sent.every((order) => order.status === "delivered");
}

/** True once the job may place orders: no variation, or every approval in. */
export function readyToOrder(job) {
  if (!quotesReceived(job)) return false;
  const tier = variationTier(priceVariationPct(job));
  return tier === "none" || approvalsComplete(job);
}

export function greenDealCreated(job) {
  return Boolean(job?.greenDeal?.created);
}

// ---- Where the job is -------------------------------------------------------

/**
 * The step a job is on, by PROCUREMENT_STEPS key, or "done" once construction
 * can take it. Read top to bottom it is the chart: no lines → verify; not all
 * quoted → matching and gathering quotes; a variation → approvals; then
 * orders out, then Green Deal.
 */
export function currentStep(job) {
  if (!boqLines(job).length) return "boq";
  if (!quotesReceived(job)) return "matching";
  if (!readyToOrder(job)) return "approvals";
  if (!purchaseOrdersSent(job)) return "delivery";
  return greenDealCreated(job) ? "done" : "green_deal";
}

/** Position of a step key in the flow; "done" sits one past the last step. */
export function stepIndex(key) {
  if (key === "done") return PROCUREMENT_STEPS.length;
  return PROCUREMENT_STEPS.findIndex((step) => step.key === key);
}

/** What a person needs to know about a job at a glance: { key, label, tone }. */
export function procurementStatus(job) {
  const step = currentStep(job);
  switch (step) {
    case "boq":
      return { key: step, label: "BOQ not verified", tone: "neutral" };
    case "matching": {
      const differ = mismatchedLines(job).length;
      return differ
        ? { key: step, label: `${differ} line${differ === 1 ? "" : "s"} to resolve`, tone: "warning" }
        : { key: step, label: "Getting quotes", tone: "info" };
    }
    case "approvals":
      return { key: step, label: `Awaiting ${pendingApprovals(job).map(roleLabel).join(" + ")}`, tone: "warning" };
    case "delivery":
      return { key: step, label: "Send purchase orders", tone: "info" };
    case "green_deal":
      return { key: step, label: "Create Green Deal job", tone: "info" };
    default:
      return allDelivered(job)
        ? { key: "done", label: "Ready for construction", tone: "success" }
        : { key: "done", label: "Awaiting deliveries", tone: "info" };
  }
}
