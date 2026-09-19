// Quote math for the quote builder. Everything here is derived, never
// stored, so editing a quantity, discount, cost or the GST treatment can't
// leave a stale total anywhere.

import { COST_KINDS, costKind } from "@/constants/catalog";

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

/** Rebates and discounts take money off the quote; additional costs add to it. */
export function isDeductionCost(cost) {
  return COST_KINDS[costKind(cost)].deduction;
}

/** The cost lines belonging to one section of the quote builder. */
export function costsOfKind(costs = [], kind) {
  return costs.filter((cost) => costKind(cost) === kind);
}

/**
 * Signed amount of one additional cost — negative for a rebate or discount.
 * A percentage cost is a % of the items subtotal (after item discounts), not
 * of other additional costs.
 */
export function additionalCostAmount(cost, itemsTotal) {
  const value = Number(cost?.value) || 0;
  const amount = cost?.calcType === "percentage" ? itemsTotal * (value / 100) : value;
  return isDeductionCost(cost) ? -amount : amount;
}

/** Net of all additional costs: charges minus rebates and discounts. */
export function additionalCostsTotal(costs = [], itemsTotal) {
  return costs.reduce((sum, cost) => sum + additionalCostAmount(cost, itemsTotal), 0);
}

/** Per-section totals, all as positive numbers, for the totals list. */
export function additionalCostsSplit(costs = [], itemsTotal) {
  const split = costs.reduce(
    (acc, cost) => {
      const amount = Math.abs(additionalCostAmount(cost, itemsTotal));
      const kind = costKind(cost);
      if (kind === "rebate") acc.rebatesTotal += amount;
      else if (kind === "discount") acc.discountsTotal += amount;
      else acc.chargesTotal += amount;
      return acc;
    },
    { chargesTotal: 0, rebatesTotal: 0, discountsTotal: 0 },
  );
  return { ...split, deductionsTotal: split.rebatesTotal + split.discountsTotal };
}

/**
 * GST breakdown for the whole quote. taxTreatment: "exclusive" adds GST on
 * top of the pre-tax total; "no_gst" applies none; "inclusive" treats the
 * items + costs total itself as the GST-inclusive, customer-facing amount
 * and backs the GST component out of it rather than adding it on top.
 *
 * Rebates and discounts come off before GST, like the item discounts do.
 */
export function quoteGstBreakdown({ itemsTotal, additionalCosts, taxTreatment, gstRatePct }) {
  const costsTotal = additionalCostsTotal(additionalCosts, itemsTotal);
  const split = additionalCostsSplit(additionalCosts, itemsTotal);
  const rate = Number(gstRatePct) || 0;
  const combined = itemsTotal + costsTotal;

  if (taxTreatment === "inclusive") {
    const grandTotal = combined;
    const preTaxTotal = rate ? grandTotal / (1 + rate / 100) : grandTotal;
    return { costsTotal, ...split, preTaxTotal, gst: grandTotal - preTaxTotal, grandTotal };
  }

  if (taxTreatment === "no_gst") {
    return { costsTotal, ...split, preTaxTotal: combined, gst: 0, grandTotal: combined };
  }

  // exclusive
  const gst = combined * (rate / 100);
  return { costsTotal, ...split, preTaxTotal: combined, gst, grandTotal: combined + gst };
}

/**
 * Everything on a quote that moves it away from the default price list.
 *  - priceVariations: items whose unit price differs from their catalog
 *    brand price (including a catalog price that changed after quoting);
 *  - discounts: item line discounts and Rebate / Discount cost lines;
 *  - extras: every other additional cost;
 *  - unpriced: items with no catalog price to compare against.
 * Amounts are positive; `difference` on a price variation is quoted − default.
 */
export function quoteVariations(quote, catalogItems = []) {
  const items = quote?.items || [];
  const costs = quote?.additionalCosts || [];
  const itemsTotal = itemsSubtotal(items).total;

  const priceVariations = [];
  const unpriced = [];
  for (const item of items) {
    const brand = findCatalogItem(catalogItems, item.itemKey)?.brands?.find((b) => b.name === item.brand);
    if (!brand || brand.unitPrice === null || brand.unitPrice === undefined) {
      unpriced.push(item);
      continue;
    }
    const defaultPrice = Number(brand.unitPrice) || 0;
    const quotedPrice = Number(item.unitPrice) || 0;
    const difference = quotedPrice - defaultPrice;
    if (Math.abs(difference) >= 0.005) {
      priceVariations.push({
        item,
        defaultPrice,
        quotedPrice,
        difference,
        differencePct: defaultPrice ? (difference / defaultPrice) * 100 : 100,
      });
    }
  }

  const itemDiscounts = items
    .filter((item) => Number(item.discountPct) > 0)
    .map((item) => {
      const gross = (Number(item.quantity) || 0) * (Number(item.unitPrice) || 0);
      return {
        key: `item-${item.id}`,
        label: `${item.itemName} (${item.brand})`,
        detail: `${item.discountPct}% line discount`,
        amount: gross * (Number(item.discountPct) / 100),
      };
    });

  const costLine = (cost) => ({
    key: `cost-${cost.id}`,
    label: cost.description ? `${cost.costType} — ${cost.description}` : cost.costType,
    detail: cost.calcType === "percentage" ? `${cost.value}% of items` : "Fixed amount",
    amount: Math.abs(additionalCostAmount(cost, itemsTotal)),
  });

  const discounts = [...itemDiscounts, ...costs.filter(isDeductionCost).map(costLine)].filter((d) => d.amount > 0);
  const extras = costs.filter((c) => !isDeductionCost(c)).map(costLine).filter((e) => e.amount > 0);

  return {
    priceVariations,
    discounts,
    extras,
    unpriced,
    hasVariation: Boolean(priceVariations.length || discounts.length || extras.length),
  };
}
