// Quotes: every opportunity at or past the proposal stage, with its value —
// 12 to a page with numbered pages below, newest first. The figures on the
// cards are worked out by the API across every quote, not just the page on
// screen; the page is kept in the URL.

import { useNavigate } from "react-router-dom";
import { CircleCheck, Receipt } from "lucide-react";
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

/** A quote exists from the proposal stage on. */
const PROPOSAL_STAGE = 3;

export default function QuotesPage() {
  const navigate = useNavigate();
  const [page, setPage] = usePageParam();
  const { items: rows, error, ready, loading, total, totals } = useOpportunities(
    { minStage: PROPOSAL_STAGE, totals: 1 },
    { page, pageSize: PAGE_SIZE },
  );

  return (
    <>
      <PageHeader title="Quotes" description="Every opportunity that has reached proposal, one row per job, newest first. Open a record to see its stage work." />
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
          label="Accepted"
          value={formatCurrency(totals?.acceptedValue ?? 0)}
          hint={`${totals?.acceptedCount ?? 0} accepted`}
          style={{ "--i": 1 }}
        />
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="card card-pad">
        {loading && !rows.length ? (
          <LoadingState label="Loading quotes…" />
        ) : ready && rows.length === 0 ? (
          <EmptyState title="No quotes yet" body="Quotes appear once an opportunity reaches the proposal stage." />
        ) : (
          <div className={`table-wrap${loading ? " is-refreshing" : ""}`}>
            <table className="table clickable stack">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Stage</th>
                  <th>Value</th>
                  <th>Status</th>
                  <th>Updated</th>
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
                      <td data-label="Value">{formatCurrency(Number(o.acceptedValue) || o.estimatedValue)}</td>
                      <td data-label="Status">
                        <Badge tone={life.tone}>{life.label}</Badge>
                      </td>
                      <td data-label="Updated">{formatDate(o.updatedAt)}</td>
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
