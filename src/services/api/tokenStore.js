// Persisted session (JWT + user snapshot) so a refresh keeps people signed in.
// The API re-validates the token on every request, so a disabled account or a
// role change takes effect immediately regardless of what is cached here.

const SESSION_KEY = "prestige.session";
const UNIT_KEY = "prestige.unit";

function read(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(key, value) {
  try {
    if (value === null || value === undefined) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage can be unavailable (private mode, quota). The session then
    // simply lives for the tab.
  }
}

export function loadSession() {
  const session = read(SESSION_KEY);
  return session && typeof session.token === "string" ? session : null;
}

export function saveSession(session) {
  write(SESSION_KEY, session);
}

export function clearSession() {
  write(SESSION_KEY, null);
  write(UNIT_KEY, null);
}

export function getToken() {
  return loadSession()?.token ?? null;
}

/**
 * Expiry (ms since epoch) read from the JWT's `exp` claim, or null when the
 * token has none. Read-only: the API still verifies the signature.
 */
export function decodeTokenExpiry(token) {
  try {
    const payload = String(token).split(".")[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, "+").replace(/_/g, "/"));
    const { exp } = JSON.parse(json);
    return Number.isFinite(exp) ? exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isTokenExpired(token, skewMs = 0) {
  const expiresAt = decodeTokenExpiry(token);
  return expiresAt !== null && Date.now() + skewMs >= expiresAt;
}

/** Remembered business unit per user id. */
export function loadUnitChoice(userId) {
  const choices = read(UNIT_KEY) || {};
  return choices[String(userId)] ?? null;
}

export function saveUnitChoice(userId, unitId) {
  const choices = read(UNIT_KEY) || {};
  if (unitId === null || unitId === undefined) delete choices[String(userId)];
  else choices[String(userId)] = unitId;
  write(UNIT_KEY, choices);
}
