// A job's stage checklists at a glance — one row per checklist with how far
// it has got and where it is. A row opens its checklist.
//
// rows: [{ section, summary }] — summary from helpers/checklist.js checklistSummary.

import { ChevronRight, ClipboardList } from "lucide-react";
import Badge from "@/components/Badge";

export default function ChecklistOverview({ rows = [], onOpen }) {
  return (
    <div className="list-stack cl-summary">
      {rows.map(({ section, summary }) => (
        <button type="button" key={section.key} className="list-row cl-summary-row" onClick={() => onOpen?.(section.key)}>
          <span style={{ display: "flex", gap: 10, alignItems: "center", minWidth: 0 }}>
            <span className="card-icon">
              <ClipboardList size={15} />
            </span>
            <span style={{ minWidth: 0 }}>
              <span className="row-title">
                {section.code} · {section.title}
              </span>
              <span className="row-meta" style={{ display: "block" }}>
                {summary.applies ? `${summary.done} of ${summary.total} items` : "Not needed on this job"}
              </span>
            </span>
          </span>
          <span style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <Badge tone={summary.tone}>{summary.label}</Badge>
            <ChevronRight size={14} />
          </span>
        </button>
      ))}
    </div>
  );
}
