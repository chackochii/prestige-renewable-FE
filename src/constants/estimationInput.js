// Lead → Estimation Input Checklist.
//
// This belongs to the LEAD module, not to estimation: it is the last gate
// before a lead is handed over, filled in by the sales representative. The
// estimator does not re-enter any of it — they review what arrived and either
// accept it or send it back (see features/estimation/InputReview).
//
// Anything already captured during lead qualification is inherited, never
// asked for twice: customer contact, installation address, enquiry scope and
// electrical phase all come straight off the lead record.

export const OWNERS = {
  sales: "Sales Representative",
  estimator: "Estimator",
  siteCrew: "Site crew",
};

export const SITE_TYPES = [
  { key: "residential", label: "Residential" },
  { key: "commercial", label: "Commercial" },
  { key: "industrial", label: "Industrial" },
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

/**
 * Item 4: the inspection's progress, shown to sales rather than entered by
 * them. It is derived from the operations assignment raised by "Request
 * pre-site inspection" — see inspectionStatusFrom below.
 */
export const INSPECTION_STATUSES = [
  { key: "requested", label: "Requested" },
  { key: "scheduled", label: "Scheduled" },
  { key: "completed", label: "Completed" },
];

/** The operations assignment's own status, collapsed to the three the checklist shows. */
export function inspectionStatusFrom(assignment) {
  const status = assignment?.status;
  if (!status) return null;
  if (["completed", "report_submitted"].includes(status)) return "completed";
  if (["scheduled", "rescheduled", "in_progress"].includes(status)) return "scheduled";
  if (["cancelled"].includes(status)) return null;
  return "requested";
}

export function inspectionStatusLabel(key) {
  return INSPECTION_STATUSES.find((s) => s.key === key)?.label || "Not requested yet";
}

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

/** Category used for drawings, layouts and SLDs uploaded against the job. */
export const DRAWING_CATEGORY = "sketch";
/** Category used for site photos taken on the pre-site inspection. */
export const SITE_PHOTO_CATEGORY = "photo";

export function emptyEstimationInput() {
  return {
    // Project & site
    siteType: "",
    preSiteInspectionRequired: "",
    siteCrewAssigneeId: "",
    inspectionStatus: "",
    siteVisitCompleted: false,
    roofMeasurements: "",
    // Existing electrical
    existingElectrical: "",
    switchboardLocation: "",
    switchboardCondition: "",
    switchboardUpgrade: "",
    loadRequirements: "",
    // Existing system (retrofit only)
    isRetrofit: "",
    existingSolarKw: "",
    existingInverter: "",
    existingBattery: "",
    existingSystemNotes: "",
    // New system specification
    panelQty: "",
    panelCapacityW: "",
    preferredBrands: "",
    inverterBrandModel: "",
    batteryBrandModel: "",
    batteryCapacityKwh: "",
    backupRequirement: "",
    backupDuration: "",
    // Installation requirements
    mountingRequirements: "",
    cableRequirements: "",
    siteConstraints: "",
    specialRequirements: "",
    // Compliance
    permits: [],
    vppDiscussed: false,
    vppEligibility: "",
    vppNotes: "",
    permitNotes: "",
    meterRequirements: "",
    drawingsNotes: "",
    // Customer
    inclusions: "",
    exclusions: "",
    // Anything sales wants the estimator to know before they pick it up
    noteForEstimator: "",
  };
}

const str = (v) => (v === null || v === undefined ? "" : String(v));

/** Reads the saved checklist off the opportunity, filling in anything not set yet. */
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

const blank = (v) => !String(v ?? "").trim();

/**
 * What sales still has to supply before they can sign the checklist off. Items
 * that only apply in some cases (retrofit details, inspection findings, VPP)
 * are only required once that case applies.
 */
export function estimationInputMissing(input, { drawingsCount = 0, sitePhotoCount = 0 } = {}) {
  const missing = [];
  if (blank(input.siteType)) missing.push("site type");
  if (blank(input.preSiteInspectionRequired)) missing.push("whether a pre-site inspection is required");
  if (input.preSiteInspectionRequired === "yes") {
    if (!input.siteVisitCompleted) missing.push("site visit completed and findings reviewed");
    if (!sitePhotoCount) missing.push("site photos");
  }
  if (blank(input.roofMeasurements)) missing.push("roof / site measurements");
  if (blank(input.existingElectrical)) missing.push("existing electrical system");
  if (blank(input.switchboardCondition)) missing.push("main switchboard / DB details");
  if (blank(input.switchboardUpgrade)) missing.push("switchboard upgrade requirement");
  if (blank(input.loadRequirements)) missing.push("electrical load requirements");
  if (blank(input.isRetrofit)) missing.push("whether this is a retrofit");
  if (
    input.isRetrofit === "yes" &&
    blank(input.existingSolarKw) &&
    blank(input.existingInverter) &&
    blank(input.existingBattery)
  )
    missing.push("existing solar / inverter / battery details");
  if (blank(input.panelQty) || blank(input.panelCapacityW)) missing.push("panel quantity and system capacity");
  if (blank(input.inverterBrandModel)) missing.push("inverter brand / model");
  if (blank(input.backupRequirement)) missing.push("backup requirement");
  if (["essential", "whole_home"].includes(input.backupRequirement)) {
    if (blank(input.batteryCapacityKwh)) missing.push("battery capacity");
    if (blank(input.backupDuration)) missing.push("backup duration");
  }
  if (blank(input.mountingRequirements)) missing.push("mounting / roof structure requirements");
  if (blank(input.cableRequirements)) missing.push("cable / conduit / trunking requirements");
  if (blank(input.siteConstraints)) missing.push("shading, orientation and site constraints");
  if (blank(input.meterRequirements) && !drawingsCount) missing.push("utility / meter requirements or a drawing");
  if (blank(input.inclusions) && blank(input.exclusions)) missing.push("inclusions and exclusions");
  return missing;
}

export const ESTIMATOR_ACCEPTANCE =
  "Estimator has reviewed and accepted the inputs, and confirms all required information is available to commence BOQ preparation.";
