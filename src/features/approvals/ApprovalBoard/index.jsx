// The approvals this job needs, side by side — each with who it is with, its
// reference and where it stands — then the "All approved?" gate they feed.
// DNSP, DA and finance open their checklist; any other approval is recorded
// right here.
//
// `onOpenChecklist(sectionKey)` opens a checklist tab; `onUpdateItem(type,
// body)` saves a plain approval (approvals.update).

import { useState } from "react";
import { Building2, ClipboardList, Landmark, Pencil, Plug, Plus } from "lucide-react";
import ApprovalGate from "@/components/ApprovalGate";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import ApprovalItemForm from "@/features/approvals/ApprovalItemForm";
import { APPROVALS_STAGE } from "@/constants/approvals";
import { applicableItems, approvalItems, approvalOutcome, hasChecklist, itemStatus } from "@/helpers/approvals";
import { formatDate } from "@/helpers/dateTimeHelpers";

const ICONS = { da: Building2, dnsp: Plug, finance: Landmark };

export default function ApprovalBoard({ job, canEdit = false, onOpenChecklist, onUpdateItem }) {
  const [editing, setEditing] = useState(null); // the key of the plain approval being recorded
  const outcome = approvalOutcome(job);
  const items = approvalItems(job);
  const movedOn = Number(job?.stage) > APPROVALS_STAGE.id;

  return (
    <>
      {items.length ? (
        <div className="approval-tracks">
          {items.map((item) => {
            const Icon = ICONS[item.key] ?? Plus;
            const status = itemStatus(item);
            const checklist = hasChecklist(item);
            return (
              <div key={item.key} className={`approval-track ${item.status}`}>
                <div className="approval-track-head">
                  <span className="card-icon">
                    <Icon size={15} />
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div className="row-title">{item.label}</div>
                    <div className="row-meta">{checklist ? "Worked through its checklist" : "Recorded here"}</div>
                  </div>
                </div>
                <Badge tone={status.tone}>{status.label}</Badge>
                <div className="approval-track-body">
                  {item.authority || item.reference ? (
                    <div className="row-meta">
                      {item.authority}
                      {item.reference ? `${item.authority ? " · " : ""}${item.reference}` : ""}
                    </div>
                  ) : null}
                  <div className="row-meta">
                    {item.submittedAt ? `Lodged ${formatDate(item.submittedAt)}${item.owner ? ` by ${item.owner}` : ""}` : "Not lodged yet"}
                    {item.decidedAt ? ` · decided ${formatDate(item.decidedAt)}` : ""}
                  </div>
                  {item.note ? <div className="approval-track-note">{item.note}</div> : null}
                  {checklist ? (
                    <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", marginTop: 4 }} onClick={() => onOpenChecklist?.(item.key)}>
                      <ClipboardList size={14} /> Open the checklist
                    </button>
                  ) : canEdit && !movedOn ? (
                    editing === item.key ? (
                      <ApprovalItemForm
                        item={item}
                        onSave={async (body) => {
                          await onUpdateItem?.(item.key, body);
                          setEditing(null);
                        }}
                        onCancel={() => setEditing(null)}
                      />
                    ) : (
                      <button type="button" className="btn btn-ghost btn-sm" style={{ alignSelf: "flex-start", marginTop: 4 }} onClick={() => setEditing(item.key)}>
                        <Pencil size={14} /> {item.status === "not_started" ? "Record it" : "Update"}
                      </button>
                    )
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<ClipboardList size={26} strokeWidth={1.5} />}
          title="No approvals marked as required"
          body="Sales or estimation tick the approvals a job needs before it gets here. Add any this job does need below, or move it on to procurement if there are none."
        />
      )}

      <div style={{ marginTop: 20 }}>
        <ApprovalGate
          items={applicableItems(job)}
          outcome={movedOn ? "approved" : outcome}
          yes={{
            title: APPROVALS_STAGE.next.label,
            detail: movedOn ? "Every approval was received — the job has moved on, and procurement was told" : "The job moves on by itself when the last approval is in; procurement is told",
          }}
          no={{
            title: `Back with ${job?.salesperson?.name ?? "the salesperson"}`,
            detail: "An approval not given tells the salesperson, the sales manager and the owner, and goes in the history",
          }}
          waiting={items.length ? undefined : "Nothing to wait on — no approvals were marked as required."}
        />
      </div>
    </>
  );
}
