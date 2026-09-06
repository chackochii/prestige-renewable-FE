// Toast host: renders transient notifications from the notifications slice.

import { useEffect, useRef } from "react";
import { CircleCheck, Info, TriangleAlert, X } from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store";
import { dismissToast, startDismissToast } from "@/slices/notificationsSlice";

const ICONS = {
  success: <CircleCheck size={18} />,
  danger: <TriangleAlert size={18} />,
  info: <Info size={18} />,
};

const VISIBLE_MS = 3200;
const LEAVE_MS = 400;

export default function NotificationBanner() {
  const dispatch = useAppDispatch();
  const toasts = useAppSelector((s) => s.notifications.toasts);
  const timers = useRef(new Map());

  useEffect(() => {
    const active = timers.current;
    toasts.forEach((toast) => {
      if (active.has(toast.id)) return;
      const hide = setTimeout(() => dispatch(startDismissToast(toast.id)), VISIBLE_MS);
      const remove = setTimeout(() => {
        dispatch(dismissToast(toast.id));
        active.delete(toast.id);
      }, VISIBLE_MS + LEAVE_MS);
      active.set(toast.id, [hide, remove]);
    });
  }, [toasts, dispatch]);

  useEffect(() => {
    const active = timers.current;
    return () => {
      active.forEach((ids) => ids.forEach(clearTimeout));
      active.clear();
    };
  }, []);

  if (!toasts.length) return null;

  return (
    <div className="toast-host" aria-live="polite">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast ${toast.tone} ${toast.leaving ? "leaving" : ""}`.trim()}>
          {ICONS[toast.tone] || ICONS.success}
          <span style={{ flex: 1 }}>{toast.message}</span>
          <button
            type="button"
            className="toast-close"
            aria-label="Dismiss"
            onClick={() => dispatch(dismissToast(toast.id))}
          >
            <X size={14} />
          </button>
        </div>
      ))}
    </div>
  );
}
