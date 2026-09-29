// Approvals (stage 5) — hardcoded data for the workflow screens.
//
// Everything on the approvals page reads from here until the approvals
// service is connected to prestige-be. The shape is the one the API is
// expected to return, so wiring it up later means swapping this import for a
// slice, not reworking the panels.
//
// The workflow follows the Sydpro process chart for this stage:
//
//   APPROVALS  (process timeline: same day or +1 day)
//     ├─ DA approval
//     ├─ DNSP approval
//     ├─ Finance approval        (if applicable — e.g. a zero-interest loan)
//     └─ Additional approvals    (if any — strata, rebate pre-approval…)
//   All approved?
//     yes → Procurement & delivery, and whoever creates the Green Deal job
//           and runs procurement is told
//     no  → assigned back to the salesperson; sales manager + owner told;
//           recorded in the history

export const APPROVALS_STAGE = {
  id: 5,
  key: "approvals",
  label: "Approvals",
  // "Process timeline — same day or +1 day".
  slaDays: 1,
  next: { id: 6, key: "procurement", short: "Procurement", label: "Procurement & delivery" },
};

/** The four approval tracks on the chart, run side by side. */
export const APPROVAL_TRACKS = [
  { key: "da", label: "DA approval", short: "DA", description: "Development approval from the council, where the install needs one." },
  { key: "dnsp", label: "DNSP approval", short: "DNSP", description: "Network connection approval from the distributor (Ausgrid, Endeavour, Essential)." },
  { key: "finance", label: "Finance approval", short: "Finance", description: "Only when the customer is financing the job — a zero-interest loan, for example.", optional: true },
  { key: "additional", label: "Additional approvals", short: "Additional", description: "Anything else this job needs — strata, rebate pre-approval, landlord consent.", optional: true },
];

/** Where each approval can be. */
export const ITEM_STATUSES = {
  not_applicable: { key: "not_applicable", label: "Not applicable", tone: "neutral" },
  not_started: { key: "not_started", label: "Not started", tone: "neutral" },
  submitted: { key: "submitted", label: "Awaiting decision", tone: "warning" },
  approved: { key: "approved", label: "Approved", tone: "success" },
  rejected: { key: "rejected", label: "Rejected", tone: "danger" },
};

/**
 * The chart's "Identified issues & solution" box — the notifications this
 * stage raises. Every notification on a job names the rule that raised it.
 */
export const APPROVAL_RULES = [
  {
    key: "finance_required",
    when: "Finance is required (zero-interest loan)",
    then: "A notification goes to the responsible person's dashboard to initiate it.",
    notifies: "Arshitha — finance",
  },
  {
    key: "all_approved",
    when: "Every approval is received",
    then: "A notification goes to the person who creates the Green Deal job and runs procurement.",
    notifies: "Monisha — Green Deal · Arshitha — procurement",
  },
  {
    key: "loan_rejected",
    when: "The loan is rejected",
    then: "The responsible salesperson is told to relook at the alternative options.",
    notifies: "The job's salesperson",
  },
  {
    key: "not_approved",
    when: "Any approval is not given",
    then: "The job is assigned back to its salesperson, and the sales manager and owner are told. Recorded in the history.",
    notifies: "Salesperson · Sam Okafor (sales manager) · Ravi Shankar (owner)",
  },
];

/** Integrations the chart calls for, and where they stand. */
export const INTEGRATIONS = [{ key: "green_deal", label: "Green Deal", status: "Planned — job creation is manual until the integration is connected" }];

// ---- Jobs -------------------------------------------------------------------
// Five jobs, one per branch of the chart:
//   0041 — every approval in, handed to procurement (the happy path)
//   0042 — DA approved, DNSP still with Ausgrid; no finance, nothing additional
//   0043 — zero-interest loan: finance initiated from Arshitha's dashboard, pending
//   0044 — loan rejected: assigned back to the salesperson to relook at options
//   0045 — strata approval outstanding, past the stage's one-day timeline

const NOT_APPLICABLE = (key) => ({ key, applicable: false, status: "not_applicable" });

