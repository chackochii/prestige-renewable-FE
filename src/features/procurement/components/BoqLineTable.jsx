// One table of BOQ lines — materials (BOQ) or services (BOS) — in one of two
// modes:
//   "site"    — the BOQ vs site tab: what the proposal said, what the site
//               needs, whether we already hold it, and whether they match.
//   "pricing" — the supplier-quote tab: who supplies it, whether it can be
//               had, the estimator's cost from the estimation BOQ, and the
//               price on the chosen supplier's quote.
// `valueOf(line, field)` / `onEdit(key, field, value)` come from useBoqDrafts.

import Badge from "@/components/Badge";
import SectionHead from "@/components/SectionHead";
import { X } from "lucide-react";
import { AVAILABILITY } from "@/constants/procurement";
import { availabilityOf } from "@/helpers/procurement";
import { formatCurrency, formatNumber } from "@/utils/formatCurrency";

const qty = (value) => Number(value) || 0;
const hasValue = (value) => value !== null && value !== undefined && value !== "";

export default function BoqLineTable({
  mode = "site",
  icon,
  title,
  lines,
  empty,
  canEdit = false,
  valueOf,
  onEdit,
  onRemove,
  removable = () => false,
  busy = false,
  suppliersListId,
}) {
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
              {mode === "pricing" ? (
                <tr>
                  <th>Item</th>
                  <th>Site qty</th>
                  <th>Supplier</th>
                  <th>Availability</th>
                  <th title="The unit price the estimator put on this line in the estimation-stage BOQ">Cost $ / unit</th>
                  <th title="The unit price on the chosen supplier's quote">Price $ / unit</th>
                  <th>Line total</th>
                </tr>
              ) : (
                <tr>
                  <th>Item</th>
                  <th>Proposal</th>
                  <th>Site</th>
                  <th>In inventory</th>
                  <th>Match</th>
                </tr>
              )}
            </thead>
            <tbody>
              {lines.map((line) =>
                mode === "pricing" ? (
                  <PricingRow key={line.key} line={line} canEdit={canEdit} valueOf={valueOf} onEdit={onEdit} suppliersListId={suppliersListId} />
                ) : (
                  <SiteRow
                    key={line.key}
                    line={line}
                    canEdit={canEdit}
                    valueOf={valueOf}
                    onEdit={onEdit}
                    onRemove={canEdit && removable(line) ? onRemove : null}
                    busy={busy}
                  />
                ),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// `showProposed` — the proposal's unit price under the name; the pricing
// table has it in its own column instead.
function ItemCell({ line, showProposed = true, children }) {
  return (
    <td>
      <div className="row-title">{line.item}</div>
      <div className="row-meta">
        {line.brand ? `${line.brand}${showProposed ? " · " : ""}` : ""}
        {showProposed ? `${formatCurrency(line.proposalUnitCost, { withCents: true })} / ${line.unit} proposed` : ""}
      </div>
      {children}
    </td>
  );
}

function SiteRow({ line, canEdit, valueOf, onEdit, onRemove, busy }) {
  const site = valueOf(line, "siteQty");
  const matches = qty(line.proposalQty) === qty(site);
  const delta = qty(site) - qty(line.proposalQty);
  const inInventory = valueOf(line, "inInventory") === true;
  return (
    <tr>
      <ItemCell line={line}>
        {onRemove ? (
          <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 4 }} onClick={() => onRemove(line.key)} disabled={busy} aria-label={`Remove ${line.item}`}>
            <X size={12} /> Remove
          </button>
        ) : null}
      </ItemCell>
      <td>
        {formatNumber(line.proposalQty)} {line.unit}
      </td>
      <td style={matches ? undefined : { color: "var(--warning)", fontWeight: 700 }}>
        {canEdit ? (
          <input type="number" min={0} value={site} onChange={(e) => onEdit(line.key, "siteQty", e.target.value)} style={{ width: 90 }} aria-label={`Site quantity for ${line.item}`} />
        ) : (
          `${formatNumber(site)} ${line.unit}`
        )}
      </td>
      <td>
        {canEdit ? (
          <label className="check">
            <input type="checkbox" checked={inInventory} onChange={(e) => onEdit(line.key, "inInventory", e.target.checked)} aria-label={`${line.item} is in our inventory`} />
            <span>{inInventory ? "Yes" : "No"}</span>
          </label>
        ) : (
          <Badge tone={inInventory ? "success" : "neutral"}>{inInventory ? "In inventory" : "To order"}</Badge>
        )}
      </td>
      <td>
        <Badge tone={matches ? "success" : "warning"}>{matches ? "Matches" : `${delta > 0 ? "+" : ""}${delta}`}</Badge>
      </td>
    </tr>
  );
}

function PricingRow({ line, canEdit, valueOf, onEdit, suppliersListId }) {
  const availability = availabilityOf({ ...line, availability: valueOf(line, "availability"), leadTimeDays: valueOf(line, "leadTimeDays") });
  const quoted = valueOf(line, "quotedUnitCost");
  const fromStock = line.inInventory === true;
  // Lines from the accepted quote carry the estimator's unit price; ones added on site do not.
  const estimated = qty(line.proposalQty) > 0 || qty(line.proposalUnitCost) > 0;
  return (
    <tr>
      <ItemCell line={line} showProposed={false}>
        {fromStock ? <Badge tone="success">From inventory</Badge> : null}
      </ItemCell>
      <td>
        {formatNumber(line.siteQty)} {line.unit}
      </td>
      <td>
        {canEdit ? (
          <input
            list={suppliersListId}
            value={valueOf(line, "supplier") ?? ""}
            onChange={(e) => onEdit(line.key, "supplier", e.target.value)}
            style={{ width: 150 }}
            placeholder={fromStock ? "Our stock" : "Supplier"}
            aria-label={`Supplier for ${line.item}`}
          />
        ) : (
          line.supplier || <span className="row-meta">—</span>
        )}
      </td>
      <td>
        {canEdit ? (
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <select value={valueOf(line, "availability") || "available"} onChange={(e) => onEdit(line.key, "availability", e.target.value)} aria-label={`Availability of ${line.item}`}>
              {Object.values(AVAILABILITY).map((option) => (
                <option key={option.key} value={option.key}>
                  {line.kind === "service" ? option.service : option.material}
                </option>
              ))}
            </select>
            {valueOf(line, "availability") && valueOf(line, "availability") !== "available" ? (
              <input type="number" min={0} value={valueOf(line, "leadTimeDays") ?? ""} onChange={(e) => onEdit(line.key, "leadTimeDays", e.target.value)} style={{ width: 64 }} placeholder="days" aria-label={`Lead time for ${line.item}`} />
            ) : null}
          </div>
        ) : (
          <>
            <Badge tone={availability.tone}>{availability.label}</Badge>
            {availability.detail ? <div className="row-meta">{availability.detail}</div> : null}
          </>
        )}
      </td>
      <td>
        {estimated ? (
          formatCurrency(line.proposalUnitCost, { withCents: true })
        ) : (
          <span className="row-meta" title="Added in procurement — not on the estimation BOQ">
            —
          </span>
        )}
      </td>
      <td>
        {canEdit ? (
          <input
            type="number"
            min={0}
            step="0.01"
            value={quoted ?? ""}
            onChange={(e) => onEdit(line.key, "quotedUnitCost", e.target.value)}
            style={{ width: 100 }}
            placeholder={fromStock ? "stock cost" : "not quoted"}
            aria-label={`Supplier price per unit for ${line.item}`}
          />
        ) : hasValue(quoted) ? (
          formatCurrency(quoted, { withCents: true })
        ) : (
          <span className="row-meta">awaiting quote</span>
        )}
      </td>
      <td>{hasValue(quoted) ? formatCurrency(qty(quoted) * qty(line.siteQty), { withCents: true }) : <span className="row-meta">—</span>}</td>
    </tr>
  );
}
