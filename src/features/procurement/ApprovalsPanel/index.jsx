// The approvals a price variation calls for, and what happens while they are
// outstanding: frequent high-priority notifications to whoever still has to
// decide, each recorded in the history tab.

import { BellRing, ShieldCheck } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import SectionHead from "@/components/SectionHead";
import { approvalFor, approvalsComplete, quotesReceived, requiredApprovers, roleLabel, tierFor } from "@/helpers/procurement";
import { formatDate } from "@/helpers/dateTimeHelpers";

export default function ApprovalsPanel({ job }) {
  const required = requiredApprovers(job);
  const tier = tierFor(job);
  const notifications = Array.isArray(job?.notifications) ? job.notifications : [];

  if (!quotesReceived(job)) {
    return <Alert tone="info">Approvals open once every line is quoted and the price-variation check has run.</Alert>;
  }
  if (tier?.key === "none") {
    return <Alert tone="success">No approvals needed — the quoted cost matches the proposal.</Alert>;
  }

  const complete = approvalsComplete(job);

  return (
    <>
      {complete ? (
        <Alert tone="success">All required approvals received — the purchase orders can be released.</Alert>
      ) : (
        <Alert tone="danger">
          Not every approval is in. Frequent high-priority notifications go to the people still to decide, and each one is
          recorded in the history tab.
        </Alert>
      )}

      <div style={{ marginTop: 20 }}>
        <SectionHead icon={<ShieldCheck size={13} />} title={`Required — ${tier.label}`} />
        <div className="list-stack">
          {required.map((role) => {
            const approval = approvalFor(job, role);
            const approved = approval?.status === "approved";
            return (
              <div className="list-row" key={role}>
                <div>
                  <div className="row-title">{roleLabel(role)}</div>
                  <div className="row-meta">
                    {approval?.approver ?? "Not yet assigned"}
                    {approval?.requestedAt ? ` · requested ${formatDate(approval.requestedAt)}` : ""}
                    {approved && approval?.decidedAt ? ` · approved ${formatDate(approval.decidedAt)}` : ""}
                  </div>
                </div>
                <Badge tone={approved ? "success" : "warning"}>{approved ? "Approved" : "Pending"}</Badge>
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
                  <div>
                    <div className="row-title">{notice.message}</div>
                    <div className="row-meta">
                      To {notice.to} · {formatDate(notice.at, { withTime: true })}
                    </div>
                  </div>
                  <Badge tone="danger">{notice.priority} priority</Badge>
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
