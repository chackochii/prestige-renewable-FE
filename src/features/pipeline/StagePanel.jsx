// Stage work for stages 2–9. Shows what the business unit has configured for
// the stage and the record's own fields where the API stores them; the
// per-stage workflows (estimates, proposals, approvals, purchase orders, site
// sub-stages, billing) light up here once their services are connected.

import {
  Calculator,
  CircleDollarSign,
  FilePenLine,
  FileText,
  Handshake,
  HardHat,
  PackageSearch,
  SquareCheckBig,
} from "lucide-react";
import Badge from "@/components/Badge";
import Alert from "@/components/Alert";
import StageRequestsPanel from "@/features/collaboration/StageRequestsPanel";
import { stageById } from "@/constants/stages";
import { formatCurrency, formatPercent } from "@/utils/formatCurrency";
import { formatDate } from "@/helpers/dateTimeHelpers";

const ICONS = {
  2: Calculator,
  3: FileText,
  4: Handshake,
  5: SquareCheckBig,
  6: PackageSearch,
  7: HardHat,
  8: CircleDollarSign,
  9: FilePenLine,
};

function Row({ label, value }) {
  return (
    <div className="list-row">
      <div className="row-title">{label}</div>
      <div className="row-meta" style={{ textAlign: "right" }}>
        {value ?? "—"}
      </div>
    </div>
  );
}

function StageFacts({ stageId, opp, unit }) {
  switch (stageId) {
    case 2:
      return (
        <>
          <Row label="Opportunity value (ex GST)" value={formatCurrency(opp.estimatedValue)} />
          <Row label="Margin floor snapshot" value={formatPercent(opp.marginFloor, 0)} />
          <Row label="Estimator" value={opp.estimator?.name} />
        </>
      );
    case 3:
    case 4:
      return (
        <>
          <Row label="Accepted value (ex GST)" value={formatCurrency(opp.acceptedValue)} />
          <Row label="Salesperson" value={opp.salesperson?.name} />
          <Row label="Customer feedback" value={opp.feedback} />
        </>
      );
    case 5: {
      const types = Array.isArray(unit?.approvalTypes) ? unit.approvalTypes : [];
      return types.length ? (
        <>
          <p className="lede" style={{ marginBottom: 8 }}>
            Approvals this unit gathers:
          </p>
          {types.map((t) => (
            <Row key={t.key} label={t.label} value={<Badge tone="neutral">{t.key}</Badge>} />
          ))}
        </>
      ) : (
        <p className="lede">This unit has no external approvals section.</p>
      );
    }
    case 6:
      return <Row label="Delivery owner" value={opp.deliveryOwner?.name} />;
    case 7: {
      const subs = Array.isArray(unit?.siteWorkSubstages) ? unit.siteWorkSubstages : [];
      return (
        <>
          <Row
            label="Installation window"
            value={
              opp.installWindowStart || opp.installWindowEnd
                ? `${formatDate(opp.installWindowStart)} → ${formatDate(opp.installWindowEnd)}`
                : null
            }
          />
          <Row label="Electrical contractor" value={opp.electricalContractor} />
          <Row label="Civil contractor" value={opp.civilContractor} />
          {subs.map((s) => (
            <Row key={s.key} label={s.label} value={<Badge tone="neutral">{s.key}</Badge>} />
          ))}
        </>
      );
    }
    case 8: {
      const split = Array.isArray(unit?.billingSplit) ? unit.billingSplit : [];
      const basis = Number(opp.acceptedValue) || 0;
      return split.length ? (
        split.map((m) => (
          <Row
            key={m.key}
            label={`${m.label || m.key} · ${m.percent}%`}
            value={basis ? formatCurrency((basis * Number(m.percent)) / 100) : "—"}
          />
        ))
      ) : (
        <p className="lede">No billing split configured for this unit.</p>
      );
    }
    case 9:
      return (
        <>
          <Row label="Warranty contact" value={opp.closureWarrantyContact} />
          <Row label="Future engagement" value={opp.closureFutureEngagement} />
          <Row label="Closed" value={opp.closedAt ? formatDate(opp.closedAt) : null} />
        </>
      );
    default:
      return null;
  }
}

export default function StagePanel({ stageId, opp, unit, canEdit = false }) {
  const stage = stageById(stageId);
  const Icon = ICONS[stage.id] || FileText;
  const slaDays = unit?.slaDays?.[stage.id];

  return (
    <div className="card card-pad">
      <div className="card-head">
        <span className="card-icon">
          <Icon size={16} />
        </span>
        <h2>{stage.label}</h2>
      </div>
      <p className="sub">{stage.description}</p>
      {slaDays !== undefined ? (
        <p className="lede" style={{ marginBottom: 12 }}>
          SLA for this stage in {unit?.name}: {slaDays} day{Number(slaDays) === 1 ? "" : "s"}.
        </p>
      ) : null}
      <StageFacts stageId={stage.id} opp={opp} unit={unit} />
      <Alert tone="info" style={{ marginTop: 16 }}>
        The {stage.label.toLowerCase()} workflow records for this stage are not available from the API yet. Stage
        progression, SLA tracking and the details above are live.
      </Alert>

      <StageRequestsPanel opp={opp} stage={stage.id} unit={unit} canEdit={canEdit} />
    </div>
  );
}
