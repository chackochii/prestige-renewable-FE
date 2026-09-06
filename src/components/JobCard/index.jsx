// Kanban card for one opportunity (used on the pipeline board).

import Avatar from "@/components/Avatar";
import Badge from "@/components/Badge";
import { oppSite, oppTitle, oppValue } from "@/helpers/opportunity";
import { daysSince } from "@/helpers/dateTimeHelpers";
import { formatCurrency } from "@/utils/formatCurrency";

function flag(opp) {
  const ageDays = daysSince(opp.createdAt);
  if (ageDays != null && ageDays <= 7) return { label: "New", tone: "info" };
  if (opp.leadSource === "referrer") return { label: "Referral", tone: "neutral" };
  if (opp.variationPending) return { label: "Variation", tone: "warning" };
  return null;
}

export default function JobCard({ opp, owner, draggable, dragging, onDragStart, onDragEnd, onOpen }) {
  const badge = flag(opp);
  const inStage = daysSince(opp.slaStartedAt || opp.createdAt);
  const site = oppSite(opp);

  return (
    <div
      className={`kanban-card ${dragging ? "dragging" : ""}`.trim()}
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === "Enter") onOpen?.();
      }}
      role="button"
      tabIndex={0}
      title={draggable ? "Drag to move to the next stage" : undefined}
    >
      <div className="kanban-card-top">
        <span className="row-title">{oppTitle(opp)}</span>
        {badge ? <Badge tone={badge.tone}>{badge.label}</Badge> : null}
      </div>
      <div className="kanban-card-company">
        {site}
        {opp.number ? `${site ? " · " : ""}${opp.number}` : ""}
      </div>
      <div className="kanban-card-value-row">
        <span className="kanban-card-value">{formatCurrency(oppValue(opp))}</span>
        {opp.qualification ? <span className="kanban-card-pct">{opp.qualification}</span> : null}
      </div>
      <div className="kanban-card-foot">
        <Avatar name={owner?.name || "—"} size={24} />
        <span className="row-meta">{inStage != null ? `${inStage}d in stage` : "—"}</span>
      </div>
    </div>
  );
}
