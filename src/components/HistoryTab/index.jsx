// Record timeline built from the opportunity's own timestamps and owners.

import { Clock } from "lucide-react";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { stageById } from "@/constants/stages";

export default function HistoryTab({ opp, timeZone }) {
  if (!opp) return null;
  const events = [
    opp.closedAt && { at: opp.closedAt, action: "Closed", detail: `Lifecycle ${opp.lifecycle}` },
    opp.slaStartedAt && {
      at: opp.slaStartedAt,
      action: `Entered ${stageById(opp.stage).label}`,
      detail: opp.slaDueAt ? `SLA due ${formatDate(opp.slaDueAt, { timeZone })}` : "No SLA set",
    },
    opp.updatedAt && { at: opp.updatedAt, action: "Last updated", detail: "" },
    opp.createdAt && {
      at: opp.createdAt,
      action: "Created",
      detail: opp.leadOwner?.name ? `Lead owner ${opp.leadOwner.name}` : "",
    },
  ]
    .filter(Boolean)
    .sort((a, b) => new Date(b.at) - new Date(a.at));

  return (
    <div className="card card-pad">
      {events.map((e, i) => (
        <div key={`${e.action}-${i}`} className="list-row">
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span className="status-icon pending">
              <Clock size={16} />
            </span>
            <div>
              <div className="row-title">{e.action}</div>
              {e.detail ? <div className="row-meta">{e.detail}</div> : null}
            </div>
          </div>
          <div className="row-meta">{formatDate(e.at, { withTime: true, timeZone })}</div>
        </div>
      ))}
    </div>
  );
}
