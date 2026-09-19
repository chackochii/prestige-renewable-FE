// Site and property attributes confirmed with the customer while the lead is
// being captured. Estimation needs all of them before it can price the job:
// how many storeys the roof is off the ground, what it is made of, and what
// the switchboard runs on.

/** What the customer wants installed. */
export const SERVICE_REQUIREMENTS = [
  { key: "solar", label: "Solar" },
  { key: "battery", label: "Battery" },
  { key: "both", label: "Both — solar and battery" },
];

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
  { key: "1_3_months", label: "Within 1–3 months" },
  { key: "3_6_months", label: "Within 3–6 months" },
  { key: "6_months_plus", label: "More than 6 months away" },
  { key: "undecided", label: "Not decided yet" },
];

/** Whether finance assistance was discussed, and what the answer was. */
export const FINANCE_OPTIONS = [
  { key: "yes", label: "Yes — finance assistance needed" },
  { key: "no", label: "No — paying without finance" },
];

const label = (list, key) => list.find((o) => o.key === key)?.label || key || "—";

export const serviceRequirementLabel = (key) => label(SERVICE_REQUIREMENTS, key);
export const storeyLabel = (key) => label(STOREY_OPTIONS, key);
export const roofTypeLabel = (key) => label(ROOF_TYPES, key);
export const electricalPhaseLabel = (key) => label(ELECTRICAL_PHASES, key);
export const installTimeframeLabel = (key) => label(INSTALL_TIMEFRAMES, key);
