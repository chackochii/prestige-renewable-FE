// One procurement checklist on a job — CL-11 BOQ vs site, CL-12 supplier
// quote, CL-13 purchase order release, CL-14 material receipt or CL-10 job
// creation — drawn by the shared ChecklistForm. This file supplies what
// comes from the job record: the rows the auto-filled items show, the
// conditions the rules need, and whether job creation is open yet.
//
// `job` comes from useProcurementJob (it carries `checklist`); `onChange(patch)`
// merges answers into this section and `upload(itemKey, files)` files the
// documents an item attaches on the job. `canEdit` — may complete the
// coordinator's items (procurement.update); `canApprove` — may sign the
// Procurement Manager's (procurement.approve).

import ChecklistForm from "@/components/ChecklistForm";
import { FULFILMENT_OPTIONS } from "@/constants/procurementChecklists";
import { formatDate } from "@/helpers/dateTimeHelpers";
import {
  approvalFor,
  boqLines,
  boqMatches,
  currentRound,
  longestLeadTimeDays,
  materialLines,
  mismatchedLines,
  priceVariationPct,
  proposalTotal,
  quotedTotal,
  quotesReceived,
  requiredApprovers,
  roleLabel,
  tierFor,
  unavailableLines,
} from "@/helpers/procurement";
import { answersOf, jobCreationBlocker, procurementContext, procurementSystem } from "@/helpers/procurementChecklist";
import { formatCurrency } from "@/utils/formatCurrency";

const signedPct = (pct) => `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;

/** What an auto-filled item shows, as [label, value, missingText?] rows from the job record and earlier tables. */
function procurementAutoRows(source, job, checklist) {
  const quote = answersOf(checklist, "quote");
  const quotes = Array.isArray(job.quotes) ? job.quotes : [];
  const quoted = quotesReceived(job);
  const pct = priceVariationPct(job);
  const tier = tierFor(job);
  switch (source) {
    case "poBasis": {
      const differ = mismatchedLines(job).length;
      return [
        ["Approved BOQ", boqLines(job).length ? `Round ${currentRound(job)} · ${boqLines(job).length} lines · ${boqMatches(job) ? "matches the site" : `${differ} line${differ === 1 ? "" : "s"} differ`}` : null],
        ["Supplier quotes", quotes.length ? `${quotes.length} received — ${quotes.map((entry) => entry.supplier).join(", ")}` : null, "None received yet"],
        ["Quote confirmed (CL-12)", quote.finalQuoteFile?.length ? "Saved for records" : null, "Not saved yet — CL-12 item 10"],
      ];
    }
    case "quotedTotal":
      return [["Approved quote total", quoted ? formatCurrency(quotedTotal(job)) : null, "Not every line is quoted yet"]];
    case "variation":
      return [
        ["Accepted proposal", formatCurrency(proposalTotal(job))],
        ["Quoted cost", quoted ? formatCurrency(quotedTotal(job)) : null, "Not every line is quoted yet"],
        ["Variation", pct === null ? null : signedPct(pct), "Calculated once every line is quoted"],
        ["5% rule", tier ? `${tier.label} — ${tier.rule}` : null, "Calculated once every line is quoted"],
      ];
    case "variationApprovals": {
      const required = requiredApprovers(job);
      if (!required.length) return [["Approvals", "None needed — no price variation"]];
      return required.map((role) => {
        const approval = approvalFor(job, role);
        const state = approval ? (approval.status === "approved" ? `approved ${formatDate(approval.decidedAt)}` : `pending since ${formatDate(approval.requestedAt)}`) : null;
        return [roleLabel(role), approval ? `${approval.approver} — ${state}` : null, "Not requested yet"];
      });
    }
    case "suppliers": {
      const bySupplier = new Map();
      for (const line of materialLines(job)) bySupplier.set(line.supplier, [...(bySupplier.get(line.supplier) ?? []), `${line.siteQty} × ${line.item}`]);
      return bySupplier.size ? [...bySupplier].map(([supplier, items]) => [supplier, items.join(", ")]) : [["Suppliers", null]];
    }
    case "stockDelivery": {
      const lead = longestLeadTimeDays(job);
      const backordered = unavailableLines(job);
      const method = FULFILMENT_OPTIONS.find((option) => option.value === quote.fulfilmentMethod)?.label;
      return [
        ["Stock availability", quote.stockConfirmed ? (backordered.length ? `Confirmed — ${backordered.map((line) => line.item).join(", ")} on back-order` : "Confirmed") : null, "Not confirmed yet — CL-12 item 6"],
        ["Longest lead time", lead ? `${lead} days` : "None"],
        ["Delivery or pickup", method && quote.fulfilmentDate ? `${method} · ${formatDate(quote.fulfilmentDate)}${quote.fulfilmentTime ? ` ${quote.fulfilmentTime}` : ""}` : null, "Not confirmed yet — CL-12 item 7"],
        ["Freight", quote.freightCharges !== "" && quote.freightCharges !== undefined && quote.freightCharges !== null ? formatCurrency(quote.freightCharges) : null, "Not confirmed yet — CL-12 item 8"],
      ];
    }
    case "paymentTerms":
      return [
        ["Terms confirmed", quote.termsConfirmed ? "Yes" : null, "Not confirmed yet — CL-12 item 9"],
        ["Payment due", quote.paymentDueDate ? formatDate(quote.paymentDueDate) : null, "Not confirmed yet — CL-12 item 9"],
      ];
    case "greenDeal": {
      const system = procurementSystem(job);
      return [
        ["Customer", job.customer],
        ["Installation address", job.site],
        ["Solar panels", system.panels],
        ["Battery", system.battery ?? "None"],
        ["Inverter", system.inverter],
        ["System capacity", system.capacityKw ? `${system.capacityKw} kW` : null],
      ];
    }
    default:
      return [];
  }
}

export default function ProcurementChecklist({ section, job, canEdit = false, canApprove = false, onChange, upload = null }) {
  const checklist = job.checklist ?? {};
  return (
    <ChecklistForm
      section={section}
      answers={checklist[section.key] ?? {}}
      ctx={procurementContext(job, checklist)}
      canEdit={canEdit}
      canApprove={canApprove}
      locked={section.afterMaterials ? jobCreationBlocker(job, checklist) : null}
      autoRows={(source) => procurementAutoRows(source, job, checklist)}
      onChange={onChange}
      upload={upload}
    />
  );
}
