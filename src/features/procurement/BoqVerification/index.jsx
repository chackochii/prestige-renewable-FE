// BOQ / BOS availability & verification, and the decision it feeds: do the
// proposal's quantities match what the site actually needs? Where they do,
// procurement starts getting quotes. Where they don't, the BOQ is revised to
// the site figures — a new round — and matched again; each revision is kept
// so the path from the accepted proposal to what was ordered stays visible.

import { ClipboardCheck, FileText, History, Wrench } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import SectionHead from "@/components/SectionHead";
import { LINE_KINDS } from "@/lib/mockData/procurement";
import {
  availabilityOf,
  boqMatches,
  currentRound,
  longestLeadTimeDays,
  materialLines,
  mismatchedLines,
  revisionsOf,
  serviceLines,
  unavailableLines,
} from "@/helpers/procurement";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { formatCurrency, formatNumber } from "@/utils/formatCurrency";

const qty = (value) => Number(value) || 0;

export default function BoqVerification({ job }) {
  const differ = mismatchedLines(job);
  const round = currentRound(job);
  const revisions = revisionsOf(job);
  const latest = revisions[revisions.length - 1] ?? null;
  const quotes = Array.isArray(job?.quotes) ? job.quotes : [];
  const leadTime = longestLeadTimeDays(job);
  const backordered = unavailableLines(job);

  return (
    <>
      {boqMatches(job) ? (
        <Alert tone="success">
          Proposal BOQ and the actual site requirement match{round > 1 ? ` (round ${round})` : ""}. Procurement can start
          getting quotes — recorded in the history tab.
        </Alert>
      ) : (
        <Alert tone="warning">
          {differ.length} line{differ.length === 1 ? "" : "s"} differ{differ.length === 1 ? "s" : ""} from the proposal (
          {differ.map((line) => line.item).join(", ")}). The BOQ is revised to the site figures as a new round and matched
          again; the difference goes through the price-variation check.
        </Alert>
      )}

      {backordered.length ? (
        <Alert tone="danger" style={{ marginTop: 10 }}>
          On back-order: {backordered.map((line) => `${line.item} (${line.leadTimeDays} days)`).join(", ")}. Delivery is
          scheduled around it — see POs & delivery.
        </Alert>
      ) : leadTime ? (
        <p className="row-meta" style={{ marginTop: 10 }}>
          Longest lead time {leadTime} days — the earliest everything can be on site once ordered.
        </p>
      ) : null}

      {latest ? (
        <div style={{ marginTop: 20 }}>
          <SectionHead icon={<History size={13} />} title={`Round ${round} of ${round} — revised ${formatDate(latest.at)} by ${latest.by}`} />
          <p className="lede" style={{ fontSize: 14, marginBottom: 10 }}>
            {latest.reason}.
          </p>
          <RevisionDiff before={latest.lines} after={job.boq} round={latest.round} />
        </div>
      ) : null}

      <LineSection
        icon={<ClipboardCheck size={13} />}
        title={LINE_KINDS.material.label}
        lines={materialLines(job)}
        empty="No materials on this BOQ."
      />
      <LineSection
        icon={<Wrench size={13} />}
        title={LINE_KINDS.service.label}
        lines={serviceLines(job)}
        empty="No services on this BOS."
      />

      <div style={{ marginTop: 24 }}>
        <SectionHead icon={<FileText size={13} />} title="Supplier quotes" />
        {quotes.length === 0 ? (
          <p className="lede" style={{ fontSize: 14 }}>
            No quotes yet — they are requested once the BOQ is verified.
          </p>
        ) : (
          <div className="list-stack">
            {quotes.map((quote) => (
              <div className="list-row" key={`${quote.supplier}-${quote.receivedAt}`}>
                <div>
                  <div className="row-title">{quote.supplier}</div>
                  <div className="row-meta">
                    Received {formatDate(quote.receivedAt)} · valid until {formatDate(quote.validUntil)}
                  </div>
                </div>
                <div className="row-title">{formatCurrency(quote.total)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/** One table per kind: what the proposal said, what the site needs, and whether it can be had. */
function LineSection({ icon, title, lines, empty }) {
  return (
    <div style={{ marginTop: 20 }}>
      <SectionHead icon={icon} title={title} />
      {lines.length === 0 ? (
        <p className="lede" style={{ fontSize: 14 }}>
          {empty}
        </p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Proposal</th>
                <th>Site</th>
                <th>Supplier</th>
                <th>Availability</th>
                <th>Match</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const matches = qty(line.proposalQty) === qty(line.siteQty);
                const delta = qty(line.siteQty) - qty(line.proposalQty);
                const availability = availabilityOf(line);
                return (
                  <tr key={line.key}>
                    <td>
                      <div className="row-title">{line.item}</div>
                      <div className="row-meta">
                        {line.brand} · {formatCurrency(line.proposalUnitCost, { withCents: true })} / {line.unit} proposed
                      </div>
                    </td>
                    <td>
                      {formatNumber(line.proposalQty)} {line.unit}
                    </td>
                    <td style={matches ? undefined : { color: "var(--warning)", fontWeight: 700 }}>
                      {formatNumber(line.siteQty)} {line.unit}
                    </td>
                    <td>{line.supplier}</td>
                    <td>
                      <Badge tone={availability.tone}>{availability.label}</Badge>
                      {availability.detail ? <div className="row-meta">{availability.detail}</div> : null}
                    </td>
                    <td>
                      <Badge tone={matches ? "success" : "warning"}>{matches ? "Matches" : `${delta > 0 ? "+" : ""}${delta}`}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/** What the revision changed, line by line — only lines whose proposal quantity moved. */
function RevisionDiff({ before = [], after = [], round }) {
  const previous = new Map(before.map((line) => [line.key, line]));
  const changed = after.filter((line) => {
    const was = previous.get(line.key);
    return was && qty(was.proposalQty) !== qty(line.proposalQty);
  });
  if (changed.length === 0) return <p className="row-meta">No quantities changed in this revision.</p>;
  return (
    <div className="list-stack">
      {changed.map((line) => {
        const was = previous.get(line.key);
        return (
          <div className="list-row" key={line.key}>
            <div>
              <div className="row-title">{line.item}</div>
              <div className="row-meta">
                Round {round}: {formatNumber(was.proposalQty)} {line.unit} proposed, {formatNumber(was.siteQty)} {line.unit} needed on site
              </div>
            </div>
            <Badge tone="info">
              {formatNumber(was.proposalQty)} → {formatNumber(line.proposalQty)} {line.unit}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
