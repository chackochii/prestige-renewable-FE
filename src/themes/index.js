// Prestige brand colours and typography.
// Mirrors the :root tokens in src/index.css so JS code (charts, inline styles)
// can use the same values.

export const colors = {
  ink: "#0f1b2d",
  inkSoft: "#5a6b80",
  muted: "#6b7b90",
  line: "#dde3ea",
  lineStrong: "#c8d1dc",
  paper: "#f5f7fa",
  paper2: "#eef2f7",
  surface: "#ffffff",
  surface2: "#eef2f7",
  navy: "#0f1f3d",
  navy2: "#0b1830",
  brand: "#0f766e",
  brand2: "#0b5e58",
  accent: "#b8860b",
  accentSoft: "#f6efdc",
  success: "#15803d",
  successBg: "#e7f6ec",
  warning: "#b45309",
  warningBg: "#fdf1de",
  danger: "#b91c1c",
  dangerBg: "#fbe8e8",
  info: "#1d4ed8",
  infoBg: "#e8eefc",
  neutralBg: "#eef2f7",
};

/** Semantic tone → colour, used by badges, dots and charts. */
export const tones = {
  success: colors.success,
  warning: colors.warning,
  danger: colors.danger,
  info: colors.info,
  neutral: colors.muted,
};

export const typography = {
  fontFamily: '"Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif',
};

export const theme = { colors, tones, typography };
