// In-app notifications: the inbox reads plus the live stream.
//
// The stream is Server-Sent Events. EventSource cannot set an Authorization
// header, so the browser asks for a short-lived stream token over the normal
// API and puts that in the URL — the session token never appears in one (the
// same approach as document links).

import { apiClient, unwrap, unwrapList } from "./client";

/** params: { unread?, priority?, event?, page?, pageSize? } → { items, total, page, pageSize, unread } */
export async function listNotifications(params = {}) {
  const response = await apiClient.get("/notifications", { params });
  return { ...unwrapList(response), unread: response.data?.unread ?? 0 };
}

/** → { unread } */
export async function getUnreadCount() {
  return unwrap(await apiClient.get("/notifications/unread-count"));
}

/** The event catalogue with each event's default priority. */
export async function listNotificationEvents() {
  return unwrap(await apiClient.get("/notifications/events"));
}

export async function markNotificationRead(id, read = true) {
  return unwrap(await apiClient.patch(`/notifications/${id}/read`, { read }));
}

/** → { updated } */
export async function markAllNotificationsRead() {
  return unwrap(await apiClient.post("/notifications/read-all"));
}

/** → { token } — short-lived, opens the stream and nothing else. */
export async function createStreamToken() {
  return unwrap(await apiClient.post("/notifications/stream-token"));
}

export function notificationStreamUrl(token) {
  const base = String(apiClient.defaults.baseURL || "/api").replace(/\/$/, "");
  return `${base}/notifications/stream?token=${encodeURIComponent(token)}`;
}
