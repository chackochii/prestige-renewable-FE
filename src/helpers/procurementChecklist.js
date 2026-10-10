// What the procurement checklists (constants/procurementChecklists.js) need
// beyond the shared rules in helpers/checklist.js: the conditions their items
// depend on, what the job record says for the auto-filled items, when job
// creation (CL-10) opens, and how the checklists feed the job record.
//
// A job's checklist is { boq, quote, po, receipt, jobCreation } — one set of
// answers per section.

import { PROCUREMENT_CHECKLIST_OWNER, procurementChecklistOf } from "@/constants/procurementChecklists";
import { itemDone, itemNumber } from "@/helpers/checklist";
import { approvalsComplete, materialLines, priceVariationPct, quotesReceived, variationTier } from "@/helpers/procurement";

export const answersOf = (checklist, sectionKey) => checklist?.[sectionKey] ?? {};

/** Does the quoted cost vary from the proposal? Null until every line is quoted. */
export function variationNeedsApproval(job) {
  if (!quotesReceived(job)) return null;
  return variationTier(priceVariationPct(job)) !== "none";
}

/** Did anything arrive missing, incorrect or damaged? Null until answered. */
export function hasDiscrepancy(checklist) {
  const found = answersOf(checklist, "receipt").discrepancyFound;
  return found === "yes" ? true : found === "no" ? false : null;
}

/**
 * The rules' context for a job's procurement checklists (see helpers/checklist.js).
 * `autoAnswered`: the CL-13 variation approval is done only when every required
 * approver has approved on the Approvals tab — never by a tick on the checklist.
 */
export function procurementContext(job, checklist) {
  return {
    conditions: { variationNeedsApproval: variationNeedsApproval(job), hasDiscrepancy: hasDiscrepancy(checklist) },
    autoAnswered: (field) => (field.source === "variationApprovals" ? approvalsComplete(job) : undefined),
  };
}

/** The approved system as the BOQ has it — what Green Deal is told. */
export function procurementSystem(job) {
  const lines = materialLines(job);
  const find = (pattern) => lines.find((line) => pattern.test(`${line.item} ${line.brand}`));
  const panel = find(/panel/i);
  const inverter = find(/inverter/i);
  const battery = find(/battery/i);
  const watts = panel ? Number((panel.item.match(/(\d+)\s*W\b/) ?? [])[1]) : 0;
  const describe = (line) => (line ? `${line.siteQty > 1 ? `${line.siteQty} × ` : ""}${line.brand} ${line.item}` : null);
  return {
    panels: describe(panel),
    inverter: describe(inverter),
    battery: describe(battery),
    capacityKw: panel && watts ? Math.round((panel.siteQty * watts) / 10) / 100 : null,
  };
}

/**
 * Why job creation cannot start yet, or null when it can: the price-variation
 * approval in PO release and the whole material receipt have to be complete.
 */
export function jobCreationBlocker(job, checklist) {
  const ctx = procurementContext(job, checklist);
  const po = procurementChecklistOf("po");
  const receipt = procurementChecklistOf("receipt");
  const waiting = [];
  const approval = po.items.find((item) => item.key === "variationApproval");
  if (!itemDone(po, approval, answersOf(checklist, "po"), ctx)) waiting.push(`the price-variation approval (PO release, item ${itemNumber(po, approval.key)})`);
  const open = receipt.items.filter((item) => !itemDone(receipt, item, answersOf(checklist, "receipt"), ctx)).length;
  if (open) waiting.push(`material receipt (${open} item${open === 1 ? "" : "s"} to go)`);
  return waiting.length ? `Opens once the price-variation approval and material receipt are complete — still waiting on ${waiting.join(" and ")}.` : null;
}

/** Every item of a section done. */
export const sectionComplete = (section, answers, ctx) => section.items.every((item) => itemDone(section, item, answers, ctx));

/**
 * The job with what the checklists settle, so the step strip and status
 * follow them: the drafted orders are sent once CL-13 releases them, they are
 * delivered once CL-14 has everything arrived, and the Green Deal job comes
 * from CL-10. The variation approvals are not among them — only the approvers
 * decide those, on their approval requests.
 */
export function applyProcurementChecklist(job, checklist) {
  if (!job) return job;
  const ctx = procurementContext(job, checklist);
  const po = answersOf(checklist, "po");
  const receipt = answersOf(checklist, "receipt");
  const jobCreation = answersOf(checklist, "jobCreation");
  const created = sectionComplete(procurementChecklistOf("jobCreation"), jobCreation, ctx);

  const purchaseOrders = (job.purchaseOrders ?? []).map((order) => {
    let next = order;
    if (po.poReleasedConfirmed === true && next.status === "draft") next = { ...next, status: "sent", sentAt: po.poReleasedOn || next.sentAt || null };
    if (receipt.allArrived === true && next.status !== "draft" && next.status !== "delivered")
      next = { ...next, status: "delivered", deliveredAt: next.deliveredAt ?? null, receivedBy: next.receivedBy ?? PROCUREMENT_CHECKLIST_OWNER };
    return next;
  });

  return {
    ...job,
    purchaseOrders,
    greenDeal: created
      ? { created: true, jobId: jobCreation.greenDealJobId, createdAt: jobCreation.greenDealCreatedOn || job.greenDeal?.createdAt || null, by: job.greenDeal?.by ?? PROCUREMENT_CHECKLIST_OWNER }
      : { created: false },
  };
}
