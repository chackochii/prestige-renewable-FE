// One job's passage through approvals: the four tracks and the "All approved?"
// gate, the finance application, the notifications raised and the history.
//
// `embedded` drops the card chrome for use inside another card — the
// opportunity page's stage-5 panel already has a heading of its own.

import { useEffect, useState } from "react";
import { BellRing, ClipboardCheck, Clock, Landmark, SquareCheckBig } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Card from "@/components/Card";
import Tabs from "@/components/Tabs";
import ApprovalBoard from "@/features/approvals/ApprovalBoard";
import ApprovalNotifications from "@/features/approvals/ApprovalNotifications";
import FinanceApproval from "@/features/approvals/FinanceApproval";
import ProcurementHistory from "@/features/procurement/ProcurementHistory";
import { applicableItems, approvalStatus, financeRequired, isOverdue } from "@/helpers/approvals";
import { formatDate, slaStatus } from "@/helpers/dateTimeHelpers";
import { formatCurrency } from "@/utils/formatCurrency";

export default function ApprovalWorkflow({ job, embedded = false }) {
  const [tab, setTab] = useState("approvals");

  // A different job opens on its approvals, not wherever the last one was.
  useEffect(() => {
    setTab("approvals");
  }, [job?.id]);

  if (!job) return null;

  const status = approvalStatus(job);
  const tabs = [
    { key: "approvals", label: "Approvals", icon: <ClipboardCheck size={14} />, count: applicableItems(job).length },
    ...(financeRequired(job) ? [{ key: "finance", label: "Finance", icon: <Landmark size={14} /> }] : []),
    { key: "notifications", label: "Notifications", icon: <BellRing size={14} />, count: (job.notifications ?? []).length || undefined },
    { key: "history", label: "History", icon: <Clock size={14} />, count: (job.history ?? []).length },
  ];

  const body = (
    <>
      {isOverdue(job) ? (
        <Alert tone="danger" style={{ marginBottom: 14 }}>
          Past the approvals timeline — due {formatDate(job.slaDueAt, { withTime: true })} ({slaStatus(job.slaDueAt).label}).
        </Alert>
      ) : null}
      <Tabs items={tabs} value={tab} onChange={setTab} />
      <div className="panel">
        {tab === "approvals" ? (
          <ApprovalBoard job={job} />
        ) : tab === "finance" ? (
          <FinanceApproval job={job} />
        ) : tab === "notifications" ? (
          <ApprovalNotifications job={job} />
        ) : (
          <ProcurementHistory job={job} />
        )}
      </div>
    </>
  );

  if (embedded) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
          <span className="row-meta">
            {job.number} · {job.customer} · {formatCurrency(job.acceptedValue)} accepted
          </span>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        {body}
      </div>
    );
  }

  return (
    <Card
      title={`${job.number} · ${job.customer}`}
      icon={<SquareCheckBig size={16} />}
      sub={`${job.site} · ${formatCurrency(job.acceptedValue)} accepted · ${job.salesperson} (sales)`}
      actions={<Badge tone={status.tone}>{status.label}</Badge>}
    >
      {body}
    </Card>
  );
}
