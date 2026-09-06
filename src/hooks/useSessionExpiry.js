// Watches the JWT expiry: warns a few minutes before, signs out at the
// moment it lapses, and re-checks whenever the tab regains focus (timers
// don't fire reliably while a laptop sleeps).

import { useEffect, useRef } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/store";
import { logout, SESSION_NOTICES } from "@/slices/authSlice";
import { pushToast } from "@/slices/notificationsSlice";

const WARN_BEFORE_MS = 5 * 60 * 1000;

export function useSessionExpiry() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const expiresAt = useAppSelector((s) => s.auth.expiresAt);
  const token = useAppSelector((s) => s.auth.token);
  const warned = useRef(false);
  const here = useRef(location);
  here.current = location;

  useEffect(() => {
    warned.current = false;
  }, [token]);

  useEffect(() => {
    if (!token || !expiresAt) return undefined;

    const expire = () => {
      dispatch(logout({ notice: SESSION_NOTICES.EXPIRED }));
      navigate("/login", { replace: true, state: { from: here.current } });
    };
    const warn = () => {
      if (warned.current) return;
      warned.current = true;
      const minutes = Math.max(1, Math.round((expiresAt - Date.now()) / 60000));
      dispatch(
        pushToast({
          message: `Your session ends in about ${minutes} minute${minutes === 1 ? "" : "s"}. Save your work — you'll be asked to sign in again.`,
          tone: "info",
        }),
      );
    };

    const check = () => {
      const left = expiresAt - Date.now();
      if (left <= 0) expire();
      else if (left <= WARN_BEFORE_MS) warn();
    };

    check();
    const timers = [];
    const untilWarn = expiresAt - WARN_BEFORE_MS - Date.now();
    const untilExpire = expiresAt - Date.now();
    // setTimeout caps at ~24.8 days; clamp so a long-lived token doesn't overflow.
    const clamp = (ms) => Math.min(Math.max(ms, 0), 2 ** 31 - 1);
    if (untilWarn > 0) timers.push(setTimeout(warn, clamp(untilWarn)));
    if (untilExpire > 0) timers.push(setTimeout(expire, clamp(untilExpire)));

    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", check);
    return () => {
      timers.forEach(clearTimeout);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", check);
    };
  }, [token, expiresAt, dispatch, navigate]);
}
