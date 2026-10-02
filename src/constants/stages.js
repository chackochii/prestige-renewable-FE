// The pipeline stages, matching prestige-be (Opportunity.stage 1–9) and named
// for the process chart: Leads & Marketing, Estimation, Proposals, Approvals,
// Procurement & Delivery, Construction, Invoicing & Payments, DLP/O&M. Stage 4
// (Sales closure) is retired: a client accepting the proposal sends the job
// straight to Approvals, as the Sydpro process chart has it. Numbers are never
// reused, so stage ids stay 1–9 with 4 simply absent.
//
// Warranty registration, referrals & feedback and the DLP/O&M period are the
// last three stages as well as modules of their own in the sidebar: the
// module is where that team works, the stage is where the job has got to.
// Business units may disable stages via config (enabledStages); disabled
// stages are skipped, never renumbered.

export const STAGES = [
  {
    id: 1,
    key: "lead",
    short: "Leads",
    label: "Leads & Marketing",
    description:
      "Capture the customer, site and decision-maker, then qualify the lead and assign an estimator before it moves on.",
  },
  {
    id: 2,
    key: "estimation",
    short: "Estimation",
    label: "Estimation",
    description: "Solution options, cost build-up, sell price and target margin, verified before a proposal is prepared.",
  },
  {
    id: 3,
    key: "proposal",
    short: "Proposal",
    label: "Proposal & negotiation",
    description:
      "The sales rep reviews the final quote, applies any approved discount and emails it to the client, then follows up until the client accepts (on to Approvals), asks for changes (back to Estimation for a re-quote) or declines.",
  },
  {
    id: 5,
    key: "approvals",
    short: "Approvals",
    label: "Approvals",
    description: "Council, network, facility and rebate approvals gathered before delivery can start.",
  },
  {
    id: 6,
    key: "procurement",
    short: "Procurement",
    label: "Procurement & Delivery",
    description: "Purchase orders raised and delivery dates confirmed so site windows line up with what is arriving.",
  },
  {
    id: 7,
    key: "site_works",
    short: "Construction",
    label: "Construction",
    description: "Pre-start, materials, installation and commissioning sub-stages signed off on site.",
  },
  {
    id: 8,
    key: "billing",
    short: "Invoicing",
    label: "Invoicing & Payments",
    description: "Milestone billing requests reconciled against tax invoices and payments recorded from accounting.",
  },
  {
    id: 9,
    key: "warranty",
    short: "Warranty",
    label: "Warranty Registration",
    description: "Warranty certificates issued and logged against the installed equipment.",
  },
  {
    id: 10,
    key: "referrals",
    short: "Referrals",
    label: "Referrals & Feedback",
    description: "The client's review captured and any referral they make recorded against the job.",
  },
  {
    id: 11,
    key: "dlp_om",
    short: "DLP / O&M",
    label: "DLP, O&M Period",
    description: "Defects liability and ongoing maintenance run out; the record is closed at the end of it.",
  },
];

export const FIRST_STAGE = 1;
export const LAST_STAGE = 11;

// A record still at retired stage 4 was already won, so it reads as Approvals.
const RETIRED_TO = { 4: 5 };

export function stageById(id) {
  const n = RETIRED_TO[Number(id)] ?? Number(id);
  return STAGES.find((s) => s.id === n) || STAGES[0];
}

/** Stages a business unit runs, in order. */
export function enabledStagesFor(unit) {
  const enabled = Array.isArray(unit?.enabledStages) ? unit.enabledStages.map(Number) : [];
  if (!enabled.length) return STAGES;
  return STAGES.filter((s) => enabled.includes(s.id));
}

/** The next stage the unit runs after `stage`, or null at the end. */
export function nextStageFor(stage, unit) {
  const enabled = enabledStagesFor(unit).map((s) => s.id);
  return enabled.find((id) => id > Number(stage)) ?? null;
}

export const LIFECYCLES = {
  Active: { label: "Active", tone: "success" },
  Won: { label: "Won", tone: "info" },
  Lost: { label: "Lost", tone: "neutral" },
  Closed: { label: "Closed", tone: "info" },
};

export const CLOSED_LIFECYCLES = ["Won", "Lost", "Closed"];

export function lifecycleMeta(lifecycle) {
  return LIFECYCLES[lifecycle] || LIFECYCLES.Active;
}

export const QUALIFICATIONS = [
  { key: "qualified", label: "Qualified", tone: "success" },
  { key: "nurture", label: "Nurture", tone: "warning" },
  { key: "disqualified", label: "Disqualified", tone: "danger" },
];

export function qualificationMeta(key) {
  return QUALIFICATIONS.find((q) => q.key === key) || QUALIFICATIONS[1];
}

export const AU_STATES = ["NSW", "ACT", "VIC", "QLD", "SA", "WA", "TAS", "NT"];
