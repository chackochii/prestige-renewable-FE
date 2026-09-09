// Leads: opportunities still at stage 1 in the current business unit.

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import Alert from "@/components/Alert";
import OppCell from "@/components/OppCell";
import { QUALIFICATIONS, qualificationMeta } from "@/constants/stages";
import { PERMISSIONS } from "@/constants/permissions";
import { leadSourceLabel } from "@/features/leads/leadSourceOptions";
import { formatDate, slaStatus } from "@/helpers/dateTimeHelpers";
import { useAuth } from "@/hooks/useAuth";
import { useOpportunities } from "@/hooks/useOpportunities";
import { useUnitUsers } from "@/hooks/useUnitUsers";

/** Latest contact attempt for the list — method + date, with a count if there's more than one. */
function contactSummary(o) {
  const attempts = Array.isArray(o.contactAttempts) ? o.contactAttempts : [];
  if (!attempts.length) return o.needsClientContact ? "Not yet contacted" : "—";
  const last = attempts[attempts.length - 1];
  const suffix = attempts.length > 1 ? ` (${attempts.length} attempts)` : "";
  return `${last.method} · ${formatDate(last.contactedAt)}${suffix}`;
}

export default function LeadsPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { items, status, error, ready } = useOpportunities({ stage: 1 });
  const { userName } = useUnitUsers();
  const [search, setSearch] = useState("");
  const [qualification, setQualification] = useState("");

  const rows = useMemo(
    () =>
      items
        .filter((o) => (qualification ? o.qualification === qualification : true))
        .filter((o) =>
          `${o.number || ""} ${o.customerLegalName || ""} ${o.customerTradingName || ""} ${o.siteSuburb || ""}`
            .toLowerCase()
            .includes(search.toLowerCase()),
        )
        .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)),
    [items, search, qualification],
  );

  return (
    <>
      <PageHeader
        title="Leads"
        description="Not yet in the pipeline. Complete the lead pack, mark the lead Qualified and assign an estimator to move it on."
        actions={
          hasPermission(PERMISSIONS.LEADS_CREATE) ? (
            <Link className="btn btn-primary" to="/leads/new">
              New lead
            </Link>
          ) : null
        }
      />

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search name or number"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search leads"
        />
        <select
          className="select"
          value={qualification}
          onChange={(e) => setQualification(e.target.value)}
          aria-label="Qualification filter"
        >
          <option value="">All qualification</option>
          {QUALIFICATIONS.map((q) => (
            <option key={q.key} value={q.key}>
              {q.label}
            </option>
          ))}
        </select>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="card card-pad">
        {status === "loading" && !ready ? (
          <LoadingState label="Loading leads…" />
        ) : rows.length === 0 ? (
          <EmptyState
            title="No leads waiting"
            body={
              items.length
                ? "No leads match the current filter."
                : "Every lead has been qualified or moved out. Capture a new one to get started."
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table clickable stack">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Qualification</th>
                  <th>Source</th>
                  <th>Contact</th>
                  <th>Estimator</th>
                  <th>Next action</th>
                  <th>SLA</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const sla = slaStatus(o.slaDueAt);
                  const q = qualificationMeta(o.qualification);
                  return (
                    <tr key={o.id} onClick={() => navigate(`/opportunities/${o.id}`)}>
                      <td data-label="Lead">
                        <OppCell opp={o} />
                      </td>
                      <td data-label="Qualification">
                        <Badge tone={q.tone}>{q.label}</Badge>
                      </td>
                      <td data-label="Source">{leadSourceLabel(o.leadSource)}</td>
                      <td data-label="Contact">{contactSummary(o)}</td>
                      <td data-label="Estimator">{userName(o.estimatorId) || "—"}</td>
                      <td data-label="Next action">{o.nextAction || "—"}</td>
                      <td data-label="SLA">
                        <Badge tone={sla.tone}>{sla.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
