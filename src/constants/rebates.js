// The rebates a Rebate Pre-Approval can name (UAT, Oct 2026). Each standard
// option knows when it applies to a job - from its equipment and system size
// (`showWhen`); the business can rename, retire or add rebates on Admin →
// Unit settings (unit.metadata.rebateOptions, [{ key, label }]) as schemes
// change. A rebate added there has no rule and is always offered. "No Rebate"
// is always offered and stands alone: it makes the card Not Applicable.
//
// Scheme rules change often - confirm with the business which rebates are
// used before go-live.

import { jobIncludes } from "@/helpers/approvalChecklist";

export const NO_REBATE = "none";
export const OTHER_REBATE = "other";

/** The site already has solar (an existing system recorded on the job) or this job adds it. */
const siteHasSolar = (job) => jobIncludes(job).solar || (Boolean(job?.existingSystem) && job.existingSystem !== "None");
const sizeKw = (job) => Number(job?.system?.sizeKw) || null;

export const REBATE_OPTIONS = [
  {
    key: "stc_solar",
    label: "STC - Solar (SRES)",
    note: "Upfront discount on the quote. The amount decreases each year until the scheme ends in 2030.",
    showWhen: (job) => jobIncludes(job).solar && (sizeKw(job) === null || sizeKw(job) < 100),
  },
  {
    key: "stc_battery",
    label: "STC - Battery (Cheaper Home Batteries)",
    note: "Rate drops every 6 months and is tiered by size: full rate to 14 kWh, 60% from 14–28 kWh, 15% from 28–50 kWh. Record the quote date.",
    showWhen: (job) => jobIncludes(job).battery,
  },
  {
    key: "pdrs_battery",
    label: "PDRS - Battery Incentive (NSW)",
    note: "Eligibility is currently limited - check with the certificate provider.",
    showWhen: (job) => jobIncludes(job).battery && siteHasSolar(job),
  },
  {
    key: "pdrs_vpp",
    label: "PDRS - VPP Incentive (NSW)",
    note: "Needs the VPP provider recorded.",
    showWhen: (job) => jobIncludes(job).battery,
  },
  {
    key: "lgc",
    label: "LGC - Large-Scale (Commercial)",
    note: "Certificates earned over time, not an upfront discount.",
    showWhen: (job) => (sizeKw(job) ?? 0) > 100,
  },
  { key: OTHER_REBATE, label: "Other", note: "Rebate name and notes are required." },
  { key: NO_REBATE, label: "No Rebate", note: "Marks the Rebate Pre-Approval as Not Applicable." },
];

/** The quote builder's rebate types, as the option each one is. Anything else on a quote is Other. */
export const QUOTE_REBATE_OPTION = { STC: "stc_solar", "Federal battery rebate": "stc_battery" };

/**
 * The rebates the business offers: the standard list, or the unit's own
 * (renamed, retired, added). "No Rebate" is always there.
 */
export function rebateCatalogue(unit) {
  const configured = Array.isArray(unit?.metadata?.rebateOptions) ? unit.metadata.rebateOptions.filter((option) => option?.key) : [];
  if (!configured.length) return REBATE_OPTIONS;
  const standard = new Map(REBATE_OPTIONS.map((option) => [option.key, option]));
  const listed = configured.map((option) => ({ ...(standard.get(option.key) ?? {}), key: option.key, label: option.label || standard.get(option.key)?.label || option.key }));
  return listed.some((option) => option.key === NO_REBATE) ? listed : [...listed, standard.get(NO_REBATE)];
}

/** The rebates that apply to this job (its equipment and size), plus any already chosen. */
export function rebateOptionsFor(job, unit, chosen = []) {
  return rebateCatalogue(unit).filter((option) => chosen.includes(option.key) || !option.showWhen || option.showWhen(job));
}
