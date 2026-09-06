// Toast notifications hook.

import { useCallback } from "react";
import { useAppDispatch } from "@/store";
import { pushToast } from "@/slices/notificationsSlice";

export function useNotifications() {
  const dispatch = useAppDispatch();

  const notify = useCallback(
    (message, tone = "success") => dispatch(pushToast({ message, tone })),
    [dispatch],
  );

  return {
    notify,
    success: useCallback((message) => notify(message, "success"), [notify]),
    info: useCallback((message) => notify(message, "info"), [notify]),
    error: useCallback((message) => notify(message, "danger"), [notify]),
  };
}
