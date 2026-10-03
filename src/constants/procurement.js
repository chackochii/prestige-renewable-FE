// Procurement & delivery (stage 6): the stage, its steps and the vocabulary
// the records use — mirrored by prestige-be procurementService.js, which is
// where the rules are enforced. The checklists themselves are in
// constants/procurementChecklists.js.
//
// The workflow follows the Sydpro process chart for this stage:
//
//   BOQ / BOS availability & verification
//     → proposal BOQ vs actual site BOQ match?   yes: start getting quotes
//     → price variation?                         no:  start sending POs
//         below 5%  → sales manager approves
//         above 5%  → owner + sales manager approve
//         (and the BOQ is revised to the site figures — a new round, re-matched)
//     → all approvals received?                  no:  high-priority notifications
//     → purchase orders sent, deliveries scheduled and received
//     → Green Deal job creation
//     → Construction & commissioning

export const PROCUREMENT_STAGE = {
  id: 6,
  key: "procurement",
  label: "Procurement & delivery",
  next: { id: 7, key: "site_works", short: "Construction", label: "Construction & commissioning" },
};

/** A quoted cost this far from the proposal needs the owner as well as sales (prestige-be approvalPolicy). */
export const VARIATION_THRESHOLD_PCT = 5;

export const PROCUREMENT_STEPS = [
  {
    key: "boq",
    short: "BOQ / BOS",
    label: "BOQ / BOS availability & verification",
    description: "The bill of quantities and services from the accepted quote, checked against what the site needs and what suppliers can supply.",
  },
  {
    key: "matching",
    short: "Matching",
    label: "Proposal BOQ vs actual site BOQ",
    description: "Where the two agree, procurement starts getting quotes. Where they differ, the BOQ is revised to the site figures — a new round.",
  },
  {
    key: "variation",
    short: "Variation",
    label: "Price variation check",
    description: "Quoted cost against the accepted proposal. No variation means purchase orders can go out straight away.",
  },
  {
    key: "approvals",
    short: "Approvals",
    label: "Required approvals",
    description: "Who has to sign off depends on how far the price moved. Nothing is ordered until they all have.",
  },
  {
    key: "delivery",
    short: "POs & delivery",
    label: "Purchase orders & delivery",
    description: "Orders placed with suppliers, deliveries scheduled around lead times and received on site.",
  },
  {
    key: "green_deal",
    short: "Green Deal",
    label: "Green Deal job creation",
    description: "The job is registered in Green Deal and handed to construction.",
  },
];

/** Role codes match prestige-be's role catalogue (seeders/roles-permissions.cjs). */
export const APPROVER_ROLES = {
  SMM: { code: "SMM", label: "Sales manager" },
  BO: { code: "BO", label: "Business owner" },
};

export const APPROVAL_TIERS = {
  none: {
    key: "none",
    label: "No variation",
    approvers: [],
    rule: "The quoted cost matches the proposal — procurement can start sending purchase orders.",
    tone: "success",
  },
  below: {
    key: "below",
    label: `Below ${VARIATION_THRESHOLD_PCT}%`,
    approvers: ["SMM"],
    rule: `A variation under ${VARIATION_THRESHOLD_PCT}% needs approval from the sales manager.`,
    tone: "warning",
  },
  above: {
    key: "above",
    label: `${VARIATION_THRESHOLD_PCT}% or more`,
    approvers: ["BO", "SMM"],
    rule: `A variation of ${VARIATION_THRESHOLD_PCT}% or more needs approval from the business owner and the sales manager.`,
    tone: "danger",
  },
};

/** BOQ is what gets bought; BOS is who does the work. Both are priced and both can vary. */
export const LINE_KINDS = {
  material: { key: "material", label: "Materials (BOQ)" },
  service: { key: "service", label: "Services (BOS)" },
};

/** Whether a line can be had when it is needed — the "availability" in the chart's first box. */
export const AVAILABILITY = {
  available: { key: "available", tone: "success", material: "In stock", service: "Crew available" },
  lead_time: { key: "lead_time", tone: "warning", material: "Lead time", service: "Booked out" },
  backorder: { key: "backorder", tone: "danger", material: "Back-ordered", service: "Unavailable" },
};

export const PO_STATUSES = {
  draft: { key: "draft", label: "Draft", tone: "neutral" },
  sent: { key: "sent", label: "Sent", tone: "info" },
  confirmed: { key: "confirmed", label: "Confirmed", tone: "info" },
  scheduled: { key: "scheduled", label: "Delivery scheduled", tone: "warning" },
  delivered: { key: "delivered", label: "Delivered", tone: "success" },
};

/**
 * Where a checklist's uploads are filed on the job (the attachment category
 * the API takes — prestige-be leadAttachmentService ATTACHMENT_CATEGORIES).
 */
export const UPLOAD_CATEGORY_FOR_ITEM = {
  quoteFile: "supplier_quote",
  finalQuoteFile: "supplier_quote",
  poRecords: "purchase_order",
  receiptFiles: "delivery_receipt",
  discrepancyPhotos: "delivery_receipt",
};
