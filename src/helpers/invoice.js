// Builds a PDF invoice for a quote and triggers a browser download of it.
// jsPDF (and the autotable plugin) are dynamically imported inside
// downloadInvoice rather than at module scope — jsPDF's bundle drags in
// html2canvas/dompurify for a feature we don't use, adding ~150KB gzipped,
// so this keeps that weight out of the opportunity page's own chunk and
// only fetches it the moment someone actually downloads an invoice.

import { additionalCostAmount, itemsSubtotal, lineTotal, projectTypeLabel, quoteGstBreakdown } from "@/helpers/quote";
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

/** Downloads a PDF invoice built from the quote's current items, costs and GST treatment. */
export async function downloadInvoice({ opp, quote }) {
  const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);

  const items = itemsSubtotal(quote.items);
  const gst = quoteGstBreakdown({
    itemsTotal: items.total,
    additionalCosts: quote.additionalCosts,
    taxTreatment: quote.taxTreatment,
    gstRatePct: quote.gstRatePct,
  });

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFontSize(18);
  doc.text("Invoice", MARGIN, 50);
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Quote No: ${quote.quoteNumber}`, MARGIN, 68);
  doc.setTextColor(20);

  const fields = [
    ["Customer", quote.customer || "—"],
    ["Estimator", quote.estimatorName || "—"],
    ["Project", quote.project || "—"],
    ["Project type", projectTypeLabel(quote)],
    ["Quote date", formatDate(quote.quoteDate)],
    ["Opportunity", opp?.number || "—"],
  ];
  let y = 94;
  doc.setFontSize(10);
  for (let i = 0; i < fields.length; i += 2) {
    const [leftLabel, leftValue] = fields[i];
    doc.setFont("helvetica", "bold");
    doc.text(`${leftLabel}:`, MARGIN, y);
    doc.setFont("helvetica", "normal");
    doc.text(leftValue, MARGIN + 80, y);
    if (fields[i + 1]) {
      const [rightLabel, rightValue] = fields[i + 1];
      doc.setFont("helvetica", "bold");
      doc.text(`${rightLabel}:`, MARGIN + 280, y);
      doc.setFont("helvetica", "normal");
      doc.text(rightValue, MARGIN + 360, y);
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
          formatCurrency(item.unitPrice, { withCents: true }),
          `${item.discountPct}%`,
          formatCurrency(lineTotal(item), { withCents: true }),
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
    doc.text("Additional costs", MARGIN, afterY);
    autoTable(doc, {
      startY: afterY + 8,
      head: [["Cost Type", "Calculation Type", "Value", "Calculated Amount", "Description"]],
      body: quote.additionalCosts.map((cost) => [
        cost.costType,
        cost.calcType === "percentage" ? "Percentage" : "Fixed Amount",
        cost.calcType === "percentage" ? `${cost.value}%` : formatCurrency(cost.value, { withCents: true }),
        formatCurrency(additionalCostAmount(cost, items.total), { withCents: true }),
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
    ["Items subtotal", formatCurrency(items.beforeDiscount, { withCents: true })],
    ["Item discounts", `-${formatCurrency(items.discount, { withCents: true })}`],
    ["Additional costs", formatCurrency(gst.costsTotal, { withCents: true })],
    ["Pre-Tax Total", formatCurrency(gst.preTaxTotal, { withCents: true })],
    [`GST${quote.taxTreatment !== "no_gst" ? ` (${quote.gstRatePct}%)` : ""}`, formatCurrency(gst.gst, { withCents: true })],
    ["Grand Total", formatCurrency(gst.grandTotal, { withCents: true })],
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
  doc.text(TAX_TREATMENT_LABEL[quote.taxTreatment], MARGIN, noteY);

  doc.save(`${quote.quoteNumber}-invoice.pdf`);
}
