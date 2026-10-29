// Quotes: every opportunity at or past the proposal stage, with its value —
// 12 to a page with numbered pages below, newest first, searchable, with the
// quote file to download on each row. The figures on the cards are worked out
// by the API across every quote, not just the page on screen; the search and
// the page are kept in the URL.

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { CircleCheck, Download, Receipt, Search } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import Pagination from "@/components/Pagination";
import Alert from "@/components/Alert";
import OppCell from "@/components/OppCell";
import { lifecycleMeta, stageById } from "@/constants/stages";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { PAGE_SIZE } from "@/helpers/pagination";
import { useOpportunities } from "@/hooks/useOpportunities";
import { usePageParam } from "@/hooks/usePageParam";
import { useUrlSearch } from "@/hooks/useUrlParam";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { useNotifications } from "@/hooks/useNotifications";
import { downloadJobQuote } from "@/helpers/quoteDownload";

/** A quote exists from the proposal stage on. */
const PROPOSAL_STAGE = 3;

export default function QuotesPage() {
  const navigate = useNavigate();
  const { unit } = useBusinessUnit();
  const { notify } = useNotifications();
  const { search, setSearch, term } = useUrlSearch();
  const [page, setPage] = usePageParam(term);
  const [downloading, setDownloading] = useState(null);
  const { items: rows, error, ready, loading, total, totals } = useOpportunities(
    { minStage: PROPOSAL_STAGE, totals: 1, ...(term ? { search: term } : {}) },
    { page, pageSize: PAGE_SIZE },
  );

  const download = async (event, opp) => {
    event.stopPropagation();
    setDownloading(opp.id);
    try {
      if (!(await downloadJobQuote(opp.id, unit))) notify("This job has no saved quote to download yet.", "warning");
    } catch {
      notify("The quote could not be downloaded.", "danger");
    } finally {
      setDownloading(null);
    }
  };

  return (
    <>
      <PageHeader title="Quotes" description="Every job with a proposal, newest first. Open a job to see its quote and progress." />
      <div className="stats">
        <StatCard
          icon={<Receipt size={17} />}
          label="Quoted (ex GST)"
          value={formatCurrency(totals?.value ?? 0)}
          hint={`${totals?.count ?? 0} live quote${totals?.count === 1 ? "" : "s"}`}
          style={{ "--i": 0 }}
        />
        <StatCard
          icon={<CircleCheck size={17} />}
          label="Accepted (ex GST)"
          value={formatCurrency(totals?.acceptedValue ?? 0)}
          hint={`${totals?.acceptedCount ?? 0} accepted`}
          style={{ "--i": 1 }}
        />
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="card card-pad">
        <div className="table-toolbar">
          <div className="search-wrap" style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", opacity: 0.6 }} />
            <input className="search" style={{ paddingLeft: 30 }} placeholder="Search job or customer" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        {loading && !rows.length ? (
          <LoadingState label="Loading quotes…" />
        ) : ready && rows.length === 0 ? (
          term ? (
            <EmptyState title="No quotes match" body="Try another search." />
          ) : (
            <EmptyState title="No quotes yet" body="Quotes appear once an opportunity reaches the proposal stage." />
          )
        ) : (
          <div className={`table-wrap${loading ? " is-refreshing" : ""}`}>
            <table className="table clickable stack">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Stage</th>
                  <th>Value (ex GST)</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th>Quote</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((o) => {
                  const life = lifecycleMeta(o.lifecycle);
                  return (
                    <tr key={o.id} onClick={() => navigate(`/opportunities/${o.id}`)}>
                      <td data-label="Job">
                        <OppCell opp={o} />
                      </td>
                      <td data-label="Stage">{stageById(o.stage).label}</td>
                      <td data-label="Value (ex GST)">{formatCurrency(Number(o.acceptedValue) || o.estimatedValue)}</td>
                      <td data-label="Status">
                        <Badge tone={life.tone}>{life.label}</Badge>
                      </td>
                      <td data-label="Updated">{formatDate(o.updatedAt)}</td>
                      <td data-label="Quote">
                        <button type="button" className="btn btn-ghost btn-sm" onClick={(event) => download(event, o)} disabled={downloading === o.id} title="Download the quote PDF">
                          <Download size={14} /> {downloading === o.id ? "Preparing…" : "PDF"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} total={total} onPageChange={setPage} noun="quotes" loading={loading} />
      </div>
    </>
  );
}
