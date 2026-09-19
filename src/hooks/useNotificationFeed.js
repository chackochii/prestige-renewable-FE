// Live notifications over Server-Sent Events, mounted once by the workspace
// shell. Keeps the bell count and the inbox current, and raises a toast for
// anything high priority so it is not missed.
//
// EventSource reconnects by itself, but it would keep retrying with a stream
// token the server has already expired. So the connection is closed on the
// first error and reopened with a fresh token, backing off each time.

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import { createStreamToken, notificationStreamUrl } from "@/services/api/notificationsApi";
import { fetchUnreadCount, notificationReceived, unreadCountReceived } from "@/slices/inboxSlice";
import { pushToast } from "@/slices/notificationsSlice";

const FIRST_RETRY_MS = 2000;
const MAX_RETRY_MS = 60000;

export function useNotificationFeed() {
  const dispatch = useAppDispatch();
  const token = useAppSelector((s) => s.auth.token);
  const userId = useAppSelector((s) => s.auth.user?.id);

  useEffect(() => {
    if (!token || !userId) return undefined;

    let source = null;
    let retryTimer = null;
    let retryMs = FIRST_RETRY_MS;
    let stopped = false;

    const scheduleRetry = () => {
      if (stopped || retryTimer) return;
      retryTimer = setTimeout(() => {
        retryTimer = null;
        retryMs = Math.min(retryMs * 2, MAX_RETRY_MS);
        connect();
      }, retryMs);
    };

    const connect = async () => {
      if (stopped) return;
      try {
        const { token: streamToken } = await createStreamToken();
        if (stopped) return;
        source = new EventSource(notificationStreamUrl(streamToken));

        source.addEventListener("ready", (event) => {
          retryMs = FIRST_RETRY_MS; // the connection works; reset the backoff
          try {
            dispatch(unreadCountReceived(JSON.parse(event.data).unread));
          } catch {
            // A malformed frame is not worth breaking the feed over.
          }
        });

        source.addEventListener("notification", (event) => {
          try {
            const notification = JSON.parse(event.data);
            dispatch(notificationReceived(notification));
            if (notification.priority === "high") dispatch(pushToast({ message: notification.title, tone: "info" }));
          } catch {
            // Same again — drop the frame, keep the stream.
          }
        });

        source.onerror = () => {
          source?.close();
          source = null;
          scheduleRetry();
        };
      } catch {
        // Could not mint a token (offline, session gone). The unread count
        // still refreshes when the app next loads the inbox.
        scheduleRetry();
      }
    };

    // Start from a known count even if the stream never opens.
    dispatch(fetchUnreadCount());
    connect();

    return () => {
      stopped = true;
      if (retryTimer) clearTimeout(retryTimer);
      source?.close();
    };
  }, [token, userId, dispatch]);
}
