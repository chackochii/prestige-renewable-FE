// Role helpers. The role catalog itself is data (GET /roles) and a user may
// hold any number of role codes; access decisions are made on the permission
// codes the API derives from those roles. The only role the frontend knows by
// name is the ADM break-glass superadmin, mirrored from prestige-be.

export const SUPER_ROLE_CODE = "ADM";

// Role codes used only as *hints* when pre-filtering people pickers (who is
// an estimator, who is sales). If nobody in the unit holds a hinted role the
// picker falls back to every user in the unit, so a renamed catalog never
// blocks a form.
export const ROLE_HINTS = {
  estimator: ["DEST"],
  sales: ["SREP", "SMM"],
  siteOps: ["SITEOM", "BOM", "OPC"],
};

export function userRoles(user) {
  return Array.isArray(user?.roles) ? user.roles : [];
}

export function isSuperAdmin(user) {
  return userRoles(user).includes(SUPER_ROLE_CODE);
}

/** True when the user holds at least one of the given role codes. */
export function hasRole(user, codes) {
  const list = Array.isArray(codes) ? codes : [codes];
  const roles = userRoles(user);
  return list.some((code) => roles.includes(code));
}

/** Permission check with the ADM bypass (same rule as the API). */
export function hasPermission(user, code) {
  if (!user) return false;
  if (!code) return true;
  if (isSuperAdmin(user)) return true;
  return Array.isArray(user.permissions) && user.permissions.includes(code);
}

export function hasAnyPermission(user, codes) {
  const list = Array.isArray(codes) ? codes : [codes];
  return list.some((code) => hasPermission(user, code));
}

export function hasAllPermissions(user, codes) {
  const list = Array.isArray(codes) ? codes : [codes];
  return list.every((code) => hasPermission(user, code));
}

/** Display name for a role code from the runtime catalog. */
export function roleName(code, catalog = []) {
  return catalog.find((r) => r.code === code)?.name || code;
}

export function roleNames(user, catalog = []) {
  return userRoles(user).map((code) => roleName(code, catalog));
}

/** Users holding a hinted role; falls back to the full list when none do. */
export function usersWithRoleHint(users = [], hint) {
  const codes = ROLE_HINTS[hint] || [];
  const matched = users.filter((u) => userRoles(u).some((c) => codes.includes(c)));
  return matched.length ? matched : users;
}
