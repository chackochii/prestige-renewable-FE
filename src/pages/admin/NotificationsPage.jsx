// Inbox: the notifications the API raised for you — assignments, requests and
// responses from other teams, stage changes, won/lost and overdue items.
// Stored server-side, marked read, and pushed live while the app is open (see
// hooks/useNotificationFeed).

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { BellOff, CheckCheck } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import Alert from "@/components/Alert";
import { eventLabel, priorityMeta, PRIORITIES } from "@/constants/notifications";
import { timeAgo } from "@/helpers/dateTimeHelpers";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  fetchNotificationEvents,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "@/slices/inboxSlice";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { useNotifications } from "@/hooks/useNotifications";

export default function NotificationsPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { unit } = useBusinessUnit();
  const { error: notifyError } = useNotifications();
  const { items, unread, status, error, events } = useAppSelector((s) => s.inbox);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [priority, setPriority] = useState("");

  const query = useMemo(
    () => ({ ...(unreadOnly ? { unread: 1 } : {}), ...(priority ? { priority } : {}) }),
    [unreadOnly, priority],
  );

  useEffect(() => {
    dispatch(fetchNotifications(query));
  }, [query, dispatch]);

  useEffect(() => {
    if (!events.length) dispatch(fetchNotificationEvents());
  }, [events.length, dispatch]);

  const open = (notification) => {
    if (!notification.read) dispatch(markNotificationRead(notification.id));
    if (notification.opportunityId) navigate(`/opportunities/${notification.opportunityId}`);
  };

  const readAll = async () => {
    try {
      await dispatch(markAllNotificationsRead()).unwrap();
    } catch (err) {
      notifyError(typeof err === "string" ? err : err?.message || "Could not mark them read.");
    }
  };

  return (
    <>
      <PageHeader
        title="Inbox"
        description={`Notices for you in ${unit?.name || "this unit"}: requests from other teams, assignments, stage changes and overdue items. High-priority notices also appear as a message when they arrive.`}
        actions={
          <>
            <Link to="/requests" className="btn btn-ghost">
              Requests &amp; assignments
            </Link>
            {unread ? (
              <button type="button" className="btn btn-ghost" onClick={readAll}>
                <CheckCheck size={16} /> Mark all read
              </button>
            ) : null}
          </>
        }
      />

      <div className="toolbar">
        <label className="check" style={{ margin: 0 }}>
          <input type="checkbox" checked={unreadOnly} onChange={(e) => setUnreadOnly(e.target.checked)} /> Unread only
          {unread ? ` (${unread})` : ""}
        </label>
        <select className="select" value={priority} onChange={(e) => setPriority(e.target.value)} aria-label="Priority filter">
          <option value="">All priorities</option>
          {PRIORITIES.map((key) => (
            <option key={key} value={key}>
              {priorityMeta(key).label}
            </option>
          ))}
        </select>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="card card-pad">
        {status === "loading" && !items.length ? (
          <LoadingState label="Loading your inbox…" />
        ) : items.length === 0 ? (
          <EmptyState
            icon={<BellOff size={28} strokeWidth={1.5} />}
            title="Nothing here"
            body={
              unreadOnly || priority
                ? "Nothing matches this filter."
                : "You're all caught up. Requests, assignments and overdue records will land here."
            }
          />
        ) : (
          items.map((n) => {
            const meta = priorityMeta(n.priority);
            return (
              <button
                key={n.id}
                type="button"
                className={`list-row notice${n.read ? "" : " unread"}`}
                onClick={() => open(n)}
                style={{ width: "100%", textAlign: "left" }}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="row-title">
                    {n.read ? null : <span className="notice-dot" aria-label="Unread" />}
                    {n.title}
                  </div>
                  <div className="row-meta">
                    {n.body || eventLabel(n.event, events)}
                    {n.opportunityNumber ? ` · ${n.opportunityNumber}` : ""}
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, whiteSpace: "nowrap" }}>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  <span className="row-meta">{timeAgo(n.createdAt)}</span>
                </div>
              </button>
            );
          })
        )}
      </div>
    </>
  );
}
