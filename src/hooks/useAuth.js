// Auth hook: current user, role/permission checks, login/logout.

import { useCallback, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import { completePasswordSetup as completePasswordSetupThunk, fetchMe, login as loginThunk, logout as logoutAction } from "@/slices/authSlice";
import {
  hasAnyPermission as anyPermission,
  hasPermission as permission,
  hasRole as role,
  isSuperAdmin as superAdmin,
  roleNames,
} from "@/constants/roles";

export function useAuth() {
  const dispatch = useAppDispatch();
  const { user, token, status, error, initialized, expiresAt, notice, noticeSeen } = useAppSelector((s) => s.auth);
  const catalog = useAppSelector((s) => s.roles.roles);

  // → { token, user } signed in, or { passwordSetup: { token, user } } when the person must choose their own password first.
  const login = useCallback(
    (email, password) => dispatch(loginThunk({ email, password })).unwrap(),
    [dispatch],
  );
  const completePasswordSetup = useCallback(
    (setupToken, newPassword) => dispatch(completePasswordSetupThunk({ setupToken, newPassword })).unwrap(),
    [dispatch],
  );
  const logout = useCallback(() => dispatch(logoutAction()), [dispatch]);
  const refresh = useCallback(() => dispatch(fetchMe()), [dispatch]);

  const hasRole = useCallback((codes) => role(user, codes), [user]);
  const hasPermission = useCallback((code) => permission(user, code), [user]);
  const hasAnyPermission = useCallback((codes) => anyPermission(user, codes), [user]);

  const roleLabels = useMemo(() => roleNames(user, catalog), [user, catalog]);

  return {
    user,
    token,
    status,
    error,
    initialized,
    expiresAt,
    notice,
    noticeSeen,
    isAuthenticated: Boolean(user && token),
    isSuperAdmin: superAdmin(user),
    roleLabels,
    hasRole,
    hasPermission,
    hasAnyPermission,
    login,
    completePasswordSetup,
    logout,
    refresh,
  };
}
