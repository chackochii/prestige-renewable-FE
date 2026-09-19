// Inbox: what other teams have sent you, and what has come back on the
// requests you raised.
//
// Derived from the requests this person can see (see
// helpers/collaborationEvents.js) until prestige-be has a notification feed —
// the event names there are the catalog it should emit.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bell, BellOff } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import PageHeader from "@/components/PageHeader";
import RequestDetail from "@/features/collaboration/RequestDetail";
import { collaborationNotifications } from "@/helpers/collaborationEvents";
import { formatDate, timeAgo } from "@/helpers/dateTimeHelpers";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { useAppDispatch, useAppSelector } from "@/store";
import { fetchAssignedRequests, fetchRaisedRequests } from "@/slices/collaborationSlice";

export default function NotificationsPage() {
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const { unit, unitId } = useBusinessUnit();
  const { assigned, raised, assignedStatus, assignedError } = useAppSelector((s) => s.collaboration);
  const [onlyHigh, setOnlyHigh] = useState(false);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    if (!unitId) return;
    dispatch(fetchAssignedRequests({ businessUnitId: unitId }));
    dispatch(fetchRaisedRequests({ businessUnitId: unitId }));
  }, [unitId, dispatch]);

  const events = useMemo(
    () => collaborationNotifications({ assigned, raised, user }),
    [assigned, raised, user],
  );
  const rows = onlyHigh ? events.filter((e) => e.priority.key === "high") : events;
  const highCount = events.filter((e) => e.priority.key === "high").length;

  return (
    <>
      <PageHeader
        title="Inbox"
        description={`Requests, responses and activity updates for you in ${unit?.name || "this unit"}.`}
        actions={
          <Link to="/requests" className="btn btn-ghost">
            Requests & assignments
          </Link>
        }
      />

      {assignedError ? (
        <Alert tone="warning">
          Notices could not be loaded ({assignedError}). The collaboration endpoints are not available yet.
        </Alert>
      ) : null}

      <div className="toolbar">
        <label className="check" style={{ margin: 0 }}>
          <input type="checkbox" checked={onlyHigh} onChange={(e) => setOnlyHigh(e.target.checked)} />
          Needs attention only{highCount ? ` (${highCount})` : ""}
        </label>
      </div>

      <div className="card card-pad">
        {assignedStatus === "loading" && !events.length ? (
          <LoadingState label="Loading your inbox…" />
        ) : !rows.length ? (
          <EmptyState
            icon={<BellOff size={28} strokeWidth={1.5} />}
            title="Nothing here"
            body="You're all caught up. New requests, responses and activity updates land here."
          />
        ) : (
          <div className="activity-feed">
            {rows.map((entry) => (
              <button
                type="button"
                key={entry.id}
                className="attn-row"
                onClick={() => setOpen(entry.request)}
                title={formatDate(entry.at, { withTime: true, timeZone: unit?.timezone })}
              >
                <div className="attn-row-top">
                  <span className="attn-title">
                    <Bell size={14} /> {entry.title}
                  </span>
                  <Badge tone={entry.priority.tone}>{entry.priority.label}</Badge>
                </div>
                <div className="attn-meta">{entry.detail}</div>
                <div className="attn-meta">
                  {entry.reference}
                  {entry.project ? ` · ${entry.project}` : ""} · {timeAgo(entry.at)}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {open ? <RequestDetail request={open} timeZone={unit?.timezone} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
