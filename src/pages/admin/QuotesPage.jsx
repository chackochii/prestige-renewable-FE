// Quotes: every opportunity at or past the proposal stage, with its value.

import { useNavigate } from "react-router-dom";
import { CircleCheck, Receipt } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import Alert from "@/components/Alert";
import OppCell from "@/components/OppCell";
import { lifecycleMeta, stageById } from "@/constants/stages";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { useOpportunities } from "@/hooks/useOpportunities";

export default function QuotesPage() {
  const navigate = useNavigate();
  const { items, status, error, ready } = useOpportunities({});
  const rows = items
    .filter((o) => Number(o.stage) >= 3)
    .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const quoted = rows.reduce((s, o) => s + (Number(o.acceptedValue) || Number(o.estimatedValue) || 0), 0);
  const accepted = rows.filter((o) => Number(o.stage) >= 4 || ["Won", "Closed"].includes(o.lifecycle));
  const acceptedValue = accepted.reduce((s, o) => s + (Number(o.acceptedValue) || 0), 0);

  return (
    <>
      <PageHeader title="Quotes" description="Every opportunity that has reached proposal, one row per job. Open a record to see its stage work." />
      <div className="stats">
        <StatCard icon={<Receipt size={17} />} label="Quoted (ex GST)" value={formatCurrency(quoted)} hint={`${rows.length} live quotes`} style={{ "--i": 0 }} />
        <StatCard icon={<CircleCheck size={17} />} label="Accepted" value={formatCurrency(acceptedValue)} hint={`${accepted.length} accepted`} style={{ "--i": 1 }} />
      </div>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="card card-pad">
        {status === "loading" && !ready ? (
          <LoadingState label="Loading quotes…" />
        ) : rows.length === 0 ? (
          <EmptyState title="No quotes yet" body="Quotes appear once an opportunity reaches the proposal stage." />
        ) : (
          <div className="table-wrap">
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
      </div>
    </>
  );
}
