// Leads: opportunities still at stage 1 in the current business unit, 12 to
// a page with numbered pages below, newest first. The search runs on the API
// across every lead; the page is kept in the URL.

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import CopyLinkButton from "@/components/CopyLinkButton";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import Pagination from "@/components/Pagination";
import Alert from "@/components/Alert";
import OppCell from "@/components/OppCell";
import { PERMISSIONS } from "@/constants/permissions";
import { leadSourceLabel } from "@/features/leads/leadSourceOptions";
import { enquiryLink } from "@/features/leads/enquiryLink";
import { slaStatus } from "@/helpers/dateTimeHelpers";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useOpportunities } from "@/hooks/useOpportunities";
import { usePageParam } from "@/hooks/usePageParam";
import { PAGE_SIZE } from "@/helpers/pagination";

/** How to reach the customer — captured on every lead, so always worth showing. */
const contactSummary = (o) => [o.customerPhone, o.customerEmail].filter(Boolean).join(" · ") || "—";

export default function LeadsPage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { unit } = useBusinessUnit();
  const [search, setSearch] = useState("");
  // Only part of the list is loaded now, so searching in the browser would miss
  // anything further down. The search goes to the API, which applies it across
  // every lead and pages the result.
  const settledSearch = useDebouncedValue(search.trim(), 300);

  const [page, setPage] = usePageParam(settledSearch);

  // The API returns them newest first, a page at a time.
  const { items: rows, error, ready, loading, total } = useOpportunities(
    {
      stage: 1,
      ...(settledSearch ? { search: settledSearch } : {}),
    },
    { page, pageSize: PAGE_SIZE },
  );

  return (
    <>
      <PageHeader
        title="Leads"
        description="Not yet in the pipeline. Complete the lead pack, mark the lead Qualified and assign an estimator to move it on."
        actions={
          hasPermission(PERMISSIONS.LEADS_CREATE) ? (
            <>
              {/* Hand this to a customer, a partner or a campaign: it files
                  straight into this unit with no sign-in. */}
              <CopyLinkButton
                value={enquiryLink(unit?.code)}
                label="Copy enquiry link"
                copiedLabel="Link copied"
                className="btn btn-ghost"
                toast={unit?.name ? `Enquiry link for ${unit.name} copied` : "Enquiry link copied"}
              />
              <Link className="btn btn-primary" to="/leads/new">
                New lead
              </Link>
            </>
          ) : null
        }
      />

      <div className="toolbar">
        <input
          className="search"
          placeholder="Search name, number, email or phone"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search leads"
        />
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="card card-pad">
        {loading && !rows.length ? (
          <LoadingState label="Loading leads…" />
        ) : ready && rows.length === 0 ? (
          <EmptyState
            title={settledSearch ? "No leads match" : "No leads waiting"}
            body={
              settledSearch
                ? "No lead matches that search."
                : "Every lead has been qualified or moved out. Capture a new one to get started."
            }
          />
        ) : (
          <div className={`table-wrap${loading ? " is-refreshing" : ""}`}>
            <table className="table clickable stack">
              <thead>
                <tr>
                  <th>Lead</th>
                  <th>Source</th>
                  <th>Contact</th>
                  <th>Next action</th>
                  <th>SLA</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const sla = slaStatus(o.slaDueAt);
                  return (
                    <tr key={o.id} onClick={() => navigate(`/opportunities/${o.id}`)}>
                      <td data-label="Lead">
                        <OppCell opp={o} />
                      </td>
                      <td data-label="Source">{leadSourceLabel(o.leadSource)}</td>
                      <td data-label="Contact">{contactSummary(o)}</td>
                      <td data-label="Next action">{o.nextAction || "—"}</td>
                      <td data-label="SLA">
                        <Badge tone={sla.tone}>{sla.label}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination page={page} total={total} onPageChange={setPage} noun="leads" loading={loading} />
          </div>
        )}
      </div>
    </>
  );
}
