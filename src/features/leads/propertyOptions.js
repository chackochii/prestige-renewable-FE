// Site and property attributes confirmed with the customer while the lead is
// being captured. Estimation needs all of them before it can price the job:
// how many storeys the roof is off the ground, what it is made of, and what
// the switchboard runs on.

/** What the customer wants installed. */
/**
 * Job requirement: any of these, ticked as checkboxes and stored as a list
 * ("solar,battery"). A lead saved before carries "both", which reads as solar
 * and battery.
 */
export const SERVICE_REQUIREMENTS = [
  { key: "solar", label: "Solar" },
  { key: "battery", label: "Battery" },
  { key: "ev", label: "EV" },
  { key: "other", label: "Other" },
];

/** The job requirements ticked on a lead, as keys. */
export const serviceRequirementKeys = (value) =>
  String(value ?? "")
    .split(",")
    .map((key) => key.trim())
    .filter(Boolean)
    .flatMap((key) => (key === "both" ? ["solar", "battery"] : [key]));

export const STOREY_OPTIONS = [
  { key: "single", label: "Single storey" },
  { key: "double", label: "Double storey" },
];

export const ROOF_TYPES = [
  { key: "tin", label: "Tin" },
  { key: "tile", label: "Tile" },
  { key: "colorbond", label: "Colorbond" },
];

export const ELECTRICAL_PHASES = [
  { key: "1_phase", label: "1 Phase" },
  { key: "3_phase", label: "3 Phase" },
];

export const INSTALL_TIMEFRAMES = [
  { key: "asap", label: "As soon as possible" },
  { key: "1_2_weeks", label: "Within 1–2 weeks" },
  { key: "2_4_weeks", label: "Within 2–4 weeks" },
  { key: "4_8_weeks", label: "Within 4–8 weeks" },
  { key: "1_3_months", label: "Within 1–3 months" },
  { key: "3_6_months", label: "Within 3–6 months" },
  { key: "6_months_plus", label: "More than 6 months away" },
  { key: "undecided", label: "Not decided yet" },
];

/**
 * The month-based timeframes leads carried before the list went to weeks.
 * No longer offered, but a saved lead keeps its answer and still reads it.
 */
export const LEGACY_INSTALL_TIMEFRAMES = [{ key: "8_weeks_plus", label: "More than 8 weeks away" }];

/** Whether finance assistance was discussed, and what the answer was. */
export const FINANCE_OPTIONS = [
  { key: "yes", label: "Yes" },
  { key: "no", label: "No" },
];

const label = (list, key) => list.find((o) => o.key === key)?.label || key || "-";

export const serviceRequirementLabel = (key) => label(SERVICE_REQUIREMENTS, key);
/**
 * What a lead's service requirement reads as: "Other" shows the custom value
 * typed for it (estimationInput.serviceRequirementOther).
 */
export const serviceRequirementText = (value, other) =>
  serviceRequirementKeys(value)
    .map((key) => (key === "other" ? String(other ?? "").trim() || "Other" : serviceRequirementLabel(key)))
    .join(", ");
export const storeyLabel = (key) => label(STOREY_OPTIONS, key);
export const roofTypeLabel = (key) => label(ROOF_TYPES, key);
export const electricalPhaseLabel = (key) => label(ELECTRICAL_PHASES, key);
export const installTimeframeLabel = (key) => label([...INSTALL_TIMEFRAMES, ...LEGACY_INSTALL_TIMEFRAMES], key);
