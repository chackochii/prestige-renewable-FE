// Builds PDF invoices for a quote: to preview in the browser, to download, and
// to freeze into the invoice history.
//
// jsPDF (and the autotable plugin) are dynamically imported inside
// buildInvoiceDoc rather than at module scope — jsPDF's bundle drags in
// html2canvas/dompurify for a feature we don't use, adding ~150KB gzipped,
// so this keeps that weight out of the opportunity page's own chunk and
// only fetches it the moment someone actually opens or downloads an invoice.
//
// A saved invoice stores a snapshot of the quote as it was when it was saved
// (items, costs, tax treatment, totals). Viewing or downloading it later
// rebuilds the PDF from that snapshot, so later edits to the quote never
// change an invoice that has already been issued.

import {
  additionalCostAmount,
  itemsSubtotal,
  lineTotal,
  projectTypeLabel,
  quoteGstBreakdown,
} from "@/helpers/quote";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/helpers/dateTimeHelpers";

const TAX_TREATMENT_LABEL = {
  exclusive: "Prices are GST-exclusive — GST is added on top.",
  inclusive: "Prices are GST-inclusive — GST is already included in the total.",
  no_gst: "No GST applies to this quote.",
};

const MARGIN = 40;
const TABLE_STYLES = { fontSize: 9, cellPadding: 6 };
const HEAD_STYLES = { fillColor: [245, 245, 245], textColor: 30, fontStyle: "bold" };

const money = (value) => formatCurrency(value, { withCents: true });

/** Totals for a quote, the same numbers the quote builder shows. */
export function invoiceTotals(quote) {
  const items = itemsSubtotal(quote.items);
  const gst = quoteGstBreakdown({
    itemsTotal: items.total,
    additionalCosts: quote.additionalCosts,
    taxTreatment: quote.taxTreatment,
    gstRatePct: quote.gstRatePct,
  });
  return { items, gst };
}

/**
 * The frozen copy of a quote that a saved invoice keeps. Only what the PDF
 * needs, so the history doesn't depend on the live quote record.
 */
export function invoiceSnapshot({ opp, quote }) {
  const { gst } = invoiceTotals(quote);
  return {
    opportunityNumber: opp?.number || "",
    grandTotal: gst.grandTotal,
    quote: {
      quoteNumber: quote.quoteNumber,
      customer: quote.customer,
      estimatorName: quote.estimatorName,
      project: quote.project,
      projectType: quote.projectType,
      projectTypeOther: quote.projectTypeOther,
      quoteDate: quote.quoteDate,
      taxTreatment: quote.taxTreatment,
      gstRatePct: quote.gstRatePct,
      items: quote.items.map((i) => ({ ...i })),
      additionalCosts: quote.additionalCosts.map((c) => ({ ...c })),
    },
  };
}

/** The version number of a saved version, or null for the live quote. */
export function versionOf(version) {
  return version?.version ?? null;
}

/** "PRS-Q1042-v2.pdf" for a saved version, "…-draft.pdf" for the live quote. */
export function invoiceFileName({ quote, version }) {
  const number = version?.snapshot?.quote?.quoteNumber || quote?.quoteNumber || "quote";
  return `${number}-${version ? `v${versionOf(version) ?? version.id}` : "draft"}.pdf`;
}

/**
 * Whether the live quote still matches a saved version. Compares the frozen
 * copy, so a change to any item, cost, rebate, discount or the tax treatment
 * counts — but re-saving an unchanged quote does not make a new version.
 */
export function matchesSnapshot({ opp, quote }, version) {
  if (!version?.snapshot) return false;
  const current = invoiceSnapshot({ opp, quote });
  return JSON.stringify(current.quote) === JSON.stringify(version.snapshot.quote);
}

/**
 * Builds the jsPDF document. `version` is set for a saved version (adds its
 * number and issue date); leave it out to render the live quote as a draft.
 */
