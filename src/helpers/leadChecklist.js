// The lead checklist, read off a saved opportunity.
//
// The lead form computes the same thing from its own state while sales is
// typing; this reads it back from the record so estimation can see what
// arrived without re-entering any of it.
//
// Mandatory items are the rows that gated the lead. Optional items are the
// estimation-input rows: they never blocked the handover, so estimation is
// the one who collects whatever is still blank — straight from the client.

import {
  BACKUP_OPTIONS,
  PERMIT_OPTIONS,
  SWITCHBOARD_CONDITIONS,
  VPP_OPTIONS,
  estimationInputFromOpp,
} from "@/constants/estimationInput";
import { electricalPhaseLabel, installTimeframeLabel, roofTypeLabel, serviceRequirementLabel, storeyLabel } from "@/features/leads/propertyOptions";
import { leadSourceLabel } from "@/features/leads/leadSourceOptions";
import { formatNumber } from "@/utils/formatCurrency";
import { joinAddress } from "@/utils/text";

const filled = (value) => String(value ?? "").trim().length > 0;
const label = (options, key) => options.find((o) => o.key === key)?.label || key || "";

/** The rows that had to be complete before the lead could move on. */
export function leadMandatoryItems(opp, { billCount = 0 } = {}) {
  if (!opp) return [];
  const name = [opp.customerFirstName, opp.customerLastName].filter(Boolean).join(" ") || opp.customerLegalName;
  const address = joinAddress(
    opp.siteLine1,
    `${opp.siteSuburb || ""} ${opp.siteState || ""} ${opp.sitePostcode || ""}`.trim(),
  );
  const contactAttempts = Array.isArray(opp.contactAttempts) ? opp.contactAttempts : [];

  const rows = [
    {
      key: "contact",
      label: "Client contacted",
      value: opp.needsClientContact
        ? `${contactAttempts.length} attempt${contactAttempts.length === 1 ? "" : "s"} logged`
        : "Not needed",
      done: !opp.needsClientContact || contactAttempts.length > 0,
    },
    { key: "customer", label: "Customer details", value: name, done: filled(name) },
    {
      key: "contactDetails",
      label: "Phone & email",
      value: [opp.customerPhone, opp.customerEmail].filter(Boolean).join(" · "),
      done: filled(opp.customerPhone) && filled(opp.customerEmail),
    },
    { key: "address", label: "Site address", value: address, done: filled(opp.siteLine1) && filled(opp.sitePostcode) },
    {
      key: "service",
      label: "Service requirement",
      value: serviceRequirementLabel(opp.serviceRequirement),
      done: filled(opp.serviceRequirement),
    },
    {
      key: "billing",
      label: "Billing address",
      value: opp.billingSameAsSite === "yes" ? "Same as site" : opp.customerBillingAddress,
      done: filled(opp.billingSameAsSite),
    },
    {
      key: "measurements",
      label: "Roof / site measurements",
      value: estimationInputFromOpp(opp).roofMeasurements,
      done: filled(estimationInputFromOpp(opp).roofMeasurements),
    },
    { key: "storeys", label: "House type", value: storeyLabel(opp.propertyStoreys), done: filled(opp.propertyStoreys) },
    { key: "roof", label: "Roof type", value: roofTypeLabel(opp.roofType), done: filled(opp.roofType) },
    {
      key: "phase",
      label: "Electrical phase",
      value: electricalPhaseLabel(opp.electricalPhase),
      done: filled(opp.electricalPhase),
    },
    {
      key: "bills",
      label: "Electricity bills",
      value: opp.energyHasBills ? "On file" : billCount ? `${billCount} attached` : "",
      done: Boolean(opp.energyHasBills) || billCount > 0,
    },
    {
      key: "usage",
      label: "Annual usage",
      value: opp.energyAnnualKwh ? `${formatNumber(opp.energyAnnualKwh)} kWh` : "",
      done: filled(opp.energyAnnualKwh),
    },
    {
      key: "finance",
      label: "Finance assistance",
      value: opp.financeAssistance === "yes" ? `Needed — ${opp.financeNotes || "details on the lead"}` : opp.financeAssistance,
      done: filled(opp.financeAssistance),
    },
    {
      key: "siteRequirements",
      label: "Site requirements & extra costs",
      value: opp.siteRequirementsNone ? "None identified" : opp.siteSpecificRequirements,
      done: Boolean(opp.siteRequirementsNone) || filled(opp.siteSpecificRequirements),
    },
    {
      key: "timeframe",
      label: "Preferred timeframe",
      value: installTimeframeLabel(opp.preferredInstallTimeframe),
      done: filled(opp.preferredInstallTimeframe),
    },
    {
      key: "location",
      label: "Preferred location",
      value: opp.preferredInstallLocation,
      done: filled(opp.preferredInstallLocation),
    },
    {
      key: "intent",
      label: "Genuine interest confirmed",
      value: opp.customerIntentConfirmed ? "Confirmed" : "",
      done: Boolean(opp.customerIntentConfirmed),
    },
    {
      key: "comments",
      label: "Initial requirements & comments",
      value: opp.customerComments,
      done: filled(opp.customerComments),
    },
    {
      key: "source",
      label: "Where they got our details",
      value: `${leadSourceLabel(opp.leadSource)}${opp.leadSourceDetails ? ` — ${opp.leadSourceDetails}` : ""}`,
      done: filled(opp.leadSource),
    },
  ];
  return rows;
}

