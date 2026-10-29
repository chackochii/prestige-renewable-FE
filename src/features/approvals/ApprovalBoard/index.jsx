// The approvals this job needs, one card each, stacked - each with who it is
// with, its reference and where it stands. Clicking a card opens it: DNSP, DA
// and finance open their checklist tab; any other approval opens its form
// right in the card.
//
// `onOpenChecklist(sectionKey)` opens a checklist tab; `onUpdateItem(type,
// body)` saves a plain approval (approvals.update). Once the job is sent on,
// `onAddAddendum(type, { note, files })` adds a document or note to any
// approval without changing its status. A rejected approval shows its reason
// and date, and `onResolveRejection(key)` opens what can be done about it.

import { useState } from "react";
import { Building2, ChevronDown, ChevronRight, ClipboardList, Landmark, Plug, Plus } from "lucide-react";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import ApprovalAddenda from "@/features/approvals/ApprovalAddenda";
import ApprovalItemForm from "@/features/approvals/ApprovalItemForm";
import { approvalGroup, approvalItems, approvalTimers, expiryOf, hasChecklist, itemActivityAt, itemStatus, rejectionReasonOf, timeFlags } from "@/helpers/approvals";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { formatDate, timeAgo } from "@/helpers/dateTimeHelpers";
import { financeNeedsReview } from "@/helpers/approvalChecklist";

const ICONS = { da: Building2, dnsp: Plug, finance: Landmark };

/** "Lodged: 24 Oct 2026 · Renta", then "Approved: 24 Oct 2026" once decided. */
function statusLines(item) {
  const lines = [];
  if (item.submittedAt) lines.push(`Lodged: ${formatDate(item.submittedAt)}${item.owner ? ` · ${item.owner}` : ""}`);
  if (item.decidedAt && (item.status === "approved" || item.status === "rejected"))
    lines.push(`${item.status === "approved" ? "Approved" : itemStatus(item).label}: ${formatDate(item.decidedAt)}`);
  if (item.status === "rejected" && rejectionReasonOf(item)) lines.push(`Reason: ${rejectionReasonOf(item)}`);
  if (expiryOf(item) && item.status === "approved") lines.push(`Valid until: ${formatDate(expiryOf(item))}`);
  const answers = item.checklist ?? {};
  // Submission 2, 3… once it has been resubmitted (NF-08); what it replaces or was replaced by (NF-09).
  const submission = Number(answers.submissionNumber) || (Array.isArray(answers.previousSubmissions) ? answers.previousSubmissions.length + 1 : 1);
  if (submission > 1) lines.push(`Submission ${submission}`);
  if (answers.replaces) lines.push(`Replaces: ${answers.replaces.label ?? answers.replaces}`);
  // The quote it was lodged against (NF-12).
  if (answers.lodgedQuote?.version) lines.push(`Lodged against quote ${answers.lodgedQuote.quoteNumber ? `${answers.lodgedQuote.quoteNumber} ` : ""}v${answers.lodgedQuote.version}`);
  if (item.status !== "not_started" && itemActivityAt(item)) lines.push(`Last activity: ${timeAgo(itemActivityAt(item))}`);
  // Resubmitted before: the last time it was turned down.
  const previous = Array.isArray(item.checklist?.previousSubmissions) ? item.checklist.previousSubmissions : [];
  if (previous.length) {
    const last = previous[previous.length - 1];
    lines.push(`Resubmitted${previous.length > 1 ? ` ${previous.length} times` : ""} - previously ${String(last.status || "rejected").replace(/_/g, " ")}${last.decidedAt ? ` ${formatDate(last.decidedAt)}` : ""}${last.reason ? `: ${last.reason}` : ""}`);
  }
  return lines;
}

// `lapseOnly` - the job has been sent on: a recorded approval opens only to record it revoked or expired.
export default function ApprovalBoard({ job, canEdit = false, lapseOnly = false, onOpenChecklist, onUpdateItem, onAddAddendum = null, onResolveRejection = null, upload = null }) {
  const [editing, setEditing] = useState(null); // the key of the plain approval open in its card
  // Lodged too long, coming up to its expiry (the unit's limits).
  const { unit } = useBusinessUnit();
  const timers = approvalTimers(unit);
  const items = approvalItems(job);

  return (
    <>
      {items.length ? (
        <div className="approval-tracks">
          {items.map((item) => {
            const Icon = ICONS[item.key] ?? Plus;
            const status = itemStatus(item);
            const checklist = hasChecklist(item);
            const open = editing === item.key;
            const recordable = canEdit || lapseOnly;
            const clickable = checklist || recordable;
            const activate = () => {
              if (checklist) onOpenChecklist?.(item.key);
              else if (recordable) setEditing(open ? null : item.key);
            };
            return (
              <div key={item.key} className={`approval-track ${item.status}${clickable ? " is-clickable" : ""}`}>
                <div
                  className="approval-track-main"
                  role={clickable ? "button" : undefined}
                  tabIndex={clickable ? 0 : undefined}
                  aria-expanded={!checklist && recordable ? open : undefined}
                  onClick={clickable ? activate : undefined}
                  onKeyDown={
                    clickable
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            activate();
                          }
                        }
                      : undefined
                  }
                >
                  <div className="approval-track-head">
                    <span className="card-icon">
                      <Icon size={15} />
                    </span>
                    <div style={{ minWidth: 0 }}>
                      <div className="row-title">{item.label}</div>
                      {item.authority || item.reference ? (
                        <div className="row-meta">
                          {item.authority}
                          {item.reference ? `${item.authority ? " · " : ""}${item.reference}` : ""}
                        </div>
                      ) : null}
                      {statusLines(item).map((line) => (
                        <div key={line} className="row-meta">
                          {line}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="approval-track-side">
                    {timeFlags(item, timers).map((flag) => (
                      <Badge key={flag.key} tone={flag.tone} title={flag.title}>
                        {flag.label}
                      </Badge>
                    ))}
                    {item.key === "finance" && financeNeedsReview(item.checklist, job) ? <Badge tone="warning">Needs Review</Badge> : null}
                    <Badge tone={status.tone}>{status.label}</Badge>
                    {clickable ? checklist || !open ? <ChevronRight size={16} /> : <ChevronDown size={16} /> : null}
                  </div>
                </div>
                {item.note && !open && item.status !== "rejected" ? <div className="approval-track-note">{item.note}</div> : null}
                {/* Rejected while the job is at approvals: what to do about it. */}
                {approvalGroup(item) === "failed" && canEdit && onResolveRejection && !open ? (
                  <div>
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => onResolveRejection(item.key)}>
                      Resolve Rejection
                    </button>
                  </div>
                ) : null}
                {open ? (
                  <ApprovalItemForm
                    item={item}
                    job={job}
                    upload={upload}
                    lapseOnly={lapseOnly}
                    onSave={async (body) => {
                      await onUpdateItem?.(item.key, body);
                      setEditing(null);
                    }}
                    onCancel={() => setEditing(null)}
                  />
                ) : null}
                {!open ? <ApprovalAddenda item={item} canAdd={Boolean(onAddAddendum)} onAdd={(body) => onAddAddendum(item.key, body)} upload={upload} /> : null}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={<ClipboardList size={26} strokeWidth={1.5} />}
          title="No approvals marked as required"
          body="Sales or estimation tick the approvals a job needs before it gets here. Add any this job does need under Other Approvals above, or send it to procurement if there are none."
        />
      )}
    </>
  );
}
