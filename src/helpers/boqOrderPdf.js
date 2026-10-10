// The list to get quotes on: every BOQ (materials) and BOS (services) line
// that is not already in our inventory, as a PDF. Produced once "BOQ changes
// approved before ordering" (CL-11) is signed, so it lists the approved BOQ —
// before any supplier or price is known, which come back on the quotes and
// are entered on the supplier-quote tab.
//
// jsPDF and the autotable plugin are imported lazily, as in helpers/invoice.js,
// so they only load when someone downloads the list.

import { materialLines, serviceLines } from "@/helpers/procurement";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { formatNumber } from "@/utils/formatCurrency";

const MARGIN = 40;
const INK = [33, 37, 41];
const MUTED = [108, 117, 125];

const qty = (value) => Number(value) || 0;

/** The lines to get quotes on: not in our inventory and needed on site. */
export const toOrder = (lines) => lines.filter((line) => line.inInventory !== true && qty(line.siteQty) > 0);

export function orderListLines(job) {
  return { materials: toOrder(materialLines(job)), services: toOrder(serviceLines(job)) };
}

export const orderListFileName = (job) => `${job?.number || "job"}-BOQ-BOS-quote-list.pdf`;

export async function downloadBoqOrderList(job, { approvedDetails = "" } = {}) {
  const [pdfModule, tableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const jsPDF = pdfModule.jsPDF || pdfModule.default;
  const autoTable = tableModule.default || tableModule.autoTable;
  const { materials, services } = orderListLines(job);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  let y = MARGIN + 10;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(...INK);
  doc.text("BOQ & BOS — items to get quotes for", MARGIN, y);
  y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(...MUTED);
  doc.text("Lines not held in our inventory, from the BOQ approved before ordering.", MARGIN, y);
  y += 18;

  autoTable(doc, {
    startY: y,
    theme: "plain",
    styles: { fontSize: 9, cellPadding: 2, textColor: INK },
    columnStyles: { 0: { fontStyle: "bold", cellWidth: 130 } },
    margin: { left: MARGIN, right: MARGIN },
    body: [
      ["Job", job?.number || "—"],
      ["Customer", job?.customer || "—"],
      ["Site", job?.site || "—"],
      ["Operations Coordinator", job?.coordinator || "—"],
      ["BOQ changes approved", approvedDetails || "—"],
      ["Generated", formatDate(new Date().toISOString())],
    ],
  });
  y = doc.lastAutoTable.finalY + 20;

  const section = (title, lines, itemHead) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text(title, MARGIN, y);
    y += 8;
    if (!lines.length) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(...MUTED);
      doc.text("Nothing to quote — every line is in our inventory.", MARGIN, y + 10);
      y += 30;
      return;
    }
    autoTable(doc, {
      startY: y,
      theme: "grid",
      styles: { fontSize: 9, cellPadding: 5, textColor: INK },
      headStyles: { fillColor: [241, 243, 245], textColor: INK, fontStyle: "bold" },
      columnStyles: { 0: { cellWidth: 28 }, 3: { cellWidth: 70, halign: "right" }, 4: { cellWidth: 50 } },
      margin: { left: MARGIN, right: MARGIN },
      head: [["#", itemHead, "Brand", "Qty", "Unit"]],
      body: lines.map((line, index) => [index + 1, line.item, line.brand || "—", formatNumber(line.siteQty), line.unit || "ea"]),
    });
    y = doc.lastAutoTable.finalY + 22;
  };

  section(`Materials (BOQ) — ${materials.length} line${materials.length === 1 ? "" : "s"}`, materials, "Item");
  section(`Services (BOS) — ${services.length} line${services.length === 1 ? "" : "s"}`, services, "Service");

  doc.save(orderListFileName(job));
}
