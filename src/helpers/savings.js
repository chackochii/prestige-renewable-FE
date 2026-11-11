// Savings, payback and return on a quote — what the proposal tells the
// customer about the money the system earns back.
//
// The quote keeps three figures (prestige-be quotes.annual_savings,
// current_annual_bill, savings_basis): what the system saves a year, what the
// customer pays for electricity today, and how the savings were worked out.
// "Quote from bill" fills them from the customer's bill; the estimator can
// type them. Everything else is worked out here, from those and the quote's
// net investment, so the quote builder, the PDF, the customer's proposal
// page and the email all show the same numbers:
//
//   payback        months until the savings so far cover the net investment
//   yearly return  the first year's savings as a share of the investment
//   lifetime       the savings over the system's working life, and the gain
//                  once the investment is taken off
//   bill after     today's bill less the savings
//
// Deliberately conservative, as the proposal's terms promise estimates only:
// electricity prices stay at today's rates (a rise only adds to the savings)
// and the output falls 0.5% a year as the system ages.

import { itemsSubtotal, quoteGstBreakdown } from "@/helpers/quote";
import { formatCurrency } from "@/utils/formatCurrency";

/** The share of its output a system loses each year as it ages. */
export const YEARLY_DEGRADATION = 0.005;

/**
 * How many years the lifetime figures run: a battery on its own over its
 * usual 10-year warranty, anything with panels over their 25-year one.
 */
export function horizonYears(projectType) {
  return projectType === "Battery" ? 10 : 25;
}

/** What the customer pays for the system: the quote's grand total, after rebates and discounts. */
export function netInvestmentOf(quote) {
  if (!quote) return 0;
  const items = itemsSubtotal(quote.items || []);
  return quoteGstBreakdown({
    itemsTotal: items.total,
    additionalCosts: quote.additionalCosts || [],
    taxTreatment: quote.taxTreatment,
    gstRatePct: quote.gstRatePct,
  }).grandTotal;
}

/**
 * { investment, annualSavings, currentAnnualBill?, projectType? } → the
 * figures, or null when there is nothing to work out (no savings, or
 * nothing to pay). `paybackMonths` is null when the system does not pay for
 * itself within the horizon. `curve` is the customer's position at the end
 * of each year: the savings so far, less the investment.
 */
export function savingsOf({ investment, annualSavings, currentAnnualBill, projectType }) {
  const annual = Number(annualSavings) || 0;
  const cost = Number(investment) || 0;
  if (annual <= 0 || cost <= 0) return null;

  const years = horizonYears(projectType);
  const curve = [];
  let saved = 0;
  let paybackMonths = null;
  for (let year = 1; year <= years; year += 1) {
    const thisYear = annual * (1 - YEARLY_DEGRADATION) ** (year - 1);
    if (paybackMonths === null && saved + thisYear >= cost) {
      // Part way through this year: rounded up, so the claim is never early.
      paybackMonths = (year - 1) * 12 + Math.max(1, Math.ceil(((cost - saved) / thisYear) * 12));
    }
    saved += thisYear;
    curve.push({ year, saved, net: saved - cost });
  }

  const bill = Number(currentAnnualBill) || 0;
  return {
    annual,
    monthly: annual / 12,
    investment: cost,
    years,
    paybackMonths,
    yearlyReturnPct: (annual / cost) * 100,
    lifetimeSavings: saved,
    netGain: saved - cost,
    lifetimeReturnPct: ((saved - cost) / cost) * 100,
    currentBill: bill > 0 ? bill : null,
    billAfter: bill > 0 ? Math.max(0, bill - annual) : null,
    billCutPct: bill > 0 ? Math.min(100, (annual / bill) * 100) : null,
    curve,
  };
}

/** The figures for a quote — the live one, or a saved version's snapshot.quote. */
export function savingsForQuote(quote) {
  if (!quote) return null;
  return savingsOf({
    investment: netInvestmentOf(quote),
    annualSavings: quote.annualSavings,
    currentAnnualBill: quote.currentAnnualBill,
    projectType: quote.projectType,
  });
}

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/**
 * 62 → "5 years 2 months", 7 → "7 months", 24 → "2 years". `short` gives
 * "5 yrs 2 mths" for a tight space. `years` (the horizon) words a payback
 * that never comes: "more than 25 years".
 */
export function formatPayback(months, { short = false, years = 25 } = {}) {
  if (months === null || months === undefined) return `more than ${years} years`;
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (short) return [y ? `${y} yr${y === 1 ? "" : "s"}` : "", m ? `${m} mth${m === 1 ? "" : "s"}` : ""].filter(Boolean).join(" ");
  return [y ? plural(y, "year") : "", m ? plural(m, "month") : ""].filter(Boolean).join(" ");
}

/** "$2,450 a year" */
export const perYear = (value) => `${formatCurrency(value)} a year`;

/** The one sentence the email and the summary lead with. */
export function savingsSentence(figures) {
  if (!figures) return "";
  const payback = figures.paybackMonths
    ? `pay for itself in about ${formatPayback(figures.paybackMonths)}`
    : `keep saving for its ${figures.years}-year life`;
  return `Your new system is estimated to save you about ${perYear(figures.annual)} and ${payback}.`;
}
