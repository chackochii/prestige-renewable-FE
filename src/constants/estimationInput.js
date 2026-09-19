// Estimation Input — what has to be gathered before a BOQ can be prepared.
//
// Each item names its owner: most are the estimator's, but the customer scope
// is written by the sales representative who spoke to the customer. Owners are
// shown on the form as a label, not enforced — anyone with estimation.update
// can fill the section in (a salesperson dictating scope to the estimator is
// normal), and the record shows who saved it.

export const OWNERS = {
  estimator: "Estimator",
  sales: "Sales Representative",
};

export const SITE_TYPES = [
  { key: "residential", label: "Residential" },
  { key: "commercial", label: "Commercial" },
  { key: "industrial", label: "Industrial" },
  { key: "rural", label: "Rural / farm" },
  { key: "strata", label: "Strata / multi-dwelling" },
];

export const SWITCHBOARD_CONDITIONS = [
  { key: "adequate", label: "Adequate as is" },
  { key: "upgrade_required", label: "Upgrade required" },
  { key: "relocation_required", label: "Relocation required" },
  { key: "unknown", label: "Not assessed yet" },
];

export const BACKUP_OPTIONS = [
  { key: "none", label: "No backup required" },
  { key: "essential", label: "Essential circuits only" },
  { key: "whole_home", label: "Whole home / whole site" },
  { key: "undecided", label: "Not decided yet" },
];

/** Permits and approvals this job may need, ticked as they are identified. */
export const PERMIT_OPTIONS = [
  { key: "dnsp", label: "DNSP / network connection approval" },
  { key: "da", label: "Council DA" },
  { key: "strata", label: "Strata / body corporate approval" },
  { key: "heritage", label: "Heritage overlay approval" },
  { key: "landlord", label: "Landlord consent" },
  { key: "electrical_safety", label: "Electrical safety / CES notification" },
];

export const VPP_OPTIONS = [
  { key: "not_applicable", label: "Not applicable" },
  { key: "eligible", label: "Eligible" },
  { key: "not_eligible", label: "Not eligible" },
  { key: "to_confirm", label: "To be confirmed" },
];

/**
 * Category used for drawings and layouts uploaded against the job.
 *
 * prestige-be validates this against a fixed list (photo, sketch, bill,
 * document, client_document) and maps "sketch" to the document type
 * "drawing", so that is the category to send — anything else is a 400. It is
 * shared with the pre-site visit's sketches, so both lists show the same
 * files; a dedicated category would need the backend's map extended.
 */
export const DRAWING_CATEGORY = "sketch";

export function emptyEstimationInput() {
  return {
    // 1 — lead & qualification review (Estimator)
    leadReviewConfirmed: false,
    leadReviewNotes: "",
    // 2 — customer scope (Sales Representative)
    customerScope: "",
    // 3 — site & existing electrical (Estimator)
    siteType: "",
    switchboardLocation: "",
    switchboardCondition: "",
    existingElectrical: "",
    // 4 — existing system, retrofit only (Estimator)
    isRetrofit: "",
    existingSolarKw: "",
    existingInverter: "",
    existingBattery: "",
    existingSystemNotes: "",
    // 5 — new system specification (Estimator)
    panelQty: "",
    panelCapacityW: "",
    panelBrandModel: "",
    inverterBrandModel: "",
    batteryBrandModel: "",
    batteryCapacityKwh: "",
    backupRequirement: "",
    backupNotes: "",
    // 6 — site constraints & install requirements (Estimator)
    siteConstraints: "",
    // 7 — permits, approvals & VPP (Estimator)
    permits: [],
    vppEligibility: "",
    permitNotes: "",
    // 8 — utility / meter requirements and drawings (Estimator)
    meterRequirements: "",
    drawingsNotes: "",
    // 9 — inclusions & exclusions (Estimator)
    inclusions: "",
    exclusions: "",
    // 10 — ready for BOQ (Estimator)
    readyForBoq: false,
  };
}

const str = (v) => (v === null || v === undefined ? "" : String(v));

/** Reads the saved input off the opportunity, filling in anything not set yet. */
export function estimationInputFromOpp(opp) {
  const saved = opp?.estimationInput && typeof opp.estimationInput === "object" ? opp.estimationInput : {};
  const base = emptyEstimationInput();
  const merged = { ...base };
  for (const key of Object.keys(base)) {
    const value = saved[key];
    if (value === undefined || value === null) continue;
    if (typeof base[key] === "boolean") merged[key] = Boolean(value);
    else if (Array.isArray(base[key])) merged[key] = Array.isArray(value) ? value : [];
    else merged[key] = str(value);
  }
  return merged;
}

/** System size in kW from panel count × panel capacity, or null when not entered. */
export function systemSizeKw(input) {
  const qty = Number(input?.panelQty) || 0;
  const watts = Number(input?.panelCapacityW) || 0;
  if (!qty || !watts) return null;
  return (qty * watts) / 1000;
}

/**
 * The items that must be filled in before the estimator can confirm the
 * section is ready for BOQ preparation (item 10). Returns their labels.
 */
export function estimationInputMissing(input, { drawingsCount = 0 } = {}) {
  const blank = (v) => !String(v ?? "").trim();
  const missing = [];
  if (!input.leadReviewConfirmed) missing.push("lead & qualification review");
  if (blank(input.customerScope)) missing.push("customer scope and requirements");
  if (blank(input.siteType) || blank(input.switchboardCondition)) missing.push("site type and switchboard");
  if (blank(input.isRetrofit)) missing.push("whether this is a retrofit");
  if (input.isRetrofit === "yes" && blank(input.existingSolarKw) && blank(input.existingInverter) && blank(input.existingBattery))
    missing.push("existing system details");
  if (blank(input.panelQty) || blank(input.panelCapacityW) || blank(input.inverterBrandModel))
    missing.push("new system specification");
  if (blank(input.backupRequirement)) missing.push("backup requirement");
  if (blank(input.siteConstraints)) missing.push("site constraints and install requirements");
  if (blank(input.vppEligibility)) missing.push("VPP eligibility");
  if (blank(input.meterRequirements) && !drawingsCount) missing.push("utility / meter requirements or a drawing");
  if (blank(input.inclusions) && blank(input.exclusions)) missing.push("inclusions and exclusions");
  return missing;
}
