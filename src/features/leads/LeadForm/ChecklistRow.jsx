// One row of the mandatory checklist: a done/pending tick plus its field(s).

import { Check, Circle } from "lucide-react";

export default function ChecklistRow({ done, label, children }) {
  return (
    <div className={`checklist-row ${done ? "is-done" : ""}`.trim()}>
      <div className="cr-label">
        <span className={`status-icon ${done ? "done" : "pending"}`}>
          {done ? <Check size={16} /> : <Circle size={16} />}
        </span>
        <span>{label}</span>
      </div>
      <div className="cr-body">{children}</div>
    </div>
  );
}
