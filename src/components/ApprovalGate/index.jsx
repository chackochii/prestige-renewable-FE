// Generic "All approved?" gate: the decision diamond from the process chart,
// with its two exits. Given the outcome of a set of approvals, it says which
// way the job went and what that means — onward on yes, back on no, and what
// is still outstanding while it waits.
//
// items: [{ key, label, status }] — status approved | rejected | anything else
// outcome: "approved" | "rejected" | "pending"
// question: the diamond text — the same gate asks "Client accepted the
//   proposal?" at stage 3. waiting: what to say while pending, if not a count.

import { ArrowRight, CornerUpLeft, Hourglass } from "lucide-react";
import Badge from "@/components/Badge";

export default function ApprovalGate({ items = [], outcome, yes, no, question = "All approved?", waiting = null }) {
  const decided = items.filter((item) => item.status === "approved").length;

  return (
    <div className="approval-gate">
      <div className={`approval-gate-diamond ${outcome}`} aria-label={`${question} ${outcome}`}>
        <span>{question}</span>
      </div>
      <div className="approval-gate-exits">
        <div className={`approval-gate-exit ${outcome === "approved" ? "taken" : ""}`}>
          <Badge tone={outcome === "approved" ? "success" : "neutral"}>Yes</Badge>
          <ArrowRight size={14} />
          <div>
            <div className="row-title">{yes?.title}</div>
            {yes?.detail ? <div className="row-meta">{yes.detail}</div> : null}
          </div>
        </div>
        <div className={`approval-gate-exit ${outcome === "rejected" ? "taken rejected" : ""}`}>
          <Badge tone={outcome === "rejected" ? "danger" : "neutral"}>No</Badge>
          <CornerUpLeft size={14} />
          <div>
            <div className="row-title">{no?.title}</div>
            {no?.detail ? <div className="row-meta">{no.detail}</div> : null}
          </div>
        </div>
        {outcome === "pending" && waiting ? (
          <div className="approval-gate-exit waiting">
            <span className="row-meta">{waiting}</span>
          </div>
        ) : outcome === "pending" ? (
          <div className="approval-gate-exit waiting">
            <Hourglass size={14} />
            <span className="row-meta">
              {decided} of {items.length} approved — waiting on{" "}
              {items
                .filter((item) => item.status !== "approved")
                .map((item) => item.short || item.label)
                .join(", ")}
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}
