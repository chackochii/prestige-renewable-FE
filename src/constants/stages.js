// The 9 pipeline stages, matching prestige-be (Opportunity.stage 1–9).
// Business units may disable stages via config (enabledStages); disabled
// stages are skipped, never renumbered.

export const STAGES = [
  {
    id: 1,
    key: "lead",
    short: "Lead",
    label: "Lead capture & qualification",
    description:
      "Capture the customer, site and decision-maker, then qualify the lead and assign an estimator before it moves on.",
  },
  {
    id: 2,
    key: "estimation",
    short: "Estimate",
    label: "Estimation & validation",
    description: "Solution options, cost build-up, sell price and target margin, verified before a proposal is prepared.",
  },
  {
    id: 3,
    key: "proposal",
    short: "Proposal",
    label: "Proposal & negotiation",
    description: "Controlled proposal generated from the selected option, presented to the customer and negotiated.",
  },
  {
    id: 4,
    key: "closure",
    short: "Closure",
    label: "Sales closure",
    description: "Signed acceptance recorded; the deposit billing request is raised and the job baseline is set.",
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
    short: "Procure",
    label: "Procurement",
    description: "Purchase orders raised and delivery dates confirmed so site windows line up with what is arriving.",
  },
  {
    id: 7,
    key: "site_works",
    short: "Site works",
    label: "Site works",
    description: "Pre-start, materials, installation and commissioning sub-stages signed off on site.",
  },
  {
    id: 8,
    key: "billing",
    short: "Billing",
    label: "Billing",
    description: "Milestone billing requests reconciled against tax invoices and payments recorded from accounting.",
  },
  {
    id: 9,
    key: "handover",
    short: "Handover",
    label: "Handover",
    description: "Warranty contact, documentation and follow-up captured; the record is closed.",
  },
];

export const FIRST_STAGE = 1;
export const LAST_STAGE = 9;

export function stageById(id) {
  return STAGES.find((s) => s.id === Number(id)) || STAGES[0];
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
