// Proposals (stage 3): every job waiting on a customer's answer. Sales emails
// the customer a link to their proposal; the customer accepts (the job moves
// straight on to Approvals — there is no separate closure step), asks for
// changes (sales sends the job back to the estimator for a re-quote, then
// sends the revised version), or declines.
//
// Lists the active stage-3 jobs in the current business unit, the ones back
// with the estimator for a re-quote, plus proposals answered in the last 30
// days, so an acceptance does not vanish the moment the job moves on.

import { useCallback, useEffect, useMemo, useState } from "react";
import { CircleCheck, CircleX, FilePen, Hourglass, MessageSquareText, Search, Send, Undo2 } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Card from "@/components/Card";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import ProposalWorkflow from "@/features/proposals/ProposalWorkflow";
import { PERMISSIONS } from "@/constants/permissions";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { boardBucket, boardStatus } from "@/helpers/proposals";
import { getErrorMessage } from "@/services/api/client";
import { getProposalBoard } from "@/services/api/proposalsApi";
import { formatCurrency } from "@/utils/formatCurrency";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "draft", label: "Not sent" },
  { key: "waiting", label: "With the customer" },
  { key: "changes", label: "Wants changes" },
  { key: "requote", label: "With the estimator" },
  { key: "accepted", label: "Accepted" },
  { key: "declined", label: "Declined" },
];

export default function ProposalsPage() {
  const { unitId } = useBusinessUnit();
  const { hasPermission } = useAuth();
  const canEdit = hasPermission(PERMISSIONS.LEADS_UPDATE);
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selectedId, setSelectedId] = useState(null);
  const term = useDebouncedValue(search.trim(), 300);

  const load = useCallback(async () => {
    if (!unitId) return;
    try {
      setRows((await getProposalBoard({ businessUnitId: unitId, search: term })) ?? []);
      setError("");
    } catch (err) {
      setError(getErrorMessage(err, "Proposals could not be loaded."));
      setRows([]);
    }
  }, [unitId, term]);

  useEffect(() => {
    load();
  }, [load]);

  const counts = useMemo(() => {
    const tally = { draft: 0, waiting: 0, changes: 0, requote: 0, accepted: 0, declined: 0 };
    for (const row of rows ?? []) tally[boardBucket(row)] += 1;
    return tally;
  }, [rows]);

  const visible = useMemo(() => (rows ?? []).filter((row) => filter === "all" || boardBucket(row) === filter), [rows, filter]);
  const selected = visible.find((row) => row.opportunity.id === selectedId) ?? visible[0] ?? null;

  return (
    <>
      <PageHeader
        title="Proposals"
        description="Send the customer their proposal from your own email app or Gmail — the email, link and PDF are prepared for you. From the link they can view the PDF and accept it (the job then moves straight on to Approvals), ask for changes (send the job to the estimator for a re-quote, then send the revised version), or decline."
      />

      <div className="stats">
        <StatCard label="Not sent yet" value={counts.draft} icon={<FilePen size={14} />} hint="Quote ready, proposal not out" />
        <StatCard label="With the customer" value={counts.waiting} icon={<Hourglass size={14} />} hint="Sent, waiting for an answer" />
        <StatCard label="Wants changes" value={counts.changes} icon={<MessageSquareText size={14} />} hint="Send to the estimator for a re-quote" />
        <StatCard label="With the estimator" value={counts.requote} icon={<Undo2 size={14} />} hint="Being re-quoted — comes back here" />
        <StatCard label="Accepted" value={counts.accepted} icon={<CircleCheck size={14} />} hint="Last 30 days — moved to Approvals" />
        <StatCard label="Declined" value={counts.declined} icon={<CircleX size={14} />} hint="Last 30 days" />
      </div>

      <Card
        title="Jobs at the proposal stage"
        icon={<Send size={16} />}
        sub="Pick a job to send its proposal or see the customer's answer."
        actions={
          <div className="search-wrap" style={{ position: "relative" }}>
            <Search size={14} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", opacity: 0.6 }} />
            <input className="search" style={{ paddingLeft: 30 }} placeholder="Search job, customer, suburb" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        }
      >
        <div className="chip-row" role="tablist" aria-label="Filter proposals" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 12 }}>
          {FILTERS.map((option) => (
            <button
              key={option.key}
              type="button"
              role="tab"
              aria-selected={filter === option.key}
              className={`btn btn-sm ${filter === option.key ? "btn-primary" : "btn-ghost"}`}
              onClick={() => setFilter(option.key)}
            >
              {option.label}
              {option.key !== "all" ? ` · ${counts[option.key]}` : ""}
            </button>
          ))}
        </div>

        {error ? <Alert tone="danger">{error}</Alert> : null}
        {rows === null ? (
          <LoadingState label="Loading proposals…" />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={<Send size={26} strokeWidth={1.5} />}
            title={rows.length ? "Nothing in this filter" : "No jobs at the proposal stage"}
            body={rows.length ? "Pick another filter above." : "Jobs arrive here when estimation hands over a priced quote."}
          />
        ) : (
          <div className="table-wrap">
            <table className="table clickable">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Quote</th>
                  <th>Proposal</th>
                  <th>Sent</th>
                  <th>Sales rep</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((row) => {
                  const { opportunity, latestQuoteVersion: quote, proposal } = row;
                  const status = boardStatus(row);
                  const isSelected = opportunity.id === selected?.opportunity.id;
                  return (
                    <tr key={opportunity.id} className={isSelected ? "selected" : undefined} aria-selected={isSelected} onClick={() => setSelectedId(opportunity.id)}>
                      <td>
                        <div className="row-title">{opportunity.number}</div>
                        <div className="row-meta">
                          {opportunity.customer}
                          {opportunity.siteSuburb ? ` · ${opportunity.siteSuburb}` : ""}
                        </div>
                      </td>
                      <td>
                        {quote ? (
                          <>
                            <div className="row-title">{quote.grandTotal !== null ? formatCurrency(quote.grandTotal, { withCents: true }) : "—"}</div>
                            <div className="row-meta">
                              {quote.quoteNumber} v{quote.version}
                            </div>
                          </>
                        ) : (
                          <Badge tone="warning">No saved quote</Badge>
                        )}
                      </td>
                      <td>
                        <Badge tone={status.tone}>{status.label}</Badge>
                        {proposal ? <div className="row-meta">{proposal.number}</div> : null}
                      </td>
                      <td>
                        {proposal?.sentAt ? (
                          <>
                            <div>{formatDate(proposal.sentAt)}</div>
                            <div className="row-meta">{proposal.viewedAt ? `Opened ${formatDate(proposal.viewedAt)}` : "Not opened"}</div>
                          </>
                        ) : (
                          <span className="row-meta">—</span>
                        )}
                      </td>
                      <td>{opportunity.salesperson?.name ?? <span className="row-meta">Unassigned</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {selected ? (
        <div style={{ marginTop: 20 }}>
          <ProposalWorkflow key={selected.opportunity.id} opportunity={selected.opportunity} canEdit={canEdit} onChanged={load} />
        </div>
      ) : null}
    </>
  );
}
