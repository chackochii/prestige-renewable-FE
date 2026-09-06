// Small derived values for opportunity records.

export function oppTitle(opp) {
  return opp?.customerLegalName || opp?.customerTradingName || opp?.number || "Untitled";
}

/** Contracted value when accepted, otherwise the salesperson's early sizing. */
export function oppValue(opp) {
  const accepted = Number(opp?.acceptedValue) || 0;
  const estimated = Number(opp?.estimatedValue) || 0;
  return accepted || estimated;
}

export function oppSite(opp) {
  return [opp?.siteSuburb, opp?.siteState].filter(Boolean).join(" ");
}
