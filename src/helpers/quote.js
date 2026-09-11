// Quote math for the quote builder. Everything here is derived, never
// stored, so editing a quantity, discount, cost or the GST treatment can't
// leave a stale total anywhere.

/** Finds a catalog item (as fetched into state.catalog.items) by its key. */
export function findCatalogItem(items, key) {
  return items.find((i) => i.key === key) || null;
}

/** Item total after its line discount — GST is handled once, at the quote level, not per item. */
export function lineTotal(item) {
  const qty = Number(item?.quantity) || 0;
  const unitPrice = Number(item?.unitPrice) || 0;
  const discountPct = Number(item?.discountPct) || 0;
  return qty * unitPrice * (1 - discountPct / 100);
}

export function itemsSubtotal(items = []) {
  return items.reduce(
    (acc, item) => {
      const qty = Number(item?.quantity) || 0;
      const unitPrice = Number(item?.unitPrice) || 0;
      const discountPct = Number(item?.discountPct) || 0;
      const beforeDiscount = qty * unitPrice;
      const discount = beforeDiscount * (discountPct / 100);
      return {
        beforeDiscount: acc.beforeDiscount + beforeDiscount,
        discount: acc.discount + discount,
        total: acc.total + (beforeDiscount - discount),
      };
    },
    { beforeDiscount: 0, discount: 0, total: 0 },
  );
}

/** "Other" only means something once the estimator has named it — falls back to the raw select value otherwise. */
export function projectTypeLabel(quote) {
  if (quote?.projectType === "Other") return quote.projectTypeOther?.trim() || "Other";
  return quote?.projectType || "";
}

/** A percentage cost is a % of the items subtotal (after item discounts), not of other additional costs. */
export function additionalCostAmount(cost, itemsTotal) {
  const value = Number(cost?.value) || 0;
  if (cost?.calcType === "percentage") return itemsTotal * (value / 100);
  return value;
}

export function additionalCostsTotal(costs = [], itemsTotal) {
  return costs.reduce((sum, cost) => sum + additionalCostAmount(cost, itemsTotal), 0);
}

/**
 * GST breakdown for the whole quote. taxTreatment: "exclusive" adds GST on
 * top of the pre-tax total; "no_gst" applies none; "inclusive" treats the
 * items + costs total itself as the GST-inclusive, customer-facing amount
 * and backs the GST component out of it rather than adding it on top.
 */
export function quoteGstBreakdown({ itemsTotal, additionalCosts, taxTreatment, gstRatePct }) {
  const costsTotal = additionalCostsTotal(additionalCosts, itemsTotal);
  const rate = Number(gstRatePct) || 0;
  const combined = itemsTotal + costsTotal;

  if (taxTreatment === "inclusive") {
    const grandTotal = combined;
    const preTaxTotal = rate ? grandTotal / (1 + rate / 100) : grandTotal;
    return { costsTotal, preTaxTotal, gst: grandTotal - preTaxTotal, grandTotal };
  }

  if (taxTreatment === "no_gst") {
    return { costsTotal, preTaxTotal: combined, gst: 0, grandTotal: combined };
  }

  // exclusive
  const gst = combined * (rate / 100);
  return { costsTotal, preTaxTotal: combined, gst, grandTotal: combined + gst };
}
