// Minimal input checks shared by forms.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isBlank(value) {
  return !String(value ?? "").trim();
}

export function isEmail(value) {
  return EMAIL_RE.test(String(value ?? "").trim());
}

export function isPositiveNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0;
}

/** yyyy-mm-dd with a plausible year (what <input type="date"> should produce). */
export function isDateInput(value) {
  const v = String(value ?? "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  if (y < 1900 || y > 2100 || m < 1 || m > 12 || d < 1 || d > 31) return false;
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

export function minLength(value, length) {
  return String(value ?? "").length >= length;
}

/** Role codes: 2–20 chars, A–Z 0–9 _, starting with a letter (mirrors prestige-be). */
export function isRoleCode(value) {
  return /^[A-Z][A-Z0-9_]{1,19}$/.test(String(value ?? ""));
}

/** Permission codes look like "area.action" (mirrors prestige-be). */
export function isPermissionCode(value) {
  const v = String(value ?? "");
  return v.length <= 50 && /^[a-z][a-z0-9_]*(\.[a-z0-9_]+)+$/.test(v);
}

/** Page codes: 2–30 chars of a–z 0–9 - _, starting with a letter. */
export function isPageCode(value) {
  return /^[a-z][a-z0-9_-]{1,29}$/.test(String(value ?? ""));
}

/** Page paths look like "/pipeline". */
export function isPagePath(value) {
  return /^\/[a-z0-9\-/]*$/.test(String(value ?? ""));
}
