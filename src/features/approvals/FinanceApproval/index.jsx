// Finance approval, when the customer is financing the job. The chart's rules
// for it: when finance is required the responsible person is told on their
// dashboard to initiate it; when the loan is rejected the salesperson is told
// to relook at the alternatives.

import { Landmark } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import { ITEM_STATUSES } from "@/lib/mockData/approvals";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { formatCurrency } from "@/utils/formatCurrency";

export default function FinanceApproval({ job }) {
  const finance = job?.finance;

  if (!finance) {
    return <Alert tone="info">No finance on this job — the customer is paying outright, so there is no finance approval to wait on.</Alert>;
  }

  const status = ITEM_STATUSES[finance.status] ?? ITEM_STATUSES.not_started;
  const rows = [
    ["Product", finance.product],
    ["Lender", finance.provider],
    ["Amount", formatCurrency(finance.amount)],
    ["Term", `${finance.termMonths} months`],
    ["Initiated", `${formatDate(finance.initiatedAt, { withTime: true })} by ${finance.initiatedBy}`],
  ];

  return (
    <>
      {finance.status === "rejected" ? (
        <Alert tone="danger">
          The loan was rejected — {finance.rejectionReason}. The job has gone back to {job.assignedBack?.to ?? job.salesperson}{" "}
          to relook at the alternative options with the customer.
        </Alert>
      ) : finance.status === "approved" ? (
        <Alert tone="success">The loan is approved — finance is no longer holding this job.</Alert>
      ) : (
        <Alert tone="warning">
          The loan is with {finance.provider}. {finance.initiatedBy} initiated it from their dashboard when finance was
          flagged as required.
        </Alert>
      )}

      <div className="list-stack" style={{ marginTop: 16 }}>
        <div className="list-row">
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className="card-icon">
              <Landmark size={15} />
            </span>
            <div className="row-title">Finance application</div>
          </div>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        {rows.map(([label, value]) => (
          <div className="list-row" key={label}>
            <div className="row-meta">{label}</div>
            <div className="row-title" style={{ textAlign: "right" }}>
              {value}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
