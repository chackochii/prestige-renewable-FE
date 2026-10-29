// Approvals (stage 5), as the Sydpro process chart has it:
//
//   APPROVALS
//     ├─ DNSP approval          ┐
//     ├─ DA approval            │ only the ones this job needs — picked by
//     ├─ Finance approval       │ sales on the lead or by estimation, from the
//     └─ Other approvals        ┘ unit's catalogue (Admin → Unit settings)
//   All approved?
//     yes → ready: Send to Procurement (by hand), and procurement is told
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

/**
 * What can be done about a rejected approval (UAT exit logic RJ-01..05, Oct
 * 2026) - a reason is required for each. `effect` is shown once it is picked,
 * `action` is its confirm button.
 */
export const REJECTION_OPTIONS = [
  {
    value: "resubmit",
    label: "Resubmit",
    when: "The rejection can be fixed (missing document, wrong form).",
    effect: "The status returns to Not Started. The previous submission stays in History.",
    action: "Resubmit",
    placeholder: "What will be fixed before it is lodged again",
  },
  {
    value: "return_estimation",
    label: "Return to Estimation",
    when: "The design must change (e.g. export limit refused, so a smaller system or export limiting is needed).",
    effect: "The job goes back to Estimation. The quote is revised, the customer re-accepts it, and the affected approvals are reset.",
    action: "Return to Estimation",
    placeholder: "What has to change in the design",
  },
  {
    value: "return_sales",
    label: "Return to Sales",
    when: "The customer needs to decide something (e.g. finance declined, so cash or a different product).",
    effect: "The job goes back to Proposal and Negotiation, with this reason shown.",
    action: "Return to Sales",
    placeholder: "What the customer needs to decide",
  },
  {
    value: "change_approach",
    label: "Change Approach",
    when: "Another path exists (e.g. DA refused but CDC possible, or another finance provider).",
    effect: "The rejected approval is closed and the new one is added. Both stay in History.",
    action: "Change Approach",
    placeholder: "Why the new approach will work",
  },
  {
    value: "close_lost",
    label: "Close Job as Lost",
    when: "The job can't proceed.",
    effect: "The job moves to Closed Lost.",
    action: "Close Job as Lost",
    placeholder: "Anything else to record",
  },
];

/**
 * Which approvals restart from Not Started when the job comes back from a
 * redesign (Return to Estimation; UAT RS-01..03, Oct 2026). Nothing relevant
 * changed (RS-04): the approvals on the job are kept.
 */
export const APPROVAL_RESETS = [
  { value: "system", label: "System size, inverter or battery", resets: ["dnsp", "rebate"] },
  { value: "total", label: "Quote total", resets: ["finance"] },
  { value: "layout", label: "Panel layout or mounting", resets: ["da", "heritage", "strata"] },
];

/**
 * Time-based approval rules (UAT TR-01..03, Oct 2026), set per unit on Unit
 * settings (unit.metadata.approvalTimers):
 *   staleLodgedDays    - an approval Lodged longer than this is flagged amber (TR-01)
 *   idleDays           - a job at approvals with no activity this long goes on the home page's list (TR-02)
 *   expiryWarningDays  - an approval with a Valid Until date is warned about this long before (TR-03)
 */
// Stale after 5 days and expiry warned 15 days before, as confirmed with the business (CNF-02).
export const APPROVAL_TIMER_DEFAULTS = { staleLodgedDays: 5, idleDays: 7, expiryWarningDays: 15 };

/** Why a job closed as lost from a rejected approval. */
export const LOST_REASONS = [
  { value: "approval_refused", label: "Approval Refused" },
  { value: "customer_withdrew", label: "Customer Withdrew" },
  { value: "other", label: "Other" },
];

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
    when: "Every applicable approval is complete, then the job is sent to Procurement",
    then: "The coordinator and owners are told it is ready to send; once someone sends it (Send to Procurement), procurement is told to create the job and start.",
    notifies: "Operations coordinators · business owners · then the procurement manager",
  },
  {
    key: "approvals.rejected",
    when: "Any approval is not given",
    then: "The salesperson is told to relook at the options with the customer; the sales manager and owner are told. Recorded in the history.",
    notifies: "The job's salesperson · sales & marketing managers · business owners",
  },
];

/** Integrations the chart calls for, and where they stand. */
export const INTEGRATIONS = [{ key: "green_deal", label: "Green Deal", status: "Planned - job creation is manual until the integration is connected" }];
