// The history tab the process chart keeps pointing at: every step records
// what it did here, newest first.

import { Clock } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import { formatDate } from "@/helpers/dateTimeHelpers";

export default function ProcurementHistory({ job }) {
  const entries = [...(Array.isArray(job?.history) ? job.history : [])].sort((a, b) => new Date(b.at) - new Date(a.at));

  if (entries.length === 0) {
    return <EmptyState icon={<Clock size={26} strokeWidth={1.5} />} title="Nothing recorded yet" />;
  }

  return (
    <div className="list-stack">
      {entries.map((entry, index) => (
        <div className="list-row" key={`${entry.at}-${index}`}>
          <div style={{ minWidth: 0 }}>
            <div className="row-title">{entry.action}</div>
            {entry.detail ? (
              <div className="row-meta" style={{ whiteSpace: "normal" }}>
                {entry.detail}
              </div>
            ) : null}
          </div>
          <div className="row-meta" style={{ textAlign: "right", flexShrink: 0 }}>
            {formatDate(entry.at, { withTime: true })}
            <br />
            {entry.by}
          </div>
        </div>
      ))}
    </div>
  );
}
