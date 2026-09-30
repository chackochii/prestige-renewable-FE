// Procurement & delivery (stage 6) — hardcoded data for the workflow screens.
//
// Everything on the procurement page reads from here until the purchase-order
// service is connected to prestige-be. The shape is the one the API is
// expected to return, so wiring it up later means swapping this import for a
// slice, not reworking the panels.
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
//
// Every step "records the same in the history tab", so each job carries its
// history alongside the records that produced it.

export const PROCUREMENT_STAGE = {
  id: 6,
  key: "procurement",
  label: "Procurement & delivery",
  slaDays: 10,
  next: { id: 7, key: "site_works", short: "Construction", label: "Construction & commissioning" },
};

/** A quoted cost this far from the proposal needs the owner as well as sales. */
export const VARIATION_THRESHOLD_PCT = 5;

export const PROCUREMENT_STEPS = [
  {
    key: "boq",
    short: "BOQ / BOS",
    label: "BOQ / BOS availability & verification",
    description: "The bill of quantities and services from the proposal, checked against what the site needs and what suppliers can supply.",
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
    label: `Above ${VARIATION_THRESHOLD_PCT}%`,
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

/** The admin team behind this stage — shared with approvals (see ./adminTeam). */
export { ADMIN_TEAM } from "./adminTeam";

// ---- Jobs -------------------------------------------------------------------
// Four jobs, each parked at a different point in the flow so every branch of
// the chart has something to show:
//   0027 — matched, no variation, POs delivered, Green Deal created (the happy path)
//   0031 — one line differs, variation under 5%, sales manager still to approve
//   0033 — BOQ revised (round 2), variation over 5%, owner approved, sales manager pending
//   0035 — matched, quotes still coming in
//
// `boq` is the current round. `revisions` holds earlier rounds, oldest first;
// the first of them is the accepted proposal the variation is measured from.

export const PROCUREMENT_JOBS = [
  {
    id: 27,
    number: "PRS-26-0027",
    customer: "Harbourview Apartments",
    site: "14 Wharf Rd, Birchgrove NSW 2041",
    acceptedValue: 48600,
    salesperson: "Daniel Reyes",
    coordinator: "Arshitha",
    enteredAt: "2026-09-16T00:30:00Z",
    slaDueAt: "2026-09-26T00:30:00Z",
    revisions: [],
    boq: [
      { key: "panel", kind: "material", item: "Solar panel 440 W", brand: "Jinko Tiger Neo", unit: "ea", proposalQty: 40, siteQty: 40, proposalUnitCost: 210, quotedUnitCost: 210, supplier: "Solar Juice", availability: "available" },
      { key: "inverter", kind: "material", item: "Hybrid inverter 10 kW", brand: "Sungrow SH10RT", unit: "ea", proposalQty: 1, siteQty: 1, proposalUnitCost: 2950, quotedUnitCost: 2950, supplier: "Solar Juice", availability: "available" },
      { key: "battery", kind: "material", item: "Battery module 9.6 kWh", brand: "Sungrow SBR096", unit: "ea", proposalQty: 2, siteQty: 2, proposalUnitCost: 5400, quotedUnitCost: 5400, supplier: "Solar Juice", availability: "available" },
      { key: "rail", kind: "material", item: "Mounting rail 4.2 m", brand: "Clenergy", unit: "ea", proposalQty: 24, siteQty: 24, proposalUnitCost: 38, quotedUnitCost: 38, supplier: "Krannich", availability: "available" },
      { key: "cable", kind: "material", item: "DC solar cable 6 mm²", brand: "Prysmian", unit: "m", proposalQty: 120, siteQty: 120, proposalUnitCost: 2.4, quotedUnitCost: 2.4, supplier: "Krannich", availability: "available" },
      { key: "labour", kind: "service", item: "Installation labour", brand: "Sydpro crew", unit: "day", proposalQty: 3, siteQty: 3, proposalUnitCost: 1400, quotedUnitCost: 1400, supplier: "Sydpro crew", availability: "available" },
      { key: "electrical", kind: "service", item: "Electrical connection & commissioning", brand: "Volt Electrical", unit: "lot", proposalQty: 1, siteQty: 1, proposalUnitCost: 2200, quotedUnitCost: 2200, supplier: "Volt Electrical", availability: "available" },
    ],
    quotes: [
      { supplier: "Solar Juice", receivedAt: "2026-09-18T03:10:00Z", total: 22150, validUntil: "2026-10-18" },
      { supplier: "Krannich", receivedAt: "2026-09-18T05:45:00Z", total: 1200, validUntil: "2026-10-16" },
      { supplier: "Volt Electrical", receivedAt: "2026-09-18T06:20:00Z", total: 2200, validUntil: "2026-10-30" },
    ],
    purchaseOrders: [
      { number: "PO-26-0112", supplier: "Solar Juice", status: "delivered", lines: ["panel", "inverter", "battery"], total: 22150, sentAt: "2026-09-19T01:00:00Z", deliveryEta: "2026-09-25", scheduledFor: "2026-09-25", deliveredAt: "2026-09-25T02:30:00Z", receivedBy: "Hema" },
      { number: "PO-26-0113", supplier: "Krannich", status: "delivered", lines: ["rail", "cable"], total: 1200, sentAt: "2026-09-19T01:20:00Z", deliveryEta: "2026-09-23", scheduledFor: "2026-09-23", deliveredAt: "2026-09-23T04:00:00Z", receivedBy: "Hema" },
    ],
    approvals: [],
    notifications: [],
    greenDeal: { created: true, jobId: "GD-88412", createdAt: "2026-09-22T22:40:00Z", by: "Monisha" },
    history: [
      { at: "2026-09-16T00:30:00Z", by: "System", action: "Entered Procurement & delivery", detail: "SLA 10 days" },
      { at: "2026-09-17T02:15:00Z", by: "Arshitha", action: "BOQ / BOS verified", detail: "All 7 lines match the site requirement; everything in stock" },
      { at: "2026-09-17T02:20:00Z", by: "Arshitha", action: "Started getting quotes", detail: "Solar Juice, Krannich, Volt Electrical" },
      { at: "2026-09-18T06:20:00Z", by: "Arshitha", action: "Quotes received", detail: "No price variation against the proposal" },
      { at: "2026-09-19T01:20:00Z", by: "Arshitha", action: "Purchase orders sent", detail: "PO-26-0112, PO-26-0113" },
      { at: "2026-09-20T23:00:00Z", by: "Arshitha", action: "Deliveries scheduled", detail: "Krannich 23 Sept, Solar Juice 25 Sept — site access confirmed with Hema" },
      { at: "2026-09-22T22:40:00Z", by: "Monisha", action: "Green Deal job created", detail: "GD-88412" },
      { at: "2026-09-23T04:00:00Z", by: "Hema", action: "Delivery received", detail: "PO-26-0113 — mounting rail and cable on site" },
      { at: "2026-09-25T02:30:00Z", by: "Hema", action: "Delivery received", detail: "PO-26-0112 — panels, inverter and batteries on site" },
    ],
  },
  {
    id: 31,
    number: "PRS-26-0031",
    customer: "Bakehouse Cafe",
    site: "212 Darling St, Balmain NSW 2041",
    acceptedValue: 21900,
    salesperson: "Priya Nair",
    coordinator: "Arshitha",
    enteredAt: "2026-09-15T23:10:00Z",
    slaDueAt: "2026-09-25T23:10:00Z",
    revisions: [],
    boq: [
      { key: "panel", kind: "material", item: "Solar panel 440 W", brand: "Jinko Tiger Neo", unit: "ea", proposalQty: 20, siteQty: 22, proposalUnitCost: 210, quotedUnitCost: 210, supplier: "Solar Juice", availability: "lead_time", leadTimeDays: 7 },
      { key: "inverter", kind: "material", item: "Hybrid inverter 8 kW", brand: "Fronius Primo GEN24 Plus", unit: "ea", proposalQty: 1, siteQty: 1, proposalUnitCost: 2380, quotedUnitCost: 2380, supplier: "Solar Juice", availability: "available" },
      { key: "battery", kind: "material", item: "Battery 10.2 kWh", brand: "BYD Battery-Box HVS", unit: "ea", proposalQty: 1, siteQty: 1, proposalUnitCost: 6100, quotedUnitCost: 6100, supplier: "Solar Juice", availability: "available" },
      { key: "rail", kind: "material", item: "Mounting rail 4.2 m", brand: "Clenergy", unit: "ea", proposalQty: 12, siteQty: 12, proposalUnitCost: 38, quotedUnitCost: 38, supplier: "Krannich", availability: "available" },
      { key: "isolator", kind: "material", item: "DC isolator", brand: "IMO", unit: "ea", proposalQty: 2, siteQty: 2, proposalUnitCost: 64, quotedUnitCost: 64, supplier: "Krannich", availability: "available" },
      { key: "labour", kind: "service", item: "Installation labour", brand: "Sydpro crew", unit: "day", proposalQty: 2, siteQty: 2, proposalUnitCost: 1400, quotedUnitCost: 1400, supplier: "Sydpro crew", availability: "available" },
      { key: "electrical", kind: "service", item: "Electrical connection & commissioning", brand: "Volt Electrical", unit: "lot", proposalQty: 1, siteQty: 1, proposalUnitCost: 1600, quotedUnitCost: 1600, supplier: "Volt Electrical", availability: "lead_time", leadTimeDays: 10 },
    ],
    quotes: [
      { supplier: "Solar Juice", receivedAt: "2026-09-17T01:30:00Z", total: 13100, validUntil: "2026-10-17" },
      { supplier: "Krannich", receivedAt: "2026-09-17T04:05:00Z", total: 584, validUntil: "2026-10-15" },
      { supplier: "Volt Electrical", receivedAt: "2026-09-17T04:40:00Z", total: 1600, validUntil: "2026-10-31" },
    ],
    purchaseOrders: [
      { number: "PO-26-0118", supplier: "Solar Juice", status: "draft", lines: ["panel", "inverter", "battery"], total: 13100, sentAt: null, deliveryEta: null, scheduledFor: null, deliveredAt: null, receivedBy: null },
      { number: "PO-26-0119", supplier: "Krannich", status: "draft", lines: ["rail", "isolator"], total: 584, sentAt: null, deliveryEta: null, scheduledFor: null, deliveredAt: null, receivedBy: null },
    ],
    approvals: [{ role: "SMM", approver: "Sam Okafor", status: "pending", requestedAt: "2026-09-17T05:00:00Z" }],
    notifications: [
      { at: "2026-09-17T05:00:00Z", to: "Sam Okafor (Sales manager)", priority: "high", message: "Price variation of 2.4% on PRS-26-0031 needs your approval" },
      { at: "2026-09-19T05:00:00Z", to: "Sam Okafor (Sales manager)", priority: "high", message: "Reminder — approval on PRS-26-0031 outstanding for 2 days" },
      { at: "2026-09-23T05:00:00Z", to: "Sam Okafor (Sales manager)", priority: "high", message: "Reminder — approval on PRS-26-0031 outstanding for 6 days; stage SLA due 25 Sept" },
    ],
    greenDeal: { created: false },
    history: [
      { at: "2026-09-15T23:10:00Z", by: "System", action: "Entered Procurement & delivery", detail: "SLA 10 days" },
      { at: "2026-09-16T02:40:00Z", by: "Arshitha", action: "BOQ / BOS verified", detail: "Site needs 22 panels, proposal has 20 — roof survey found room for one more string. Panels on 7-day lead time" },
      { at: "2026-09-16T02:45:00Z", by: "Arshitha", action: "Started getting quotes", detail: "Solar Juice, Krannich, Volt Electrical" },
      { at: "2026-09-17T04:40:00Z", by: "Arshitha", action: "Quotes received", detail: "Two extra panels at the site figure — variation 2.4% against the proposal" },
      { at: "2026-09-17T05:00:00Z", by: "System", action: "Approval requested", detail: "Below 5% — sales manager (Sam Okafor)" },
      { at: "2026-09-17T05:30:00Z", by: "Arshitha", action: "Purchase orders drafted", detail: "PO-26-0118, PO-26-0119 — to send once approved" },
      { at: "2026-09-23T05:00:00Z", by: "System", action: "High-priority reminder sent", detail: "Sales manager approval outstanding; stage SLA due 25 Sept" },
    ],
  },
  {
    id: 33,
    number: "PRS-26-0033",
    customer: "Northgate Logistics",
    site: "8 Distribution Dr, Eastern Creek NSW 2766",
    acceptedValue: 96400,
    salesperson: "Daniel Reyes",
    coordinator: "Arshitha",
    enteredAt: "2026-09-18T00:00:00Z",
    slaDueAt: "2026-09-28T00:00:00Z",
    // Round 1 is the accepted proposal. The site measure found a longer cable
    // run and more rail, so the BOQ was revised to the site figures (round 2,
    // below) and re-matched; the variation is still measured from round 1.
    revisions: [
      {
        round: 1,
        at: "2026-09-19T03:20:00Z",
        by: "Arshitha",
        reason: "Site measure found a longer cable run and extra rail than the drawings showed — quantities revised to the site figures",
        lines: [
          { key: "panel", kind: "material", item: "Solar panel 550 W", brand: "Trina Vertex", unit: "ea", proposalQty: 90, siteQty: 90, proposalUnitCost: 245, quotedUnitCost: null, supplier: "Solar Juice", availability: "lead_time", leadTimeDays: 14 },
          { key: "inverter", kind: "material", item: "Three-phase inverter 50 kW", brand: "Sungrow SG50CX", unit: "ea", proposalQty: 1, siteQty: 1, proposalUnitCost: 7900, quotedUnitCost: null, supplier: "Solar Juice", availability: "backorder", leadTimeDays: 21 },
          { key: "switchboard", kind: "material", item: "Main switchboard upgrade", brand: "NHP", unit: "lot", proposalQty: 1, siteQty: 1, proposalUnitCost: 6200, quotedUnitCost: null, supplier: "Lawrence & Hanson", availability: "lead_time", leadTimeDays: 10 },
          { key: "rail", kind: "material", item: "Mounting rail 4.2 m", brand: "Clenergy", unit: "ea", proposalQty: 54, siteQty: 60, proposalUnitCost: 38, quotedUnitCost: null, supplier: "Krannich", availability: "available" },
          { key: "cable", kind: "material", item: "AC cable 16 mm² 4-core", brand: "Prysmian", unit: "m", proposalQty: 80, siteQty: 110, proposalUnitCost: 9.8, quotedUnitCost: null, supplier: "Lawrence & Hanson", availability: "available" },
          { key: "labour", kind: "service", item: "Installation labour", brand: "Sydpro crew", unit: "day", proposalQty: 6, siteQty: 6, proposalUnitCost: 1400, quotedUnitCost: null, supplier: "Sydpro crew", availability: "available" },
          { key: "crane", kind: "service", item: "Crane hire", brand: "Westside Cranes", unit: "day", proposalQty: 1, siteQty: 1, proposalUnitCost: 1800, quotedUnitCost: null, supplier: "Westside Cranes", availability: "lead_time", leadTimeDays: 5 },
          { key: "electrical", kind: "service", item: "Electrical works & commissioning", brand: "Volt Electrical", unit: "lot", proposalQty: 1, siteQty: 1, proposalUnitCost: 5200, quotedUnitCost: null, supplier: "Volt Electrical", availability: "available" },
        ],
      },
    ],
    boq: [
      { key: "panel", kind: "material", item: "Solar panel 550 W", brand: "Trina Vertex", unit: "ea", proposalQty: 90, siteQty: 90, proposalUnitCost: 245, quotedUnitCost: 262, supplier: "Solar Juice", availability: "lead_time", leadTimeDays: 14 },
      { key: "inverter", kind: "material", item: "Three-phase inverter 50 kW", brand: "Sungrow SG50CX", unit: "ea", proposalQty: 1, siteQty: 1, proposalUnitCost: 7900, quotedUnitCost: 8350, supplier: "Solar Juice", availability: "backorder", leadTimeDays: 21 },
      { key: "switchboard", kind: "material", item: "Main switchboard upgrade", brand: "NHP", unit: "lot", proposalQty: 1, siteQty: 1, proposalUnitCost: 6200, quotedUnitCost: 6800, supplier: "Lawrence & Hanson", availability: "lead_time", leadTimeDays: 10 },
      { key: "rail", kind: "material", item: "Mounting rail 4.2 m", brand: "Clenergy", unit: "ea", proposalQty: 60, siteQty: 60, proposalUnitCost: 38, quotedUnitCost: 38, supplier: "Krannich", availability: "available" },
      { key: "cable", kind: "material", item: "AC cable 16 mm² 4-core", brand: "Prysmian", unit: "m", proposalQty: 110, siteQty: 110, proposalUnitCost: 9.8, quotedUnitCost: 9.8, supplier: "Lawrence & Hanson", availability: "available" },
      { key: "labour", kind: "service", item: "Installation labour", brand: "Sydpro crew", unit: "day", proposalQty: 6, siteQty: 6, proposalUnitCost: 1400, quotedUnitCost: 1400, supplier: "Sydpro crew", availability: "available" },
      { key: "crane", kind: "service", item: "Crane hire", brand: "Westside Cranes", unit: "day", proposalQty: 1, siteQty: 1, proposalUnitCost: 1800, quotedUnitCost: 1800, supplier: "Westside Cranes", availability: "lead_time", leadTimeDays: 5 },
      { key: "electrical", kind: "service", item: "Electrical works & commissioning", brand: "Volt Electrical", unit: "lot", proposalQty: 1, siteQty: 1, proposalUnitCost: 5200, quotedUnitCost: 5200, supplier: "Volt Electrical", availability: "available" },
    ],
    quotes: [
      { supplier: "Solar Juice", receivedAt: "2026-09-20T02:00:00Z", total: 31930, validUntil: "2026-10-20" },
      { supplier: "Lawrence & Hanson", receivedAt: "2026-09-20T06:30:00Z", total: 7878, validUntil: "2026-10-04" },
      { supplier: "Krannich", receivedAt: "2026-09-21T00:15:00Z", total: 2280, validUntil: "2026-10-21" },
      { supplier: "Westside Cranes", receivedAt: "2026-09-21T00:40:00Z", total: 1800, validUntil: "2026-10-21" },
      { supplier: "Volt Electrical", receivedAt: "2026-09-21T01:10:00Z", total: 5200, validUntil: "2026-10-31" },
    ],
    purchaseOrders: [
      { number: "PO-26-0121", supplier: "Solar Juice", status: "draft", lines: ["panel", "inverter"], total: 31930, sentAt: null, deliveryEta: null, scheduledFor: null, deliveredAt: null, receivedBy: null },
      { number: "PO-26-0122", supplier: "Lawrence & Hanson", status: "draft", lines: ["switchboard", "cable"], total: 7878, sentAt: null, deliveryEta: null, scheduledFor: null, deliveredAt: null, receivedBy: null },
      { number: "PO-26-0123", supplier: "Krannich", status: "draft", lines: ["rail"], total: 2280, sentAt: null, deliveryEta: null, scheduledFor: null, deliveredAt: null, receivedBy: null },
    ],
    approvals: [
      { role: "BO", approver: "Ravi Shankar", status: "approved", requestedAt: "2026-09-21T01:30:00Z", decidedAt: "2026-09-22T23:30:00Z" },
      { role: "SMM", approver: "Sam Okafor", status: "pending", requestedAt: "2026-09-21T01:30:00Z" },
    ],
    notifications: [
      { at: "2026-09-21T01:30:00Z", to: "Ravi Shankar (Business owner)", priority: "high", message: "Price variation of 5.7% on PRS-26-0033 needs your approval" },
      { at: "2026-09-21T01:30:00Z", to: "Sam Okafor (Sales manager)", priority: "high", message: "Price variation of 5.7% on PRS-26-0033 needs your approval" },
      { at: "2026-09-23T01:30:00Z", to: "Sam Okafor (Sales manager)", priority: "high", message: "Reminder — approval on PRS-26-0033 outstanding for 2 days" },
      { at: "2026-09-25T01:30:00Z", to: "Sam Okafor (Sales manager)", priority: "high", message: "Reminder — approval on PRS-26-0033 outstanding for 4 days; inverter is on 21-day back-order and the L&H quote expires 4 Oct" },
    ],
    greenDeal: { created: false },
    history: [
      { at: "2026-09-18T00:00:00Z", by: "System", action: "Entered Procurement & delivery", detail: "SLA 10 days" },
      { at: "2026-09-19T03:20:00Z", by: "Arshitha", action: "BOQ / BOS verified", detail: "Rail and cable differ from the proposal; inverter on 21-day back-order, panels 14 days" },
      { at: "2026-09-19T03:25:00Z", by: "Arshitha", action: "Started getting quotes", detail: "Solar Juice, Lawrence & Hanson, Krannich, Westside Cranes, Volt Electrical" },
      { at: "2026-09-20T01:00:00Z", by: "Arshitha", action: "BOQ revised — round 2", detail: "Rail 54 → 60, cable 80 → 110 m, to the site measure. Re-matched: all lines agree" },
      { at: "2026-09-21T01:10:00Z", by: "Arshitha", action: "Quotes received", detail: "Panel, inverter and switchboard prices up — variation 5.7% against the accepted proposal" },
      { at: "2026-09-21T01:30:00Z", by: "System", action: "Approvals requested", detail: "Above 5% — business owner (Ravi Shankar) and sales manager (Sam Okafor)" },
      { at: "2026-09-21T02:00:00Z", by: "Arshitha", action: "Purchase orders drafted", detail: "PO-26-0121, PO-26-0122, PO-26-0123 — to send once approved" },
      { at: "2026-09-22T23:30:00Z", by: "Ravi Shankar", action: "Approved", detail: "Business owner — proceed at the quoted price" },
      { at: "2026-09-25T01:30:00Z", by: "System", action: "High-priority reminder sent", detail: "Sales manager approval outstanding; inverter back-order and L&H quote expiry flagged" },
    ],
  },
  {
    id: 35,
    number: "PRS-26-0035",
    customer: "Riverside Medical Centre",
    site: "45 River Rd, Parramatta NSW 2150",
    acceptedValue: 33200,
    salesperson: "Priya Nair",
    coordinator: "Arshitha",
    enteredAt: "2026-09-23T22:00:00Z",
    slaDueAt: "2026-10-03T22:00:00Z",
    revisions: [],
    boq: [
      { key: "panel", kind: "material", item: "Solar panel 440 W", brand: "Jinko Tiger Neo", unit: "ea", proposalQty: 30, siteQty: 30, proposalUnitCost: 210, quotedUnitCost: null, supplier: "Solar Juice", availability: "available" },
      { key: "inverter", kind: "material", item: "Hybrid inverter 10 kW", brand: "Sungrow SH10RT", unit: "ea", proposalQty: 1, siteQty: 1, proposalUnitCost: 2950, quotedUnitCost: null, supplier: "Solar Juice", availability: "lead_time", leadTimeDays: 5 },
      { key: "battery", kind: "material", item: "Battery module 9.6 kWh", brand: "Sungrow SBR096", unit: "ea", proposalQty: 1, siteQty: 1, proposalUnitCost: 5400, quotedUnitCost: null, supplier: "Solar Juice", availability: "lead_time", leadTimeDays: 5 },
      { key: "rail", kind: "material", item: "Mounting rail 4.2 m", brand: "Clenergy", unit: "ea", proposalQty: 18, siteQty: 18, proposalUnitCost: 38, quotedUnitCost: 38, supplier: "Krannich", availability: "available" },
      { key: "labour", kind: "service", item: "Installation labour", brand: "Sydpro crew", unit: "day", proposalQty: 3, siteQty: 3, proposalUnitCost: 1400, quotedUnitCost: 1400, supplier: "Sydpro crew", availability: "available" },
      { key: "electrical", kind: "service", item: "Electrical connection & commissioning", brand: "Volt Electrical", unit: "lot", proposalQty: 1, siteQty: 1, proposalUnitCost: 1900, quotedUnitCost: null, supplier: "Volt Electrical", availability: "available" },
    ],
    quotes: [{ supplier: "Krannich", receivedAt: "2026-09-25T04:00:00Z", total: 684, validUntil: "2026-10-25" }],
    purchaseOrders: [],
    approvals: [],
    notifications: [],
    greenDeal: { created: false },
    history: [
      { at: "2026-09-23T22:00:00Z", by: "System", action: "Entered Procurement & delivery", detail: "SLA 10 days" },
      { at: "2026-09-24T01:10:00Z", by: "Arshitha", action: "BOQ / BOS verified", detail: "All 6 lines match the site requirement; inverter and battery on 5-day lead time" },
      { at: "2026-09-24T01:15:00Z", by: "Arshitha", action: "Started getting quotes", detail: "Solar Juice, Krannich, Volt Electrical" },
      { at: "2026-09-25T04:00:00Z", by: "Arshitha", action: "Quote received", detail: "Krannich — waiting on Solar Juice and Volt Electrical" },
    ],
  },
];

// ---- Checklists -------------------------------------------------------------
// The CL-11 / CL-12 / CL-13 / CL-14 / CL-10 answers behind each sample job,
// worked out from how far its record has got so the checklists agree with the
// step strip: a job whose orders are delivered has its material receipt
// ticked; one still gathering quotes has only the BOQ table done. Once the
// purchase-order service is connected the checklist comes back with the job.
// Worked from the raw record rather than helpers/procurement.js, which
// imports this file.

const day = (iso) => (iso ? iso.slice(0, 10) : "");
const file = (name) => ({ id: name, filename: name });
const isQuoted = (line) => line.quotedUnitCost !== null && line.quotedUnitCost !== undefined;

export function sampleProcurementChecklist(job) {
  const lines = job.boq ?? [];
  const quoted = lines.length > 0 && lines.every(isQuoted);
  const quotes = job.quotes ?? [];
  const suppliers = quotes.map((quote) => quote.supplier);
  const orders = job.purchaseOrders ?? [];
  const sent = orders.filter((order) => order.status !== "draft");
  const delivered = sent.length > 0 && sent.every((order) => order.status === "delivered");
  const approvals = job.approvals ?? [];
  const approvalsDone = approvals.length > 0 && approvals.every((approval) => approval.status === "approved");
  const verified = (job.history ?? []).some((entry) => entry.action === "BOQ / BOS verified");
  const revision = (job.revisions ?? [])[job.revisions.length - 1];
  const mismatched = lines.filter((line) => Number(line.proposalQty) !== Number(line.siteQty));
  const quotedTotal = quoted ? Math.round(lines.reduce((sum, line) => sum + Number(line.siteQty) * Number(line.quotedUnitCost), 0)) : null;
  const firstDelivery = orders.map((order) => order.scheduledFor || order.deliveryEta).filter(Boolean).sort()[0] ?? day(job.slaDueAt);
  const changes = revision
    ? `${revision.reason} — approved`
    : mismatched.length
      ? `${mismatched.map((line) => `${line.item} ${line.proposalQty} → ${line.siteQty}`).join(", ")} — approved by the procurement manager`
      : "No changes — the BOQ stands as proposed";

  return {
    boq: verified
      ? { boqMatches: true, materialsIncluded: true, quantitiesCorrect: true, siteRequirementsIncluded: true, changesApproved: true, changesApprovedDetails: changes }
      : {},
    quote: quoted
      ? {
          quoteCurrentConfirmed: true,
          quoteFile: suppliers.map((supplier) => file(`${job.number}-quote-${supplier.replace(/\W+/g, "-")}.pdf`)),
          supplierApproved: true,
          quoteMatchesBoq: true,
          quotesCompared: true,
          comparedSuppliers: suppliers.join(", "),
          pricingConfirmed: true,
          stockConfirmed: true,
          fulfilmentMethod: "delivery",
          fulfilmentDate: firstDelivery,
          fulfilmentTime: "08:00",
          freightCharges: 180,
          paymentDueDate: quotes[0]?.validUntil ?? "",
          termsConfirmed: true,
          finalQuoteFile: [file(`${job.number}-final-quotes.pdf`)],
        }
      : quotes.length
        ? { supplierApproved: true }
        : {},
    po: quoted
      ? {
          basisConfirmed: true,
          poAmountValue: quotedTotal,
          poAmountMatches: true,
          variationChecked: true,
          variationApproved: approvalsDone,
          variationApprovedBy: approvalsDone ? approvals.map((approval) => approval.approver).join(", ") : "",
          supplierConfirmed: true,
          deliveryConfirmed: true,
          termsConfirmed: true,
          ...(sent.length
            ? { releaseApproved: true, poReleasedConfirmed: true, poReleasedOn: day(sent[0].sentAt), poRecords: sent.map((order) => file(`${order.number}.pdf`)) }
            : {}),
        }
      : {},
    receipt: delivered
      ? {
          matchesPo: true,
          specsCorrect: true,
          quantitiesMatch: true,
          damageChecked: true,
          allArrived: true,
          discrepancyFound: "no",
          materialsReady: true,
          recordsUpdated: true,
          receiptFiles: sent.map((order) => file(`${order.number}-packing-slip.pdf`)),
        }
      : {},
    jobCreation: job.greenDeal?.created
      ? { greenDealJobId: job.greenDeal.jobId, greenDealCreatedOn: day(job.greenDeal.createdAt), syncConfirmed: true, matchConfirmed: true }
      : {},
  };
}