async function buildInvoiceDoc({ quote, opportunityNumber, version: saved }) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const { items, gst } = invoiceTotals(quote);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  const number = versionOf(saved);
  doc.setFontSize(18);
  doc.text(saved ? `Quote${number ? ` — Version ${number}` : ""}` : "Quote (draft)", MARGIN, 50);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(
    saved?.invoiceNumber
      ? `Quote No: ${quote.quoteNumber} · Invoice No: ${saved.invoiceNumber}`
      : `Quote No: ${quote.quoteNumber}`,
    MARGIN,
    68,
  );
  doc.setTextColor(20);

  const fields = [
    ["Customer", quote.customer || "—"],
    ["Estimator", quote.estimatorName || "—"],
    ["Project", quote.project || "—"],
    ["Project type", projectTypeLabel(quote) || "—"],
    ["Quote date", formatDate(quote.quoteDate)],
    ["Opportunity", opportunityNumber || "—"],
    ...(saved ? [["Issued", formatDate(saved.createdAt)]] : []),
  ];
  let y = 94;
  doc.setFontSize(10);
  for (let i = 0; i < fields.length; i += 2) {
    const [leftLabel, leftValue] = fields[i];
    doc.setFont("helvetica", "bold");
    doc.text(`${leftLabel}:`, MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.text(String(leftValue), MARGIN + 80, y);
    if (fields[i + 1]) {
      const [rightLabel, rightValue] = fields[i + 1];
      doc.setFont("helvetica", "bold");
      doc.text(`${rightLabel}:`, MARGIN + 280, y);
      doc.setFont("helvetica", "normal");
      doc.text(String(rightValue), MARGIN + 360, y);
    }
    y += 18;
  }

  y += 8;
  doc.setFontSize(12);
  doc.text("Items", MARGIN, y);

  autoTable(doc, {
    startY: y + 8,
    head: [["Item", "Brand", "Qty", "Unit", "Unit Price", "Discount", "Total"]],
    body: quote.items.length
      ? quote.items.map((item) => [
          item.itemName,
          item.brand,
          String(item.quantity),
          item.unit,
          money(item.unitPrice),
          `${item.discountPct}%`,
          money(lineTotal(item)),
        ])
      : [["No items", "", "", "", "", "", ""]],
    theme: "grid",
    styles: TABLE_STYLES,
    headStyles: HEAD_STYLES,
    margin: { left: MARGIN, right: MARGIN },
  });

  let afterY = doc.lastAutoTable.finalY + 24;

  if (quote.additionalCosts.length) {
    doc.setFontSize(12);
    doc.text("Additional costs, rebates & discounts", MARGIN, afterY);
    autoTable(doc, {
      startY: afterY + 8,
      head: [["Cost Type", "Calculation Type", "Value", "Calculated Amount", "Description"]],
      body: quote.additionalCosts.map((cost) => [
        cost.costType,
        cost.calcType === "percentage" ? "Percentage" : "Fixed Amount",
        cost.calcType === "percentage" ? `${cost.value}%` : money(cost.value),
        money(additionalCostAmount(cost, items.total)),
        cost.description || "—",
      ]),
      theme: "grid",
      styles: TABLE_STYLES,
      headStyles: HEAD_STYLES,
      margin: { left: MARGIN, right: MARGIN },
    });
    afterY = doc.lastAutoTable.finalY + 24;
  }

  const totalsRows = [
    ["Items subtotal", money(items.beforeDiscount)],
    ["Item discounts", `-${money(items.discount)}`],
    ["Additional costs", money(gst.chargesTotal)],
    ...(gst.rebatesTotal ? [["Rebates", `-${money(gst.rebatesTotal)}`]] : []),
    ...(gst.discountsTotal ? [["Discounts", `-${money(gst.discountsTotal)}`]] : []),
    ["Pre-Tax Total", money(gst.preTaxTotal)],
    [`GST${quote.taxTreatment !== "no_gst" ? ` (${quote.gstRatePct}%)` : ""}`, money(gst.gst)],
    ["Grand Total", money(gst.grandTotal)],
  ];

  autoTable(doc, {
    startY: afterY,
    body: totalsRows,
    theme: "plain",
    styles: { fontSize: 10, cellPadding: 3 },
    columnStyles: { 1: { halign: "right" } },
    tableWidth: 280,
    margin: { left: pageWidth - MARGIN - 280 },
    didParseCell: (data) => {
      if (data.row.index === totalsRows.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 11;
      }
    },
  });

  const noteY = doc.lastAutoTable.finalY + 20;
  doc.setFontSize(9);
  doc.setTextColor(90);
  doc.text(TAX_TREATMENT_LABEL[quote.taxTreatment] || "", MARGIN, noteY);

  return doc;
}

/** Normalises the two sources — the live quote, or a saved version's snapshot. */
function sourceFor({ opp, quote, version }) {
  if (version?.snapshot?.quote) {
    return { quote: version.snapshot.quote, opportunityNumber: version.snapshot.opportunityNumber, version };
  }
  return { quote, opportunityNumber: opp?.number, version: null };
}

/** Downloads the PDF for the live quote, or for a saved version when `version` is given. */
export async function downloadInvoice({ opp, quote, version }) {
  const source = sourceFor({ opp, quote, version });
  const doc = await buildInvoiceDoc(source);
  doc.save(invoiceFileName(source));
}

/**
 * A blob: URL of the PDF, for showing it in the browser. The caller owns the
 * URL and must pass it to URL.revokeObjectURL when the preview closes.
 */
export async function invoicePreviewUrl({ opp, quote, version }) {
  const doc = await buildInvoiceDoc(sourceFor({ opp, quote, version }));
  return URL.createObjectURL(doc.output("blob"));
}
