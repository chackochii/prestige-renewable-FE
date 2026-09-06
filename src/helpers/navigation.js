// Sidebar navigation is data: the page registry (GET /pages) filtered by the
// user's permission codes and the business unit's disabled pages. Only two
// entries are fixed in code — Home (every signed-in user) and the superadmin
// business-unit screen (ADM only, deliberately outside the registry so it can
// never be granted away or toggled off).

import { hasPermission, isSuperAdmin } from "@/constants/roles";

export const HOME_NAV_ITEM = { code: "home", label: "Home", path: "/", fixed: true };
export const SUPERADMIN_NAV_ITEM = {
  code: "superadmin",
  label: "Business units",
  path: "/superadmin",
  fixed: true,
};

/** Is this registry page visible to the user inside the given unit? */
export function canSeePage(page, user, unit) {
  if (!page || !user) return false;
  if (!hasPermission(user, page.viewPermissionCode)) return false;
  const disabled = Array.isArray(unit?.disabledPages) ? unit.disabledPages : [];
  return !disabled.includes(page.code);
}

/** Where to send someone after sign-in: the page they asked for, or home. */
export function redirectTarget(location) {
  const from = location?.state?.from;
  if (!from?.pathname || from.pathname === "/login" || from.pathname === "/logout") return "/";
  return `${from.pathname}${from.search || ""}${from.hash || ""}`;
}

export function findPage(pages = [], code) {
  return pages.find((p) => p.code === code) || null;
}

/** Nav items for the sidebar, in registry order. */
export function buildNav({ pages = [], user, unit }) {
  const items = [HOME_NAV_ITEM];
  [...pages]
    .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
    .filter((page) => canSeePage(page, user, unit))
    .forEach((page) => items.push({ code: page.code, label: page.label, path: page.path }));
  if (isSuperAdmin(user)) items.push(SUPERADMIN_NAV_ITEM);
  return items;
}
