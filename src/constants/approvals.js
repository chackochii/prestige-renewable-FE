// Approvals (stage 5), as the Sydpro process chart has it:
//
//   APPROVALS
//     ├─ DNSP approval          ┐
//     ├─ DA approval            │ only the ones this job needs — picked by
//     ├─ Finance approval       │ sales on the lead or by estimation, from the
//     └─ Other approvals        ┘ unit's catalogue (Admin → Unit settings)
//   All approved?
//     yes → Procurement & delivery, and procurement is told
//     no  → back with the salesperson; sales manager + owner told; in the history
//
// Jobs and their approvals come from prestige-be (services/api/approvalsApi.js).
// DNSP, DA and finance are worked through the coordinator's checklists
// (constants/approvalChecklists.js); every other kind is recorded directly.

export const APPROVALS_STAGE = {
  id: 5,
  key: "approvals",
  label: "Approvals",
  next: { id: 6, key: "procurement", short: "Procurement", label: "Procurement & delivery" },
};

/** Approval kinds the coordinator works through a checklist; the rest are recorded directly. */
export const CHECKLIST_TYPES = ["dnsp", "da", "finance"];

/** Where each approval can be. */
export const ITEM_STATUSES = {
  not_applicable: { key: "not_applicable", label: "Not applicable", tone: "neutral" },
  not_started: { key: "not_started", label: "Not started", tone: "neutral" },
  submitted: { key: "submitted", label: "Awaiting decision", tone: "warning" },
  approved: { key: "approved", label: "Approved", tone: "success" },
  rejected: { key: "rejected", label: "Rejected", tone: "danger" },
};

/** The statuses a plain (non-checklist) approval can be set to, in the order the form offers them. */
export const EDITABLE_STATUSES = ["not_started", "submitted", "approved", "rejected"];

/**
 * The chart's "Identified issues & solution" box — the notifications this
 * stage raises (prestige-be notificationEvents.js). Every notification on a
 * job names the event that raised it.
 */
export const APPROVAL_RULES = [
  {
    key: "approvals.started",
    when: "The job enters approvals",
    then: "The operations coordinators are told which approvals there are to lodge.",
    notifies: "Operations coordinators · the job's coordinator",
  },
  {
    key: "approvals.finance_required",
    when: "Finance is required (the customer is financing the job)",
    then: "Finance is told to initiate the application.",
    notifies: "Finance & accounts",
  },
  {
    key: "approvals.complete",
    when: "Every approval is received",
    then: "The job moves on to procurement by itself; procurement is told to create the job and start.",
    notifies: "Procurement manager · everyone on the job",
  },
  {
    key: "approvals.rejected",
    when: "Any approval is not given",
    then: "The salesperson is told to relook at the options with the customer; the sales manager and owner are told. Recorded in the history.",
    notifies: "The job's salesperson · sales & marketing managers · business owners",
  },
];

/** Integrations the chart calls for, and where they stand. */
export const INTEGRATIONS = [{ key: "green_deal", label: "Green Deal", status: "Planned — job creation is manual until the integration is connected" }];
