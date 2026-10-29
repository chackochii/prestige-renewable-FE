// The approvals a job can need come from its unit's catalogue
// (unit.approvalTypes, edited on Admin → Unit settings); the ones it does
// need are keys on the record (opportunity.requiredApprovals). These read the
// two together for the lead form, the estimation screen and the approvals
// stage.

/** What the standard approvals are called across the portal, whatever the unit's settings still say (UAT, Oct 2026). */
export const APPROVAL_LABELS = {
  dnsp: "Network Connection Approval (DNSP)",
  da: "Council Approval (DA)",
  finance: "Finance Approval",
  strata: "Strata Approval",
  heritage: "Heritage Approval",
  landlord: "Landlord Consent",
  rebate: "Rebate Pre-Approval",
};

/** Not an approval any more - every job needs it, and it is handled at Installation & Handover. */
export const HANDOVER_ONLY_TYPES = ["electrical_safety"];

export const approvalLabel = (key, fallback) => APPROVAL_LABELS[key] ?? fallback ?? key;

/** The unit's approval types as [{ key, label }], in the unit's order. */
export function catalogueOf(unit) {
  return (Array.isArray(unit?.approvalTypes) ? unit.approvalTypes : [])
    .filter((type) => type && typeof type.key === "string" && type.key.trim() && !HANDOVER_ONLY_TYPES.includes(type.key.trim()))
    .map((type) => ({ key: type.key.trim(), label: approvalLabel(type.key.trim(), type.label || type.key) }));
}

/** The keys a record has ticked, as an array. */
/**
 * The approvals one job can need: the unit's catalogue, then any custom ones
 * added to this job (opp.customApprovalTypes). Pass the result where a `unit`
 * is expected — `{ approvalTypes }` is all the pickers read.
 */
export function jobApprovalUnit(unit, opp) {
  const listed = catalogueOf(unit);
  const custom = catalogueOf({ approvalTypes: opp?.customApprovalTypes }).filter((type) => !listed.some((t) => t.key === type.key));
  return { ...unit, approvalTypes: [...listed, ...custom] };
}

export function requiredKeysOf(opp) {
  return Array.isArray(opp?.requiredApprovals) ? opp.requiredApprovals : [];
}

/** The ticked approvals with their labels, in catalogue order; keys the unit no longer lists keep their key as the label. */
export function requiredApprovalsOf(opp, unit) {
  const catalogue = catalogueOf(jobApprovalUnit(unit, opp));
  const keys = requiredKeysOf(opp);
  const listed = catalogue.filter((type) => keys.includes(type.key));
  const unlisted = keys.filter((key) => !catalogue.some((type) => type.key === key)).map((key) => ({ key, label: key }));
  return [...listed, ...unlisted];
}

/** "DNSP, Council DA" — the ticked approvals in a sentence, or the fallback. */
export function requiredApprovalsLabel(opp, unit, fallback = "None marked yet") {
  const list = requiredApprovalsOf(opp, unit);
  return list.length ? list.map((type) => type.label).join(", ") : fallback;
}

/** A hint for the finance option: sales already said the customer wants help with finance. */
export function approvalHints(opp) {
  return opp?.financeAssistance === "yes" ? { finance: `Sales noted finance assistance${opp.financeNotes ? ` - ${opp.financeNotes}` : ""}` } : {};
}
