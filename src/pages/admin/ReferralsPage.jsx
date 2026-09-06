
// Referrers: external introducers and the opportunities they own.

import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Users } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import Alert from "@/components/Alert";
import { oppTitle } from "@/helpers/opportunity";
import { commissionTiersFor } from "@/features/leads/leadSourceOptions";
import { formatCurrency, formatPercent } from "@/utils/formatCurrency";
import { useAppDispatch, useAppSelector } from "@/store";
import { fetchReferrers } from "@/slices/referralsSlice";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { useOpportunities } from "@/hooks/useOpportunities";

function commissionFor(opp, tiers) {
  const tier = tiers.find((t) => t.key === opp.involvementTier) || tiers[0];
  const basis = Number(opp.acceptedValue) || 0;
  return { tier, basis, amount: Math.round(basis * Number(tier?.rate || 0) * 100) / 100 };
}

export default function ReferralsPage() {
  const dispatch = useAppDispatch();
  const { unit } = useBusinessUnit();
  const { items: referrers, status, error } = useAppSelector((s) => s.referrals);
  const { items: opportunities, ready } = useOpportunities({});
  const tiers = commissionTiersFor(unit);

  useEffect(() => {
    dispatch(fetchReferrers({ status: "all" }));
  }, [dispatch]);

  const introduced = opportunities.filter((o) => o.referrerId);

  return (
    <>
      <PageHeader
        title="Referrers"
        description="External introducers and the leads they own. Commission is calculated on accepted contract value by involvement tier."
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <Card title="Referrer network" icon={<Users size={16} />}>
        {status === "loading" && referrers.length === 0 ? (
          <LoadingState label="Loading referrers…" />
        ) : referrers.length === 0 ? (
          <EmptyState
            icon={<Users size={28} strokeWidth={1.5} />}
            title="No referrers yet"
            body="Referrers are registered by an administrator; introduced leads will appear here once one is on file."
          />
        ) : (
          referrers.map((r) => {
            const theirs = introduced.filter((o) => o.referrerId === r.id);
            const total = theirs.reduce((s, o) => s + commissionFor(o, tiers).amount, 0);
            return (
              <div key={r.id} className="list-row">
                <div>
                  <div className="row-title">{r.organisation}</div>
                  <div className="row-meta">{[r.contactName, r.email, r.phone].filter(Boolean).join(" · ") || "No contact details"}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", alignItems: "center" }}>
                    <span>
                      {theirs.length} lead{theirs.length === 1 ? "" : "s"}
                    </span>
                    <Badge tone={r.status === "active" ? "success" : "neutral"}>{r.status}</Badge>
                  </div>
                  <div className="row-meta">{formatCurrency(total)} calculated</div>
                </div>
              </div>
            );
          })
        )}
      </Card>

      <div className="card card-pad" style={{ marginTop: 20 }}>
        <h2>Introduced opportunities</h2>
        <p className="sub">Tier rates: {tiers.map((t) => `${t.label} ${formatPercent(Number(t.rate) * 100, 1)}`).join(" · ")}</p>
        {!ready ? (
          <LoadingState label="Loading opportunities…" />
        ) : introduced.length === 0 ? (
          <EmptyState title="No introduced opportunities yet" body="They'll appear here once a lead is logged with a referrer source." />
        ) : (
          <div className="table-wrap">
            <table className="table stack">
              <thead>
                <tr>
                  <th>Opportunity</th>
                  <th>Referrer</th>
                  <th>Tier</th>
                  <th>Accepted value</th>
                  <th>Commission</th>
                </tr>
              </thead>
              <tbody>
                {introduced.map((o) => {
                  const r = referrers.find((x) => x.id === o.referrerId);
                  const c = commissionFor(o, tiers);
                  return (
                    <tr key={o.id}>
                      <td data-label="Opportunity">
                        <Link to={`/opportunities/${o.id}`}>
                          <span className="row-title">{oppTitle(o)}</span>
                          <div className="row-meta">{o.number}</div>
                        </Link>
                      </td>
                      <td data-label="Referrer">{r?.organisation || "—"}</td>
                      <td data-label="Tier">{c.tier?.label || "—"}</td>
                      <td data-label="Accepted value">{formatCurrency(o.acceptedValue)}</td>
                      <td data-label="Commission">{c.basis ? formatCurrency(c.amount) : "—"}</td>
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
