// The notifications this job has raised, each tagged with the rule from the
// chart's "Identified issues & solution" box that raised it.

import { BellRing } from "lucide-react";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import { ruleOf } from "@/helpers/approvals";
import { formatDate } from "@/helpers/dateTimeHelpers";

export default function ApprovalNotifications({ job }) {
  const notices = [...(job?.notifications ?? [])].sort((a, b) => new Date(b.at) - new Date(a.at));

  if (!notices.length)
    return (
      <EmptyState
        icon={<BellRing size={26} strokeWidth={1.5} />}
        title="Nothing sent yet"
        body="Notifications go out when finance is needed, when every approval is in, or when one is not given."
      />
    );

  return (
    <div className="list-stack">
      {notices.map((notice, index) => (
        <div className="list-row" key={`${notice.at}-${index}`}>
          <div style={{ minWidth: 0 }}>
            <div className="row-title">{notice.message}</div>
            <div className="row-meta">
              To {notice.to} · {formatDate(notice.at, { withTime: true })}
            </div>
            {ruleOf(notice.rule) ? <div className="row-meta">Rule: {ruleOf(notice.rule).when}</div> : null}
          </div>
          <Badge tone="danger">{notice.priority} priority</Badge>
        </div>
      ))}
    </div>
  );
}
