// Prestige brand colours and typography.
// Mirrors the :root tokens in src/index.css so JS code (charts, inline styles)
// can use the same values.

export const colors = {
  ink: "#241c14",
  inkSoft: "#6b5d4f",
  muted: "#9c8d7d",
  line: "#ece0d0",
  lineStrong: "#ddccb3",
  paper: "#f7ede1",
  paper2: "#f0e2cd",
  surface: "#ffffff",
  surface2: "#faf5ec",
  navy: "#12213b",
  navy2: "#0b1830",
  brand: "#e8603c",
  brand2: "#d14e2c",
  accent: "#f2a93c",
  accentSoft: "#fdf0da",
  success: "#2f9e5c",
  successBg: "#e8faf0",
  warning: "#d97706",
  warningBg: "#fdf1de",
  danger: "#e0483a",
  dangerBg: "#fbe9e5",
  info: "#2f8fb0",
  infoBg: "#e9f4f8",
  neutralBg: "#f2e9dc",
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
