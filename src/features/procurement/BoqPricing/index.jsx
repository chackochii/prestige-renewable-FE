// Pricing the BOQ from the quotes, on the supplier-quote tab: once the quotes
// are recorded and compared above, each BOQ (materials) and BOS (services)
// line gets the supplier chosen for it, whether it can be had, and the price
// on that supplier's quote. These per-line prices are what the price
// variation, its approvals and the purchase orders are worked from.
//
// Lines we already hold in our inventory are still priced — at their stock
// cost, 0 allowed — so the variation covers the whole job.

import { ClipboardCheck, Save, Tags, Wrench } from "lucide-react";
import Alert from "@/components/Alert";
import SectionHead from "@/components/SectionHead";
import BoqLineTable from "@/features/procurement/components/BoqLineTable";
import { useBoqDrafts } from "@/features/procurement/components/useBoqDrafts";
import { LINE_KINDS } from "@/constants/procurement";
import { boqLines, longestLeadTimeDays, materialLines, quotedLineCount, quotesReceived, serviceLines, unavailableLines } from "@/helpers/procurement";

const SUPPLIERS_LIST = "boq-pricing-suppliers";

export default function BoqPricing({ job, canEdit = false, onSave }) {
  const { edit, valueOf, changed, save, busy, error } = useBoqDrafts(job, onSave);
  const total = boqLines(job).length;
  const priced = quotedLineCount(job);
  const leadTime = longestLeadTimeDays(job);
  const backordered = unavailableLines(job);
  // The suppliers whose quotes are on record, then any already named on a line.
  const suppliers = [...new Set([...(job?.quotes ?? []).map((quote) => quote.supplier), ...boqLines(job).map((line) => line.supplier)].filter(Boolean))];
  const table = { mode: "pricing", canEdit, valueOf, onEdit: edit, suppliersListId: SUPPLIERS_LIST };

  return (
    <div style={{ marginBottom: 20 }}>
      <SectionHead icon={<Tags size={13} />} title="Price the BOQ from the approved quote" />
      {total === 0 ? (
        <p className="lede" style={{ fontSize: 14 }}>
          No BOQ lines yet — add them on the BOQ vs site tab.
        </p>
      ) : quotesReceived(job) ? (
        <Alert tone="success">Every line is priced — the price variation is worked from these figures.</Alert>
      ) : (
        <Alert tone="info">
          {priced} of {total} line{total === 1 ? "" : "s"} priced. Once the quotes are compared, enter the chosen supplier and its price
          on each line; the price variation is calculated when every line is priced.
        </Alert>
      )}

      {backordered.length ? (
        <Alert tone="danger" style={{ marginTop: 10 }}>
          On back-order: {backordered.map((line) => `${line.item}${line.leadTimeDays ? ` (${line.leadTimeDays} days)` : ""}`).join(", ")}. Delivery is
          scheduled around it — see POs & delivery.
        </Alert>
      ) : leadTime ? (
        <p className="row-meta" style={{ marginTop: 10 }}>
          Longest lead time {leadTime} days — the earliest everything can be on site once ordered.
        </p>
      ) : null}

      <datalist id={SUPPLIERS_LIST}>
        {suppliers.map((supplier) => (
          <option key={supplier} value={supplier} />
        ))}
      </datalist>
      <BoqLineTable {...table} icon={<ClipboardCheck size={13} />} title={LINE_KINDS.material.label} lines={materialLines(job)} empty="No materials on this BOQ." />
      <BoqLineTable {...table} icon={<Wrench size={13} />} title={LINE_KINDS.service.label} lines={serviceLines(job)} empty="No services on this BOS." />

      {canEdit && total ? (
        <div style={{ marginTop: 16 }}>
          {error ? (
            <Alert tone="danger" style={{ marginBottom: 10 }}>
              {error}
            </Alert>
          ) : null}
          <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy || !changed.length}>
            <Save size={14} /> {busy ? "Saving…" : changed.length ? `Save ${changed.length} line${changed.length === 1 ? "" : "s"}` : "No changes to save"}
          </button>
        </div>
      ) : null}
    </div>
  );
}
