// The four approval tracks from the chart, side by side — DA, DNSP, finance
// (if applicable) and additional (if any) — each with who it is with, its
// reference and where it stands. Then the "All approved?" gate they feed.

import { Building2, Landmark, Plug, Plus } from "lucide-react";
import ApprovalGate from "@/components/ApprovalGate";
import Badge from "@/components/Badge";
import { APPROVALS_STAGE } from "@/lib/mockData/approvals";
import { applicableItems, approvalItems, approvalOutcome, itemStatus } from "@/helpers/approvals";
import { formatDate } from "@/helpers/dateTimeHelpers";

const ICONS = { da: Building2, dnsp: Plug, finance: Landmark, additional: Plus };

export default function ApprovalBoard({ job }) {
  const outcome = approvalOutcome(job);

  return (
    <>
      <div className="approval-tracks">
        {approvalItems(job).map((item) => {
          const Icon = ICONS[item.key] ?? Plus;
          const status = itemStatus(item);
          return (
            <div key={item.key} className={`approval-track ${item.applicable ? item.status : "not_applicable"}`}>
              <div className="approval-track-head">
                <span className="card-icon">
                  <Icon size={15} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className="row-title">{item.label}</div>
                  {item.optional ? <div className="row-meta">{item.key === "finance" ? "If applicable" : "If any"}</div> : null}
                </div>
              </div>
              <Badge tone={status.tone}>{status.label}</Badge>
              {item.applicable ? (
                <div className="approval-track-body">
                  <div className="row-meta">
                    {item.authority}
                    {item.reference ? ` · ${item.reference}` : ""}
                  </div>
                  <div className="row-meta">
                    {item.submittedAt ? `Lodged ${formatDate(item.submittedAt)} by ${item.owner}` : "Not lodged yet"}
                    {item.decidedAt ? ` · decided ${formatDate(item.decidedAt)}` : ""}
                  </div>
                  {item.note ? <div className="approval-track-note">{item.note}</div> : null}
                </div>
              ) : (
                <div className="row-meta approval-track-body">Not needed on this job.</div>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 20 }}>
        <ApprovalGate
          items={applicableItems(job)}
          outcome={outcome}
          yes={{
            title: APPROVALS_STAGE.next.label,
            detail: job?.handoff
              ? `Handed over ${formatDate(job.handoff.at, { withTime: true })} — ${job.handoff.to.join(" and ")} notified`
              : "Whoever creates the Green Deal job and runs procurement is notified",
          }}
          no={{
            title: `Assigned back to ${job?.assignedBack?.to ?? job?.salesperson ?? "the salesperson"}`,
            detail: job?.assignedBack
              ? `${job.assignedBack.reason} · sales manager and owner notified`
              : "The sales manager and owner are notified, and it is recorded in the history",
          }}
        />
      </div>
    </>
  );
}
