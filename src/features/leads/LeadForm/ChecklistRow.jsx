// One row of the mandatory checklist: a done/pending tick plus its field(s).
//
// A counted row is mandatory — the lead cannot move on without it — so it
// carries the same asterisk a required Field does. The optional rows below
// them do not.

import { Check, Circle } from "lucide-react";

export default function ChecklistRow({ done, label, required = false, children }) {
  return (
    <div className={`checklist-row ${done ? "is-done" : ""}`.trim()}>
      <div className="cr-label">
        <span className={`status-icon ${done ? "done" : "pending"}`}>
          {done ? <Check size={16} /> : <Circle size={16} />}
        </span>
        <span>
          {label}
          {required ? (
            <span className="req" title="Required">
              *<span className="sr-only"> (required)</span>
            </span>
          ) : null}
        </span>
      </div>
      <div className="cr-body">{children}</div>
    </div>
  );
}
