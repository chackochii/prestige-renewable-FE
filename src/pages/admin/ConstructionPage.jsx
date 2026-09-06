// Construction: jobs in site works, with their installation window and contractors.

import { useNavigate } from "react-router-dom";
import { HardHat } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import Alert from "@/components/Alert";
import OppCell from "@/components/OppCell";
import { formatDate, slaStatus } from "@/helpers/dateTimeHelpers";
import { useOpportunities } from "@/hooks/useOpportunities";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";

export default function ConstructionPage() {
  const navigate = useNavigate();
  const { unit } = useBusinessUnit();
  const { items, status, error, ready } = useOpportunities({ lifecycle: "Active", stage: 7 });
  const substages = Array.isArray(unit?.siteWorkSubstages) ? unit.siteWorkSubstages : [];

  return (
    <>
      <PageHeader
        title="Construction"
        description={`Jobs in site works for ${unit?.name}. ${substages.length ? `This unit runs ${substages.length} sub-stages: ${substages.map((s) => s.label).join(", ")}.` : ""}`}
      />
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="card card-pad">
        {status === "loading" && !ready ? (
          <LoadingState label="Loading site works…" />
        ) : items.length === 0 ? (
          <EmptyState icon={<HardHat size={28} strokeWidth={1.5} />} title="Nothing on site" body="Jobs appear here once they reach the site-works stage." />
        ) : (
          <div className="table-wrap">
            <table className="table clickable stack">
              <thead>
                <tr>
                  <th>Job</th>
                  <th>Install window</th>
                  <th>Electrical</th>
                  <th>Civil</th>
                  <th>SLA</th>
                </tr>
              </thead>
              <tbody>
                {items.map((o) => {
                  const sla = slaStatus(o.slaDueAt);
                  return (
                    <tr key={o.id} onClick={() => navigate(`/opportunities/${o.id}`)}>
                      <td data-label="Job">
                        <OppCell opp={o} />
                      </td>
                      <td data-label="Install window">
                        {o.installWindowStart || o.installWindowEnd
                          ? `${formatDate(o.installWindowStart)} → ${formatDate(o.installWindowEnd)}`
                          : "Not booked"}
                      </td>
                      <td data-label="Electrical">{o.electricalContractor || "—"}</td>
                      <td data-label="Civil">{o.civilContractor || "—"}</td>
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
