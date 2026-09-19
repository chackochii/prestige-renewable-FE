// Requests & assignments: what other teams have asked of you, and what you
// are waiting on from them.
//
// "Assigned to me" is the My Assigned Requests list — the only place a
// salesperson or coordinator needs to go. Opening one shows the request and
// its response form, never the requesting department's module.

import { useEffect, useMemo, useState } from "react";
import { HandHelping, Inbox, Send } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import Tabs from "@/components/Tabs";
import RequestDetail from "@/features/collaboration/RequestDetail";
import RequestStatusBadge from "@/features/collaboration/RequestStatusBadge";
import {
  DEPARTMENTS,
  contextualAction,
  departmentLabel,
  priorityMeta,
  REQUEST_KINDS,
  requestCode,
  statusMeta,
} from "@/constants/collaboration";
import { formatDate, isOverdue } from "@/helpers/dateTimeHelpers";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { useAuth } from "@/hooks/useAuth";
import { useAppDispatch, useAppSelector } from "@/store";
import { fetchAssignedRequests, fetchRaisedRequests } from "@/slices/collaborationSlice";

const TABS = [
  { key: "assigned", label: "Assigned to me", icon: <Inbox size={14} /> },
  { key: "raised", label: "Raised by me", icon: <Send size={14} /> },
];

export default function RequestsPage() {
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const { unit, unitId } = useBusinessUnit();
  const { assigned, assignedStatus, assignedError, raised, raisedStatus, raisedError } = useAppSelector(
    (s) => s.collaboration,
  );
  const [tab, setTab] = useState("assigned");
  const [department, setDepartment] = useState("");
  const [showClosed, setShowClosed] = useState(false);
  const [open, setOpen] = useState(null);

  useEffect(() => {
    if (!unitId) return;
    dispatch(fetchAssignedRequests({ businessUnitId: unitId }));
    dispatch(fetchRaisedRequests({ businessUnitId: unitId }));
  }, [unitId, dispatch]);

  const source = tab === "assigned" ? assigned : raised;
  const status = tab === "assigned" ? assignedStatus : raisedStatus;
  const error = tab === "assigned" ? assignedError : raisedError;

  const rows = useMemo(
    () =>
      source
        .filter((r) => (department ? r.department === department : true))
        .filter((r) => (showClosed ? true : statusMeta(r.kind, r.status).open))
        .sort((a, b) => {
          const overdue = Number(isOverdue(b.dueAt)) - Number(isOverdue(a.dueAt));
          if (overdue) return overdue;
          return priorityMeta(a.priority).order - priorityMeta(b.priority).order;
        }),
    [source, department, showClosed],
  );

  const openCount = assigned.filter((r) => statusMeta(r.kind, r.status).open).length;
  const overdueCount = assigned.filter((r) => statusMeta(r.kind, r.status).open && isOverdue(r.dueAt)).length;
  const waitingCount = raised.filter((r) => statusMeta(r.kind, r.status).open).length;

  return (
    <>
      <PageHeader
        title="Requests & assignments"
        description={`Work other teams have asked of you in ${unit?.name}, and what you are waiting on from them.`}
      />

      <div className="stats">
        <StatCard label="Assigned to me" value={openCount} icon={<Inbox size={14} />} hint="Still open" />
        <StatCard label="Overdue" value={overdueCount} icon={<HandHelping size={14} />} hint="Past the due date" />
        <StatCard label="Waiting on others" value={waitingCount} icon={<Send size={14} />} hint="Raised by you" />
      </div>

      <Tabs
        items={TABS.map((t) => ({
          ...t,
          count: t.key === "assigned" ? openCount : waitingCount,
        }))}
        value={tab}
        onChange={setTab}
      />

      <div className="toolbar">
        <select
          className="select"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          aria-label="Department filter"
        >
          <option value="">All departments</option>
          {DEPARTMENTS.map((d) => (
            <option key={d.key} value={d.key}>
              {d.label}
            </option>
          ))}
        </select>
        <label className="check" style={{ margin: 0 }}>
          <input type="checkbox" checked={showClosed} onChange={(e) => setShowClosed(e.target.checked)} />
          Include closed
        </label>
      </div>

      {error ? (
        <Alert tone="warning">
          Requests could not be loaded ({error}). The collaboration endpoints are not available yet.
        </Alert>
      ) : null}

      <div className="card card-pad">
        {status === "loading" && !source.length ? (
          <LoadingState label="Loading requests…" />
        ) : !rows.length ? (
          <EmptyState
            icon={<Inbox size={26} strokeWidth={1.5} />}
            title={tab === "assigned" ? "Nothing assigned to you" : "You are not waiting on anyone"}
            body={
              tab === "assigned"
                ? "When another team needs information or an activity from you, it lands here."
                : "Raise a request from a job's stage when you need something from another team."
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table stack">
              <thead>
                <tr>
                  <th>Request</th>
                  <th>Project</th>
                  <th>{tab === "assigned" ? "Raised by" : "Assigned to"}</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((request) => {
                  const action = contextualAction(request, user);
                  return (
                    <tr key={request.id}>
                      <td data-label="Request">
                        <div className="row-title">{request.title}</div>
                        <div className="row-meta">
                          {requestCode(request)} · {REQUEST_KINDS[request.kind]?.label || request.kind} ·{" "}
                          {departmentLabel(request.department)}
                        </div>
                        {request.latestUpdate?.note ? (
                          <div className="row-meta">Latest: {request.latestUpdate.note}</div>
                        ) : null}
                      </td>
                      <td data-label="Project">
                        <div className="row-title">{request.opportunityNumber || "—"}</div>
                        <div className="row-meta">{request.opportunityName}</div>
                      </td>
                      <td data-label={tab === "assigned" ? "Raised by" : "Assigned to"}>
                        {(tab === "assigned" ? request.createdByName : request.assigneeName) ||
                          departmentLabel(request.department)}
                      </td>
                      <td data-label="Due">
                        {request.dueAt ? formatDate(request.dueAt, { timeZone: unit?.timezone }) : "—"}
                      </td>
                      <td data-label="Status">
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "flex-end" }}>
                          <RequestStatusBadge request={request} />
                          <Badge tone={priorityMeta(request.priority).tone}>
                            {priorityMeta(request.priority).label}
                          </Badge>
                        </div>
                      </td>
                      <td data-label="Action">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(request)}>
                          {action?.label || "View"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {open ? <RequestDetail request={open} timeZone={unit?.timezone} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
