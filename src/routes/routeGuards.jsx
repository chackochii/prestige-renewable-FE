// Route guards. Access is decided on data delivered at sign-in: the user's
// permission codes (union of all their roles, ADM bypasses everything) and
// the page registry with per-business-unit toggles.

import { useEffect } from "react";
import { matchRoutes, Navigate, Outlet, useLocation } from "react-router-dom";
import LoadingState from "@/components/LoadingState";
import NotFoundPage from "@/pages/public/NotFoundPage";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { useSessionExpiry } from "@/hooks/useSessionExpiry";
import { useAppDispatch, useAppSelector } from "@/store";
import { fetchMe, SESSION_NOTICES } from "@/slices/authSlice";
import { canSeePage, findPage, redirectTarget } from "@/helpers/navigation";
import { pageViewPermission } from "@/constants/permissions";

/** Navigate to /forbidden with enough context to explain why. */
function Forbidden({ reason }) {
  const location = useLocation();
  return <Navigate to="/forbidden" state={{ reason, from: location }} replace />;
}

/**
 * Restores a persisted session, then renders the outlet for signed-in users.
 * When signed out: "/" renders `fallback` (the public landing page), a URL
 * that matches one of `routes` redirects to /login and comes back afterwards,
 * and anything else is a plain 404 — no sign-in detour for a typo.
 */
export function RequireAuth({ fallback = null, routes = null }) {
  const dispatch = useAppDispatch();
  const { isAuthenticated, token, initialized, notice, noticeSeen } = useAuth();
  const location = useLocation();
  useSessionExpiry();

  useEffect(() => {
    if (token && !initialized) dispatch(fetchMe());
  }, [token, initialized, dispatch]);

  if (token && !initialized) return <LoadingState screen label="Restoring your session…" />;
  if (!isAuthenticated) {
    // A session that ended on its own (expired / rejected) goes straight to
    // sign-in so the person sees why, even from the landing URL.
    const ended = notice && notice !== SESSION_NOTICES.SIGNED_OUT && !noticeSeen;
    if (fallback && location.pathname === "/" && !ended) return fallback;
    const known = routes ? matchRoutes(routes, location) !== null : true;
    if (!known) return <NotFoundPage standalone />;
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <Outlet />;
}

/** Renders only when the user holds one of the given role codes (e.g. ADM). */
export function RequireRole({ roles, children }) {
  const { hasRole } = useAuth();
  if (!hasRole(roles)) return <Forbidden reason={{ type: "role", roles }} />;
  return children ?? <Outlet />;
}

/** Renders only when the user holds the permission (or any of `anyOf`). */
export function RequirePermission({ permission, anyOf, children }) {
  const { hasPermission, hasAnyPermission } = useAuth();
  const allowed = anyOf ? hasAnyPermission(anyOf) : hasPermission(permission);
  if (!allowed) return <Forbidden reason={{ type: "permission", codes: anyOf || [permission] }} />;
  return children ?? <Outlet />;
}

/**
 * Guards a registry page: the user needs the page's view permission and the
 * page must be enabled for the business unit they are working in. A page the
 * registry does not know falls back to the conventional page.<code>.view.
 */
export function RequirePage({ code, children }) {
  const { user } = useAuth();
  const { unit } = useBusinessUnit();
  const { items: pages, status } = useAppSelector((s) => s.pages);

  if (status === "idle" || status === "loading") return <LoadingState label="Checking access…" />;

  const page = findPage(pages, code) || { code, viewPermissionCode: pageViewPermission(code) };
  if (!canSeePage(page, user, unit)) {
    const disabled = Array.isArray(unit?.disabledPages) && unit.disabledPages.includes(code);
    return (
      <Forbidden
        reason={
          disabled
            ? { type: "page-disabled", page: page.label || code, unit: unit?.name }
            : { type: "permission", codes: [page.viewPermissionCode].filter(Boolean), page: page.label || code }
        }
      />
    );
  }
  return children ?? <Outlet />;
}

/** Signed-in visitors skip the public screens (login, landing). */
export function RedirectIfAuthenticated({ children }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (isAuthenticated) return <Navigate to={redirectTarget(location)} replace />;
  return children ?? <Outlet />;
}
