// Lead sources. The manual sources can be chosen on the lead form; the
// automated ones are set by inbound-lead conversion only (ad platforms and
// ServiceM8) and are shown read-only.

export const LEAD_TYPES = [
  { key: "residential", label: "Residential" },
  { key: "commercial", label: "Commercial" },
];

export const MANUAL_LEAD_SOURCES = [
  { key: "internal", label: "Internal outreach" },
  { key: "inbound", label: "Inbound enquiry" },
  { key: "referrer", label: "External referrer" },
];

export const AUTOMATED_LEAD_SOURCES = [
  { key: "google_ads", label: "Google Ads" },
  { key: "meta_ads", label: "Meta Ads" },
  { key: "linkedin_ads", label: "LinkedIn Ads" },
  { key: "servicem8", label: "ServiceM8" },
];

export const LEAD_SOURCES = [...MANUAL_LEAD_SOURCES, ...AUTOMATED_LEAD_SOURCES];

export function leadSourceLabel(key) {
  return LEAD_SOURCES.find((s) => s.key === key)?.label || key || "—";
}

// Fallback referrer commission tiers when a unit has no commissionTiers config.
export const DEFAULT_COMMISSION_TIERS = [
  { key: "lead_only", label: "Lead only", rate: 0.02 },
  { key: "lead_sales_support", label: "Lead + sales support", rate: 0.035 },
  { key: "lead_full_sales", label: "Lead + full sales", rate: 0.05 },
];

export function commissionTiersFor(unit) {
  const tiers = Array.isArray(unit?.commissionTiers) ? unit.commissionTiers : [];
  return tiers.length ? tiers : DEFAULT_COMMISSION_TIERS;
}
