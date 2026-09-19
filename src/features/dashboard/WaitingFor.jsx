// Dashboard card: the jobs you own that another team is holding, grouped by
// who has them. Derived from the opportunity list — see helpers/waitingFor.js.

import { useState } from "react";
import { Link } from "react-router-dom";
import { ChevronDown, ChevronRight, Clock, Hourglass, PackageSearch, ShoppingCart, SquareCheckBig, Users } from "lucide-react";
import Badge from "@/components/Badge";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import Modal from "@/components/Modal";
import RequestDetail from "@/features/collaboration/RequestDetail";
import { formatDate } from "@/helpers/dateTimeHelpers";

const TEAM_ICONS = {
  sales: Users,
  operations: PackageSearch,
  approvals: SquareCheckBig,
  procurement: ShoppingCart,
};

export default function WaitingFor({ groups = [], timeZone, total = 0 }) {
  const [collapsed, setCollapsed] = useState([]);
  // Opening a row shows what is known about the handoff here, rather than
  // sending someone into the module to piece it together.
  const [detail, setDetail] = useState(null);

  const toggle = (key) => setCollapsed((c) => (c.includes(key) ? c.filter((k) => k !== key) : [...c, key]));

  return (
    <Card
      title="Waiting For"
      icon={<Hourglass size={16} />}
      sub={total ? `${total} handoff${total === 1 ? "" : "s"} with another team.` : undefined}
      actions={
        <Link to="/requests" className="enquiry-link">
          View all →
        </Link>
      }
      style={{ marginTop: 20 }}
    >
      {!groups.length ? (
        <EmptyState
          icon={<Hourglass size={26} strokeWidth={1.5} />}
          title="Nothing with another team"
          body="Every job you own is waiting on you, not on sales, operations or procurement."
        />
      ) : (
        groups.map((group) => {
          const Icon = TEAM_ICONS[group.key] || Users;
          const open = !collapsed.includes(group.key);
          return (
            <div className="waiting-group" key={group.key}>
              <button type="button" className="waiting-group-head" onClick={() => toggle(group.key)} aria-expanded={open}>
                <span className="waiting-group-name">
                  <span className="waiting-group-icon">
                    <Icon size={14} />
                  </span>
                  {group.label} <span className="row-meta">({group.items.length})</span>
                </span>
                {open ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </button>

              {open
                ? group.items.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className="waiting-row"
                      onClick={() => setDetail(item)}
                    >
                      <span className="waiting-row-number">
                        {item.number}
                        {item.requestId ? <small className="row-meta">{item.requestId}</small> : null}
                      </span>
                      <span className="waiting-row-body">
                        <span className="row-title">{item.title}</span>
                        <span className="row-meta">{item.detail}</span>
                        <span className="row-meta">
                          {item.customer}
                          {item.owner ? ` · with ${item.owner}` : ""} · since{" "}
                          {formatDate(item.since, { timeZone })}
                          {item.dueAt ? ` · due ${formatDate(item.dueAt, { timeZone })}` : ""}
                        </span>
                      </span>
                      <span className="waiting-row-end">
                        <Badge tone={item.priority.tone}>{item.priority.label}</Badge>
                        <span className="waiting-row-action">{item.action?.label || "View details"}</span>
                        <ChevronRight size={16} />
                      </span>
                    </button>
                  ))
                : null}
            </div>
          );
        })
      )}

      {detail?.request ? (
        <RequestDetail request={detail.request} timeZone={timeZone} onClose={() => setDetail(null)} />
      ) : null}

      {detail && !detail.request ? (
        <Modal
          title={`${detail.number} · ${detail.title}`}
          body={`${detail.customer}${detail.owner ? ` — with ${detail.owner}` : ""}`}
          className="wide"
          onClose={() => setDetail(null)}
          actions={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setDetail(null)}>
                Close
              </button>
              <Link to={`/opportunities/${detail.oppId}`} className="btn btn-primary">
                Open the job
              </Link>
            </>
          }
        >
          <div className="list-stack">
            <div className="list-row">
              <span className="row-title">Priority</span>
              <Badge tone={detail.priority.tone}>{detail.priority.label}</Badge>
            </div>
            {(detail.facts || []).map((f) => (
              <div className="list-row" key={f.label}>
                <span className="row-title">{f.label}</span>
                <span className="row-meta" style={{ textAlign: "right", maxWidth: "60%" }}>
                  {f.value}
                </span>
              </div>
            ))}
          </div>

          {detail.timeline?.length ? (
            <div className="section" style={{ marginTop: 20, marginBottom: 0 }}>
              <h3>Contact attempts</h3>
              <div className="list-stack">
                {detail.timeline.map((entry) => (
                  <div className="list-row" key={entry.id}>
                    <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
                      <span className={`status-icon ${entry.tone}`}>
                        <Clock size={14} />
                      </span>
                      <span className="row-title">{entry.title}</span>
                    </span>
                    <span className="row-meta">{entry.detail}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </Modal>
      ) : null}
    </Card>
  );
}
