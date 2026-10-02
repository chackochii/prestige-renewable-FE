// The approvals a job can need come from its unit's catalogue
// (unit.approvalTypes, edited on Admin → Unit settings); the ones it does
// need are keys on the record (opportunity.requiredApprovals). These read the
// two together for the lead form, the estimation screen and the approvals
// stage.

/** The unit's approval types as [{ key, label }], in the unit's order. */
export function catalogueOf(unit) {
  return (Array.isArray(unit?.approvalTypes) ? unit.approvalTypes : [])
    .filter((type) => type && typeof type.key === "string" && type.key.trim())
    .map((type) => ({ key: type.key.trim(), label: type.label || type.key }));
}

/** The keys a record has ticked, as an array. */
export function requiredKeysOf(opp) {
  return Array.isArray(opp?.requiredApprovals) ? opp.requiredApprovals : [];
}

/** The ticked approvals with their labels, in catalogue order; keys the unit no longer lists keep their key as the label. */
export function requiredApprovalsOf(opp, unit) {
  const catalogue = catalogueOf(unit);
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
  return opp?.financeAssistance === "yes" ? { finance: `Sales noted finance assistance${opp.financeNotes ? ` — ${opp.financeNotes}` : ""}` } : {};
}
