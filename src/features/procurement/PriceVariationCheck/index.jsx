// Price variation check: the quoted cost against the accepted proposal. No
// variation means purchase orders can go out straight away; a variation
// decides who has to approve it — the sales manager under the threshold, the
// owner as well above it. Measured from round 1 whatever the BOQ has been
// revised to since, so a revision cannot hide a price change.

import { Percent } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import SectionHead from "@/components/SectionHead";
import StatCard from "@/components/StatCard";
import { APPROVAL_TIERS } from "@/constants/procurement";
import {
  boqLines,
  currentRound,
  originalLines,
  priceVariationPct,
  proposalTotal,
  quotedLineCount,
  quotedTotal,
  quotesReceived,
  roleLabel,
  tierFor,
} from "@/helpers/procurement";
import { formatCurrency, formatNumber, formatPercent } from "@/utils/formatCurrency";

export default function PriceVariationCheck({ job }) {
  const lines = boqLines(job);
  const pct = priceVariationPct(job);
  const tier = tierFor(job);
  const round = currentRound(job);

  if (!quotesReceived(job)) {
    return (
      <>
        <Alert tone="info">
          Waiting on supplier quotes — {quotedLineCount(job)} of {lines.length} lines priced. The variation check runs once
          every line has a quote against it.
        </Alert>
        <LineTable job={job} />
      </>
    );
  }

  return (
    <>
      <div className="stats" style={{ marginBottom: 20 }}>
        <StatCard
          label="Accepted proposal"
          value={formatCurrency(proposalTotal(job))}
          hint={round > 1 ? `Round 1 BOQ — the variation is measured from here` : "From the accepted proposal's BOQ"}
        />
        <StatCard label="Quoted cost" value={formatCurrency(quotedTotal(job))} hint={`Suppliers' prices at site quantities (round ${round})`} />
        <StatCard
          label="Variation"
          value={`${pct > 0 ? "+" : ""}${formatPercent(pct, 1)}`}
          hint={tier.label}
          icon={<Percent size={14} />}
        />
      </div>

      <Alert tone={tier.tone}>
        {tier.rule}
        {tier.key === "none" ? " See POs & delivery." : ""}
      </Alert>

      {/* The two thresholds from the process chart, with the one that applies marked. */}
      <div style={{ marginTop: 16 }}>
        <SectionHead icon={<Percent size={13} />} title="Approval thresholds" />
        <div className="list-stack">
          {["below", "above"].map((key) => {
            const option = APPROVAL_TIERS[key];
            const applies = tier.key === key;
            return (
              <div className="list-row" key={key}>
                <div>
                  <div className="row-title">
                    {option.label} — {option.approvers.map(roleLabel).join(" + ")}
                  </div>
                  <div className="row-meta">{option.rule}</div>
                </div>
                {applies ? <Badge tone={option.tone}>Applies</Badge> : <span className="row-meta">Does not apply</span>}
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ marginTop: 24 }}>
        <LineTable job={job} />
      </div>
    </>
  );
}

/** Accepted proposal cost against quoted cost, line by line — where the variation comes from. */
function LineTable({ job }) {
  const accepted = new Map(originalLines(job).map((line) => [line.key, line]));
  return (
    <div className="table-wrap" style={{ marginTop: 16 }}>
      <table className="table">
        <thead>
          <tr>
            <th>Item</th>
            <th>Qty</th>
            <th>Proposal</th>
            <th>Quoted</th>
            <th>Difference</th>
          </tr>
        </thead>
        <tbody>
          {boqLines(job).map((line) => {
            const original = accepted.get(line.key) ?? line;
            const proposal = Number(original.proposalQty) * Number(original.proposalUnitCost);
            const hasQuote = line.quotedUnitCost !== null && line.quotedUnitCost !== undefined;
            const quotedCost = hasQuote ? Number(line.siteQty) * Number(line.quotedUnitCost) : null;
            const diff = hasQuote ? quotedCost - proposal : null;
            return (
              <tr key={line.key}>
                <td>
                  <div className="row-title">{line.item}</div>
                  <div className="row-meta">{line.supplier}</div>
                </td>
                <td>
                  {formatNumber(line.siteQty)} {line.unit}
                  {Number(original.proposalQty) !== Number(line.siteQty) ? (
                    <div className="row-meta">{formatNumber(original.proposalQty)} proposed</div>
                  ) : null}
                </td>
                <td>{formatCurrency(proposal)}</td>
                <td>{hasQuote ? formatCurrency(quotedCost) : <span className="row-meta">awaiting quote</span>}</td>
                <td>
                  {diff === null ? (
                    "—"
                  ) : Math.abs(diff) < 0.005 ? (
                    <Badge tone="success">No change</Badge>
                  ) : (
                    <Badge tone={diff > 0 ? "warning" : "info"}>
                      {diff > 0 ? "+" : "−"}
                      {formatCurrency(Math.abs(diff))}
                    </Badge>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
