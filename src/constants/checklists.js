// Estimator checklist, pre-site inspection, SWMS, tools sign-off, commissioning checklist

/** What sales must hand off before an estimator can start working a lead. */
export const REQUIREMENTS_CHECKLIST = [
  { key: "site_address", label: "Site address & access confirmed" },
  { key: "customer_contact", label: "Customer contact details verified" },
  { key: "energy_usage", label: "Energy bills or annual usage (kWh) provided" },
  { key: "site_evidence", label: "Site photo or sketch attached" },
  { key: "budget_indication", label: "Indicative budget / opportunity value from sales" },
  { key: "site_constraints", label: "Known site constraints noted (shading, roof type, three-phase, etc.)" },
];

/**
 * Detailed checklist an estimator works through when the client needs to
 * supply more input. Each item is a field to fill in, not just a tick —
 * it's "done" once its value is entered.
 */
export const ESTIMATOR_CHECKLIST = [
  { key: "meter_nmi", label: "Meter number / NMI", type: "text", placeholder: "e.g. 6305 123 456" },
  { key: "switchboard", label: "Switchboard location & capacity (upgrade needed?)", type: "text" },
  { key: "roof_type", label: "Roof type, pitch & orientation", type: "text" },
  { key: "shading", label: "Shading assessment", type: "textarea" },
  { key: "access", label: "Site access for equipment/scaffold", type: "textarea" },
  { key: "structural", label: "Structural adequacy for panel load", type: "textarea" },
  { key: "equipment_location", label: "Preferred inverter/battery location", type: "text" },
  { key: "approvals_constraints", label: "Council/strata/network restrictions", type: "textarea" },
];
