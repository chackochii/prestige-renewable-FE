// The approvals a price variation calls for, and what happens while they are
// outstanding: high-priority notifications to whoever still has to decide,
// each recorded in the history tab. The sales manager and the business owner
// answer here — `onDecide(role, { outcome, note })` — when they hold the role.

import { useState } from "react";
import { BellRing, Check, ShieldCheck, ThumbsDown } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Field from "@/components/Field";
import SectionHead from "@/components/SectionHead";
import { hasRole, isSuperAdmin } from "@/constants/roles";
import { approvalFor, approvalsComplete, quotesReceived, requiredApprovers, roleLabel, tierFor } from "@/helpers/procurement";
import { formatDate } from "@/helpers/dateTimeHelpers";

const errText = (err, fallback) => (typeof err === "string" ? err : err?.message || fallback);

export default function ApprovalsPanel({ job, user = null, onDecide }) {
  const required = requiredApprovers(job);
  const tier = tierFor(job);
  const notifications = Array.isArray(job?.notifications) ? job.notifications : [];
  const [declining, setDeclining] = useState(null); // the role a decline is being written for
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  if (!quotesReceived(job)) {
    return <Alert tone="info">Approvals open once every line is quoted and the price-variation check has run.</Alert>;
  }
  if (tier?.key === "none") {
    return <Alert tone="success">No approvals needed — the quoted cost matches the proposal.</Alert>;
  }

  const complete = approvalsComplete(job);
  const mayDecide = (role) => Boolean(onDecide) && (isSuperAdmin(user) || hasRole(user, role));
  const decide = async (role, outcome) => {
    setBusy(true);
    setError("");
    try {
      await onDecide(role, { outcome, note: outcome === "rejected" ? note.trim() : undefined });
      setDeclining(null);
      setNote("");
    } catch (err) {
      setError(errText(err, "The decision could not be recorded."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {complete ? (
        <Alert tone="success">All required approvals received — the purchase orders can be released.</Alert>
      ) : (
        <Alert tone="danger">
          Not every approval is in. High-priority notifications go to the people still to decide — once when the quotes come in and
          daily after that — and each one is recorded in the history tab.
        </Alert>
      )}
      {error ? (
        <Alert tone="danger" style={{ marginTop: 10 }}>
          {error}
        </Alert>
      ) : null}

      <div style={{ marginTop: 20 }}>
        <SectionHead icon={<ShieldCheck size={13} />} title={`Required — ${tier.label}`} />
        <div className="list-stack">
          {required.map((role) => {
            const approval = approvalFor(job, role);
            const approved = approval?.status === "approved";
            const rejected = approval?.status === "rejected";
            return (
              <div key={role}>
                <div className="list-row">
                  <div style={{ minWidth: 0 }}>
                    <div className="row-title">{roleLabel(role)}</div>
                    <div className="row-meta" style={{ whiteSpace: "normal" }}>
                      {approval?.approver ?? "Not yet assigned"}
                      {approval?.requestedAt ? ` · requested ${formatDate(approval.requestedAt)}` : ""}
                      {(approved || rejected) && approval?.decidedAt ? ` · ${approved ? "approved" : "declined"} ${formatDate(approval.decidedAt)}` : ""}
                      {approval?.note ? ` · ${approval.note}` : ""}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    {!approved && mayDecide(role) ? (
                      <>
                        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => decide(role, "approved")}>
                          <Check size={14} /> Approve
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setDeclining(declining === role ? null : role)}>
                          <ThumbsDown size={14} /> Decline
                        </button>
                      </>
                    ) : null}
                    <Badge tone={approved ? "success" : rejected ? "danger" : "warning"}>{approved ? "Approved" : rejected ? "Declined" : "Pending"}</Badge>
                  </div>
                </div>
                {declining === role ? (
                  <div className="decision-card" style={{ marginTop: 8 }}>
                    <Field label="Why the variation is not approved" required hint="the coordinator and the salesperson see this">
                      <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
                    </Field>
                    <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                      <button type="button" className="btn btn-danger btn-sm" disabled={busy || !note.trim()} onClick={() => decide(role, "rejected")}>
                        Decline the variation
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" disabled={busy} onClick={() => setDeclining(null)}>
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      {!complete ? (
        <div style={{ marginTop: 24 }}>
          <SectionHead icon={<BellRing size={13} />} title="Notifications sent" />
          {notifications.length === 0 ? (
            <p className="lede" style={{ fontSize: 14 }}>
              None yet.
            </p>
          ) : (
            <div className="list-stack">
              {notifications.map((notice, index) => (
                <div className="list-row" key={`${notice.at}-${index}`}>
                  <div style={{ minWidth: 0 }}>
                    <div className="row-title" style={{ whiteSpace: "normal" }}>
                      {notice.message}
                    </div>
                    <div className="row-meta">
                      To {notice.to} · {formatDate(notice.at, { withTime: true })}
                    </div>
                  </div>
                  <Badge tone={notice.priority === "high" ? "danger" : "neutral"}>{notice.priority} priority</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