export const APPROVAL_JOBS = [
  {
    id: 41,
    number: "PRS-26-0041",
    customer: "Harrington Family",
    site: "22 Ferry Rd, Glebe NSW 2037",
    acceptedValue: 18900,
    salesperson: "Daniel Reyes",
    enteredAt: "2026-09-24T22:30:00Z",
    slaDueAt: "2026-09-25T22:30:00Z",
    items: [
      { key: "da", applicable: true, status: "approved", authority: "Inner West Council", reference: "CDC-2026/1188", owner: "Hema", submittedAt: "2026-09-24T23:10:00Z", decidedAt: "2026-09-25T04:40:00Z", note: "Complying development — no DA needed beyond the CDC." },
      { key: "dnsp", applicable: true, status: "approved", authority: "Ausgrid", reference: "AG-PRE-775120", owner: "Hema", submittedAt: "2026-09-24T23:25:00Z", decidedAt: "2026-09-25T06:05:00Z", note: "Export limited to 5 kW." },
      NOT_APPLICABLE("finance"),
      NOT_APPLICABLE("additional"),
    ],
    finance: null,
    assignedBack: null,
    handoff: { to: ["Monisha", "Arshitha"], at: "2026-09-25T06:06:00Z" },
    notifications: [
      { at: "2026-09-25T06:06:00Z", rule: "all_approved", to: "Monisha (Green Deal)", priority: "high", message: "All approvals received on PRS-26-0041 — create the Green Deal job" },
      { at: "2026-09-25T06:06:00Z", rule: "all_approved", to: "Arshitha (procurement)", priority: "high", message: "All approvals received on PRS-26-0041 — start procurement" },
    ],
    history: [
      { at: "2026-09-24T22:30:00Z", by: "System", action: "Entered Approvals", detail: "Timeline: same day or +1 day" },
      { at: "2026-09-24T23:10:00Z", by: "Hema", action: "DA lodged", detail: "Inner West Council — CDC-2026/1188" },
      { at: "2026-09-24T23:25:00Z", by: "Hema", action: "DNSP lodged", detail: "Ausgrid pre-approval AG-PRE-775120" },
      { at: "2026-09-25T04:40:00Z", by: "Hema", action: "DA approved", detail: "Complying development" },
      { at: "2026-09-25T06:05:00Z", by: "Hema", action: "DNSP approved", detail: "Export limited to 5 kW" },
      { at: "2026-09-25T06:06:00Z", by: "System", action: "All approvals received", detail: "Monisha and Arshitha notified — handed to Procurement & delivery" },
    ],
  },
  {
    id: 42,
    number: "PRS-26-0042",
    customer: "Leichhardt Bakery",
    site: "5 Norton St, Leichhardt NSW 2040",
    acceptedValue: 26400,
    salesperson: "Priya Nair",
    enteredAt: "2026-09-28T23:00:00Z",
    slaDueAt: "2026-09-29T23:00:00Z",
    items: [
      { key: "da", applicable: true, status: "approved", authority: "Inner West Council", reference: "DA-2026/0412", owner: "Hema", submittedAt: "2026-09-28T23:30:00Z", decidedAt: "2026-09-29T03:15:00Z", note: null },
      { key: "dnsp", applicable: true, status: "submitted", authority: "Ausgrid", reference: "AG-PRE-775309", owner: "Hema", submittedAt: "2026-09-28T23:45:00Z", decidedAt: null, note: "Three-phase — technical review requested by Ausgrid." },
      NOT_APPLICABLE("finance"),
      NOT_APPLICABLE("additional"),
    ],
    finance: null,
    assignedBack: null,
    handoff: null,
    notifications: [],
    history: [
      { at: "2026-09-28T23:00:00Z", by: "System", action: "Entered Approvals", detail: "Timeline: same day or +1 day" },
      { at: "2026-09-28T23:30:00Z", by: "Hema", action: "DA lodged", detail: "Inner West Council — DA-2026/0412" },
      { at: "2026-09-28T23:45:00Z", by: "Hema", action: "DNSP lodged", detail: "Ausgrid — three-phase connection" },
      { at: "2026-09-29T03:15:00Z", by: "Hema", action: "DA approved", detail: "DA-2026/0412" },
    ],
  },
  {
    id: 43,
    number: "PRS-26-0043",
    customer: "Nguyen Residence",
    site: "9 Kent St, Epping NSW 2121",
    acceptedValue: 31200,
    salesperson: "Daniel Reyes",
    enteredAt: "2026-09-28T22:00:00Z",
    slaDueAt: "2026-09-29T22:00:00Z",
    items: [
      { key: "da", applicable: true, status: "approved", authority: "City of Parramatta", reference: "CDC-2026/2231", owner: "Hema", submittedAt: "2026-09-28T22:40:00Z", decidedAt: "2026-09-29T01:30:00Z", note: null },
      { key: "dnsp", applicable: true, status: "approved", authority: "Ausgrid", reference: "AG-PRE-775288", owner: "Hema", submittedAt: "2026-09-28T22:50:00Z", decidedAt: "2026-09-29T02:10:00Z", note: null },
      { key: "finance", applicable: true, status: "submitted", authority: "Brighte", reference: "BRT-44310982", owner: "Arshitha", submittedAt: "2026-09-29T00:15:00Z", decidedAt: null, note: "Zero-interest loan application with the lender." },
      NOT_APPLICABLE("additional"),
    ],
    finance: { product: "Zero-interest loan", provider: "Brighte", amount: 25000, termMonths: 60, status: "submitted", initiatedBy: "Arshitha", initiatedAt: "2026-09-29T00:15:00Z" },
    assignedBack: null,
    handoff: null,
    notifications: [
      { at: "2026-09-28T22:01:00Z", rule: "finance_required", to: "Arshitha (finance)", priority: "high", message: "PRS-26-0043 needs a zero-interest loan — initiate it from your dashboard" },
    ],
    history: [
      { at: "2026-09-28T22:00:00Z", by: "System", action: "Entered Approvals", detail: "Timeline: same day or +1 day" },
      { at: "2026-09-28T22:01:00Z", by: "System", action: "Finance required", detail: "Zero-interest loan — Arshitha notified on her dashboard" },
      { at: "2026-09-28T22:40:00Z", by: "Hema", action: "DA lodged", detail: "City of Parramatta — CDC-2026/2231" },
      { at: "2026-09-28T22:50:00Z", by: "Hema", action: "DNSP lodged", detail: "Ausgrid pre-approval AG-PRE-775288" },
      { at: "2026-09-29T00:15:00Z", by: "Arshitha", action: "Loan application submitted", detail: "Brighte — $25,000 over 60 months" },
      { at: "2026-09-29T01:30:00Z", by: "Hema", action: "DA approved", detail: "CDC-2026/2231" },
      { at: "2026-09-29T02:10:00Z", by: "Hema", action: "DNSP approved", detail: "AG-PRE-775288" },
    ],
  },
  {
    id: 44,
    number: "PRS-26-0044",
    customer: "Castle Hill Dental",
    site: "3 Terminus St, Castle Hill NSW 2154",
    acceptedValue: 42800,
    salesperson: "Priya Nair",
    enteredAt: "2026-09-26T22:00:00Z",
    slaDueAt: "2026-09-27T22:00:00Z",
    items: [
      { key: "da", applicable: true, status: "approved", authority: "The Hills Shire Council", reference: "DA-2026/1790", owner: "Hema", submittedAt: "2026-09-26T22:30:00Z", decidedAt: "2026-09-27T03:00:00Z", note: null },
      { key: "dnsp", applicable: true, status: "approved", authority: "Endeavour Energy", reference: "EE-CX-190442", owner: "Hema", submittedAt: "2026-09-26T22:45:00Z", decidedAt: "2026-09-27T04:20:00Z", note: null },
      { key: "finance", applicable: true, status: "rejected", authority: "Plenti", reference: "PLN-7730114", owner: "Arshitha", submittedAt: "2026-09-26T23:30:00Z", decidedAt: "2026-09-27T05:10:00Z", note: "Declined — business trading history under two years." },
      NOT_APPLICABLE("additional"),
    ],
    finance: { product: "Zero-interest loan", provider: "Plenti", amount: 38000, termMonths: 84, status: "rejected", initiatedBy: "Arshitha", initiatedAt: "2026-09-26T23:30:00Z", rejectionReason: "Business trading history under two years" },
    assignedBack: { to: "Priya Nair", at: "2026-09-27T05:12:00Z", reason: "Finance approval rejected — relook at the alternative options with the customer" },
    handoff: null,
    notifications: [
      { at: "2026-09-26T22:01:00Z", rule: "finance_required", to: "Arshitha (finance)", priority: "high", message: "PRS-26-0044 needs a zero-interest loan — initiate it from your dashboard" },
      { at: "2026-09-27T05:12:00Z", rule: "loan_rejected", to: "Priya Nair (salesperson)", priority: "high", message: "The loan on PRS-26-0044 was rejected — relook at the alternative options with the customer" },
      { at: "2026-09-27T05:12:00Z", rule: "not_approved", to: "Sam Okafor (sales manager)", priority: "high", message: "PRS-26-0044 is back with Priya Nair — finance approval rejected" },
      { at: "2026-09-27T05:12:00Z", rule: "not_approved", to: "Ravi Shankar (owner)", priority: "high", message: "PRS-26-0044 is back with Priya Nair — finance approval rejected" },
    ],
    history: [
      { at: "2026-09-26T22:00:00Z", by: "System", action: "Entered Approvals", detail: "Timeline: same day or +1 day" },
      { at: "2026-09-26T22:01:00Z", by: "System", action: "Finance required", detail: "Zero-interest loan — Arshitha notified on her dashboard" },
      { at: "2026-09-26T23:30:00Z", by: "Arshitha", action: "Loan application submitted", detail: "Plenti — $38,000 over 84 months" },
      { at: "2026-09-27T03:00:00Z", by: "Hema", action: "DA approved", detail: "DA-2026/1790" },
      { at: "2026-09-27T04:20:00Z", by: "Hema", action: "DNSP approved", detail: "EE-CX-190442" },
      { at: "2026-09-27T05:10:00Z", by: "Arshitha", action: "Loan rejected", detail: "Business trading history under two years" },
      { at: "2026-09-27T05:12:00Z", by: "System", action: "Assigned back to Priya Nair", detail: "Sales manager and owner notified; salesperson asked to relook at alternatives" },
    ],
  },
  {
    id: 45,
    number: "PRS-26-0045",
    customer: "Harbour Views Strata",
    site: "88 Blues Point Rd, McMahons Point NSW 2060",
    acceptedValue: 64500,
    salesperson: "Daniel Reyes",
    enteredAt: "2026-09-26T23:00:00Z",
    slaDueAt: "2026-09-27T23:00:00Z",
    items: [
      { key: "da", applicable: true, status: "approved", authority: "North Sydney Council", reference: "DA-2026/0877", owner: "Hema", submittedAt: "2026-09-26T23:20:00Z", decidedAt: "2026-09-27T05:00:00Z", note: null },
      { key: "dnsp", applicable: true, status: "approved", authority: "Ausgrid", reference: "AG-PRE-775166", owner: "Hema", submittedAt: "2026-09-26T23:35:00Z", decidedAt: "2026-09-27T06:30:00Z", note: null },
      NOT_APPLICABLE("finance"),
      { key: "additional", applicable: true, status: "submitted", authority: "Owners corporation", reference: "SP-60412 AGM motion 7", label: "Strata approval", owner: "Hema", submittedAt: "2026-09-27T00:10:00Z", decidedAt: null, note: "Tabled for the owners' meeting on 2 October — outside our control." },
    ],
    finance: null,
    assignedBack: null,
    handoff: null,
    notifications: [
      { at: "2026-09-28T00:00:00Z", rule: "not_approved", to: "Sam Okafor (sales manager)", priority: "high", message: "PRS-26-0045 is past its approvals timeline — strata approval outstanding" },
    ],
    history: [
      { at: "2026-09-26T23:00:00Z", by: "System", action: "Entered Approvals", detail: "Timeline: same day or +1 day" },
      { at: "2026-09-26T23:20:00Z", by: "Hema", action: "DA lodged", detail: "North Sydney Council — DA-2026/0877" },
      { at: "2026-09-26T23:35:00Z", by: "Hema", action: "DNSP lodged", detail: "Ausgrid pre-approval AG-PRE-775166" },
      { at: "2026-09-27T00:10:00Z", by: "Hema", action: "Strata approval requested", detail: "Owners corporation SP-60412 — AGM motion 7" },
      { at: "2026-09-27T05:00:00Z", by: "Hema", action: "DA approved", detail: "DA-2026/0877" },
      { at: "2026-09-27T06:30:00Z", by: "Hema", action: "DNSP approved", detail: "AG-PRE-775166" },
      { at: "2026-09-28T00:00:00Z", by: "System", action: "Timeline breached", detail: "Strata approval outstanding — sales manager notified" },
    ],
  },
];