/**
 * Titles the optional rows are grouped under, in the order they are shown.
 * Every row carries one, so the lead form and the estimation panel lay the
 * same rows out under the same headings instead of as one flat list.
 */
export const TECHNICAL_GROUP = "Technical & Electrical Specification";

export const OPTIONAL_GROUPS = [
  "Site & Inspection",
  TECHNICAL_GROUP,
  "Installation, Permits & Utility",
  "Customer-Specific Notes",
];

/**
 * The optional estimation-input rows. Each carries the control estimation
 * needs to fill it in when sales left it blank — `field` is the key inside
 * the opportunity's estimationInput object, and `group` the heading it sits
 * under.
 */
export function leadOptionalItems(opp, { drawingCount = 0, sitePhotoCount = 0 } = {}) {
  const input = estimationInputFromOpp(opp);
  const rows = [
    {
      group: "Site & Inspection",
      field: "preSiteInspectionRequired",
      label: "Pre-site inspection required",
      type: "yesno",
      value: input.preSiteInspectionRequired,
      display: input.preSiteInspectionRequired,
    },
    {
      group: "Site & Inspection",
      field: "siteVisitCompleted",
      label: "Site visit completed",
      type: "checkbox",
      value: input.siteVisitCompleted,
      display: input.siteVisitCompleted ? "Yes" : "",
      onlyWhen: input.preSiteInspectionRequired === "yes",
    },
    {
      group: "Site & Inspection",
      field: "__sitePhotos",
      label: "Site photos",
      type: "readonly",
      value: sitePhotoCount ? String(sitePhotoCount) : "",
      display: sitePhotoCount ? `${sitePhotoCount} attached` : "",
      onlyWhen: input.preSiteInspectionRequired === "yes",
    },

    // ---- Technical & Electrical Specification ----
    {
      group: TECHNICAL_GROUP,
      field: "existingElectrical",
      label: "Existing electrical system",
      type: "textarea",
      value: input.existingElectrical,
    },
    {
      // Inherited from lead qualification — never asked for a second time.
      group: TECHNICAL_GROUP,
      field: "__electricalPhase",
      label: "Electrical phase",
      type: "readonly",
      value: opp?.electricalPhase || "",
      display: opp?.electricalPhase
        ? `${electricalPhaseLabel(opp.electricalPhase)} — confirmed at lead qualification`
        : "",
    },
    {
      group: TECHNICAL_GROUP,
      field: "switchboardCondition",
      label: "Main switchboard / DB",
      type: "select",
      options: SWITCHBOARD_CONDITIONS,
      value: input.switchboardCondition,
      display: label(SWITCHBOARD_CONDITIONS, input.switchboardCondition),
    },
    {
      group: TECHNICAL_GROUP,
      field: "isRetrofit",
      label: "Retrofit to an existing system",
      type: "yesno",
      value: input.isRetrofit,
    },
    {
      group: TECHNICAL_GROUP,
      field: "existingSolarKw",
      label: "Existing solar system (kW)",
      type: "number",
      value: input.existingSolarKw,
      onlyWhen: input.isRetrofit === "yes",
    },
    {
      group: TECHNICAL_GROUP,
      field: "existingInverter",
      label: "Existing inverter",
      type: "text",
      value: input.existingInverter,
      onlyWhen: input.isRetrofit === "yes",
    },
    {
      group: TECHNICAL_GROUP,
      field: "existingBattery",
      label: "Existing battery / storage",
      type: "text",
      value: input.existingBattery,
      onlyWhen: input.isRetrofit === "yes",
    },
    { group: TECHNICAL_GROUP, field: "panelQty", label: "Solar panel quantity", type: "number", value: input.panelQty },
    {
      group: TECHNICAL_GROUP,
      field: "panelCapacityW",
      label: "Panel capacity (W)",
      type: "number",
      value: input.panelCapacityW,
    },
    {
      group: TECHNICAL_GROUP,
      field: "preferredBrands",
      label: "Preferred brands / models",
      type: "text",
      value: input.preferredBrands,
    },
    {
      group: TECHNICAL_GROUP,
      field: "inverterBrandModel",
      label: "Inverter brand & model",
      type: "text",
      value: input.inverterBrandModel,
    },
    {
      group: TECHNICAL_GROUP,
      field: "batteryBrandModel",
      label: "Battery brand & model",
      type: "text",
      value: input.batteryBrandModel,
    },
    {
      group: TECHNICAL_GROUP,
      field: "backupRequirement",
      label: "Backup requirement",
      type: "select",
      options: BACKUP_OPTIONS,
      value: input.backupRequirement,
      display: label(BACKUP_OPTIONS, input.backupRequirement),
    },
    {
      group: TECHNICAL_GROUP,
      field: "batteryCapacityKwh",
      label: "Battery capacity (kWh)",
      type: "number",
      value: input.batteryCapacityKwh,
    },
    {
      group: TECHNICAL_GROUP,
      field: "backupDuration",
      label: "Backup duration",
      type: "text",
      value: input.backupDuration,
    },
    {
      group: TECHNICAL_GROUP,
      field: "loadRequirements",
      label: "Electrical load requirements",
      type: "textarea",
      value: input.loadRequirements,
    },
    {
      group: TECHNICAL_GROUP,
      field: "switchboardUpgrade",
      label: "Switchboard upgrade required",
      type: "yesno",
      value: input.switchboardUpgrade,
    },
    {
      group: TECHNICAL_GROUP,
      field: "cableRequirements",
      label: "Cable, conduit & trunking",
      type: "textarea",
      value: input.cableRequirements,
    },
    {
      group: TECHNICAL_GROUP,
      field: "mountingRequirements",
      label: "Mounting / roof structure",
      type: "textarea",
      value: input.mountingRequirements,
    },
    {
      group: TECHNICAL_GROUP,
      field: "siteConstraints",
      label: "Shading, orientation & constraints",
      type: "textarea",
      value: input.siteConstraints,
    },

    // ---- Installation, Permits & Utility ----
    {
      group: "Installation, Permits & Utility",
      field: "specialRequirements",
      label: "Special installation requirements",
      type: "textarea",
      value: input.specialRequirements,
    },
    {
      group: "Installation, Permits & Utility",
      field: "permits",
      label: "Permits & approvals",
      type: "permits",
      value: (input.permits || []).length ? input.permits : "",
      display: (input.permits || []).map((key) => label(PERMIT_OPTIONS, key)).join(", "),
    },
    {
      group: "Installation, Permits & Utility",
      field: "vppEligibility",
      label: "VPP eligibility",
      type: "select",
      options: VPP_OPTIONS,
      value: input.vppEligibility,
      display: label(VPP_OPTIONS, input.vppEligibility),
    },
    {
      group: "Installation, Permits & Utility",
      field: "meterRequirements",
      label: "Utility / meter requirements",
      type: "text",
      value: input.meterRequirements,
    },
    {
      group: "Installation, Permits & Utility",
      field: "__drawings",
      label: "Drawings, layouts & SLD",
      type: "readonly",
      value: drawingCount ? String(drawingCount) : "",
      display: drawingCount ? `${drawingCount} attached` : "",
    },

    // ---- Customer-Specific Notes ----
    {
      group: "Customer-Specific Notes",
      field: "inclusions",
      label: "Customer inclusions",
      type: "textarea",
      value: input.inclusions,
    },
    {
      group: "Customer-Specific Notes",
      field: "exclusions",
      label: "Customer exclusions",
      type: "textarea",
      value: input.exclusions,
    },
  ];

  return rows
    .filter((row) => row.onlyWhen === undefined || row.onlyWhen)
    .map((row) => ({
      ...row,
      done: row.type === "checkbox" ? Boolean(row.value) : filled(row.value),
      display: row.display ?? String(row.value ?? ""),
    }));
}

/** The optional rows split into their headings, empty groups dropped. */
export function groupOptionalItems(rows) {
  return OPTIONAL_GROUPS.map((title) => ({
    title,
    rows: rows.filter((row) => row.group === title),
  })).filter((group) => group.rows.length > 0);
}

export const countDone = (rows) => rows.filter((r) => r.done).length;
