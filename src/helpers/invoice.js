// Builds the proposal PDF for a quote: to preview in the browser, to
// download, and to freeze into the quote-version history.
//
// The document follows the Prestige proposal format — letterhead and footer on
// every page, then Executive Summary, System Design & Specification,
// Investment Summary, Conditions & Exclusions, the Commercial Terms and
// Conditions, and an acceptance block for signature. The quote supplies the
// customer, the system and the numbers; constants/proposalTerms.js supplies
// everything that is the same on every proposal.
//
// jsPDF (and the autotable plugin) are dynamically imported inside
// buildInvoiceDoc rather than at module scope — jsPDF's bundle drags in
// html2canvas/dompurify for a feature we don't use, adding ~150KB gzipped,
// so this keeps that weight out of the opportunity page's own chunk and
// only fetches it the moment someone actually opens or downloads a proposal.
//
// A saved version stores a snapshot of the quote as it was when it was saved
// (items, costs, tax treatment, totals, and the customer and site it was
// written for). Viewing or downloading it later rebuilds the PDF from that
// snapshot, so later edits never change a proposal that has already been sent.

import {
  ACCEPTANCE_NOTE,
  COMMERCIAL_TERMS,
  COMPANY,
  EQUIPMENT_COMPLIANCE_NOTE,
  ESTIMATE_DISCLAIMERS,
  NEXT_STEPS,
  NEXT_STEPS_INTRO,
  TERMS_INTRO,
  TERMS_PREAMBLE,
  VALIDITY_DAYS,
} from "@/constants/proposalTerms";
import {
  additionalCostAmount,
  isDeductionCost,
  itemsSubtotal,
  lineTotal,
  projectTypeLabel,
  quoteGstBreakdown,
} from "@/helpers/quote";
import { formatCurrency } from "@/utils/formatCurrency";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { joinAddress } from "@/utils/text";

const TAX_TREATMENT_LABEL = {
  exclusive: "Prices are GST-exclusive — GST is added on top.",
  inclusive: "Prices are GST-inclusive — GST is already included in the total.",
  no_gst: "No GST applies to this quote.",
};

// ---- Page furniture ---------------------------------------------------------

const MARGIN = 56;
const HEADER_Y = 44;
const BODY_TOP = 86;
const FOOTER_Y = 800;

/** The document's own palette, taken from the printed proposal. */
const GOLD = [143, 112, 42];
const BAND = [138, 113, 48];
const PANEL = [245, 239, 227];
const RULE = [206, 200, 186];
const INK = [38, 38, 38];
const MUTED = [110, 110, 110];

const TABLE_STYLES = { font: "helvetica", fontSize: 9, cellPadding: 6, textColor: INK, lineColor: RULE };
const HEAD_STYLES = { fillColor: BAND, textColor: 255, fontStyle: "bold", fontSize: 9 };
const LABEL_COL = { fontStyle: "bold", cellWidth: 150, fillColor: [252, 250, 245] };

const money = (value) => formatCurrency(value, { withCents: true });
const asList = (value) => (Array.isArray(value) ? value : []);

/** Free text a person typed as one block, split into the lines they meant. */
const linesOf = (text) =>
  String(text || "")
    .split(/\r?\n|;/)
    .map((line) => line.replace(/^[-•*\s]+/, "").trim())
    .filter(Boolean);

/** The date a proposal stops standing at its quoted price. */
function validUntil(quoteDate) {
  const from = quoteDate ? new Date(quoteDate) : new Date();
  if (Number.isNaN(from.getTime())) return "";
  from.setDate(from.getDate() + VALIDITY_DAYS);
  return from.toISOString().slice(0, 10);
}

// ---- Totals -----------------------------------------------------------------

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
 * The frozen copy of a quote that a saved version keeps. Only what the PDF
 * needs, so the history doesn't depend on the live quote or the opportunity.
 */
export function invoiceSnapshot({ opp, quote }) {
  const { gst } = invoiceTotals(quote);
  return {
    opportunityNumber: opp?.number || "",
    grandTotal: gst.grandTotal,
    // Frozen with the rest, so an old proposal still names the site and the
    // inclusions it was written against.
    site: joinAddress(opp?.siteLine1, [opp?.siteSuburb, opp?.siteState, opp?.sitePostcode].filter(Boolean).join(" ")),
    inclusions: opp?.estimationInput?.inclusions || "",
    exclusions: opp?.estimationInput?.exclusions || "",
    clientSpecialRequirements: opp?.estimationInput?.clientSpecialRequirements || "",
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
  return stableJson(current.quote) === stableJson(version.snapshot.quote);
}

/**
 * JSON with object keys sorted. A saved snapshot comes back from Postgres
 * JSONB with its keys re-ordered (shortest first), so a plain JSON.stringify
 * never matched the live quote and every save looked like a change.
 */
function stableJson(value) {
  return JSON.stringify(value, (key, inner) =>
    inner && typeof inner === "object" && !Array.isArray(inner)
      ? Object.fromEntries(Object.keys(inner).sort().map((k) => [k, inner[k]]))
      : inner,
  );
}

// ---- Drawing ----------------------------------------------------------------

/** Letterhead and footer, drawn on every page once the page count is known. */
function drawFurniture(doc, company) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pages = doc.internal.getNumberOfPages();

  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);

    doc.setFont("times", "bold");
    doc.setFontSize(15);
    doc.setTextColor(...INK);
    doc.text(company.wordmark, MARGIN, HEADER_Y);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(company.strapline, pageWidth - MARGIN, HEADER_Y - 2, { align: "right" });

    doc.setDrawColor(...RULE);
    doc.setLineWidth(0.7);
    doc.line(MARGIN, HEADER_Y + 10, pageWidth - MARGIN, HEADER_Y + 10);

    doc.line(MARGIN, FOOTER_Y - 12, pageWidth - MARGIN, FOOTER_Y - 12);
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(`${company.name}, ABN ${company.abn} · ${company.address}`, MARGIN, FOOTER_Y);
    doc.text(`Page ${page}`, pageWidth - MARGIN, FOOTER_Y, { align: "right" });
  }
  doc.setTextColor(...INK);
}

/** A running cursor that starts a new page before it runs into the footer. */
function makeCursor(doc) {
  let y = BODY_TOP;
  return {
    get y() {
      return y;
    },
    set y(value) {
      y = value;
    },
    /** Ensures `needed` points of room, starting a page when there isn't. */
    room(needed) {
      if (y + needed > FOOTER_Y - 28) {
        doc.addPage();
        y = BODY_TOP;
      }
      return y;
    },
  };
}

function sectionHeading(doc, cursor, text) {
  cursor.room(40);
  doc.setFont("times", "bold");
  doc.setFontSize(13.5);
  doc.setTextColor(...GOLD);
  doc.text(text.toUpperCase(), MARGIN, cursor.y);
  const width = doc.internal.pageSize.getWidth() - MARGIN * 2;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.7);
  doc.line(MARGIN, cursor.y + 5, MARGIN + width, cursor.y + 5);
  doc.setTextColor(...INK);
  cursor.y += 22;
}

function subHeading(doc, cursor, text) {
  cursor.room(30);
  doc.setFont("times", "bold");
  doc.setFontSize(11.5);
  doc.setTextColor(...INK);
  doc.text(text, MARGIN, cursor.y);
  cursor.y += 16;
}

function paragraph(doc, cursor, text, { size = 9.5, colour = INK, italic = false, gap = 10 } = {}) {
  if (!text) return;
  const width = doc.internal.pageSize.getWidth() - MARGIN * 2;
  doc.setFont("helvetica", italic ? "italic" : "normal");
  doc.setFontSize(size);
  doc.setTextColor(...colour);
  const lines = doc.splitTextToSize(String(text), width);
  const lineHeight = size * 1.35;
  for (const line of lines) {
    cursor.room(lineHeight);
    doc.text(line, MARGIN, cursor.y);
    cursor.y += lineHeight;
  }
  doc.setTextColor(...INK);
  cursor.y += gap;
}

function bullets(doc, cursor, list) {
  const width = doc.internal.pageSize.getWidth() - MARGIN * 2 - 14;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(...INK);
  for (const item of list) {
    const lines = doc.splitTextToSize(String(item), width);
    lines.forEach((line, i) => {
      cursor.room(13);
      if (i === 0) doc.text("•", MARGIN, cursor.y);
      doc.text(line, MARGIN + 14, cursor.y);
      cursor.y += 13;
    });
  }
  cursor.y += 8;
}

/**
 * Runs autoTable from the cursor and leaves the cursor under the result.
 * `autoTable` is handed in because the plugin is imported lazily.
 */
function table(doc, autoTable, cursor, options) {
  cursor.room(60);
  autoTable(doc, {
    startY: cursor.y,
    theme: "grid",
    styles: TABLE_STYLES,
    headStyles: HEAD_STYLES,
    margin: { left: MARGIN, right: MARGIN, top: BODY_TOP, bottom: 56 },
    ...options,
  });
  cursor.y = doc.lastAutoTable.finalY + 18;
}

/** The two headline figures, in the cream panel the printed proposal uses. */
function pricePanel(doc, cursor, left, right) {
  const width = doc.internal.pageSize.getWidth() - MARGIN * 2;
  const half = width / 2;
  const height = 58;
  cursor.room(height + 10);

  doc.setFillColor(...PANEL);
  doc.setDrawColor(...RULE);
  doc.rect(MARGIN, cursor.y, width, height, "FD");
  doc.line(MARGIN + half, cursor.y, MARGIN + half, cursor.y + height);

  const cell = (x, { label, value, note }) => {
    const centre = x + half / 2;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(label, centre, cursor.y + 16, { align: "center" });
    doc.setFont("times", "bold");
    doc.setFontSize(17);
    doc.setTextColor(...GOLD);
    doc.text(value, centre, cursor.y + 38, { align: "center" });
    if (note) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(...MUTED);
      doc.text(note, centre, cursor.y + 50, { align: "center" });
    }
  };

  cell(MARGIN, left);
  cell(MARGIN + half, right);
  doc.setTextColor(...INK);
  cursor.y += height + 18;
}

// ---- The document -----------------------------------------------------------

/**
 * Builds the jsPDF document. `version` is set for a saved version (adds its
 * number and issue date); leave it out to render the live quote as a draft.
 */
async function buildInvoiceDoc({ quote, opportunityNumber, site, inclusions, exclusions, company, version: saved }) {
  // jspdf publishes the constructor as both a named and a default export, and
  // the plugin as either; take whichever the bundler hands over.
  const [pdfModule, tableModule] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
  const jsPDF = pdfModule.jsPDF || pdfModule.default;
  const autoTable = tableModule.default || tableModule.autoTable;
  const { items, gst } = invoiceTotals(quote);

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const cursor = makeCursor(doc);
  const row = (options) => table(doc, autoTable, cursor, options);
  const number = versionOf(saved);
  const systemName = projectTypeLabel(quote) || "System";
  const gstNote = quote.taxTreatment === "no_gst" ? "" : " + GST";

  // ---- Title and the who/where/when block ----
  doc.setFont("times", "bold");
  doc.setFontSize(19);
  doc.setTextColor(...GOLD);
  doc.text(`${systemName.toUpperCase()} PROPOSAL`, MARGIN, cursor.y);
  cursor.y += 16;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  doc.setTextColor(...MUTED);
  doc.text(
    [quote.project, saved ? `Version ${number ?? saved.id}` : "Draft"].filter(Boolean).join("  ·  "),
    MARGIN,
    cursor.y,
  );
  doc.setTextColor(...INK);
  cursor.y += 20;

  const until = validUntil(quote.quoteDate);
  row({
    body: [
      ["PREPARED FOR", quote.customer || "—"],
      ["SITE", site || "—"],
      [
        "QUOTE NO.",
        [
          quote.quoteNumber || "—",
          `Prepared: ${formatDate(quote.quoteDate)}`,
          until ? `Valid until: ${formatDate(until)}` : "",
          saved?.invoiceNumber ? `Invoice No: ${saved.invoiceNumber}` : "",
          opportunityNumber ? `Opportunity: ${opportunityNumber}` : "",
        ]
          .filter(Boolean)
          .join("    "),
      ],
      ["PREPARED BY", `${quote.estimatorName || "—"}, ${company.name}, ABN ${company.abn}`],
    ],
    columnStyles: { 0: LABEL_COL },
  });

  // ---- Executive summary ----
  sectionHeading(doc, cursor, "Executive summary");
  paragraph(
    doc,
    cursor,
    `This proposal covers ${quote.project || systemName.toLowerCase()} for ${quote.customer || "the client"}` +
      `${site ? ` at ${site}` : ""}. It comprises ${quote.items.length} line ` +
      `item${(quote.items.length || 0) === 1 ? "" : "s"} with a system price of ${money(gst.preTaxTotal + gst.rebatesTotal + gst.discountsTotal)}` +
      `${gstNote}, and a net investment of ${money(gst.grandTotal)} after the rebates and discounts set out below.`,
  );
  paragraph(doc, cursor, TAX_TREATMENT_LABEL[quote.taxTreatment] || "", { colour: MUTED, italic: true });

  subHeading(doc, cursor, "At a glance");
  row({
    head: [["System price", "Rebates & discounts", "Net investment", "Prepared"]],
    body: [
      [
        `${money(gst.preTaxTotal + gst.rebatesTotal + gst.discountsTotal)}${gstNote}`,
        money(gst.rebatesTotal + gst.discountsTotal),
        `${money(gst.grandTotal)}`,
        formatDate(quote.quoteDate),
      ],
    ],
  });
  paragraph(doc, cursor, ESTIMATE_DISCLAIMERS[0], { size: 8, colour: MUTED, italic: true });

  // ---- System design ----
  sectionHeading(doc, cursor, "System design & specification");
  row({
    head: [["Component", "Brand / Model", "Quantity / Rating", "Unit price", "Total"]],
    body: quote.items.length
      ? quote.items.map((item) => [
          item.itemName,
          item.brand || "—",
          `${item.quantity} ${item.unit || ""}`.trim(),
          money(item.unitPrice) + (Number(item.discountPct) ? `  (less ${item.discountPct}%)` : ""),
          money(lineTotal(item)),
        ])
      : [["No items have been added to this quote yet.", "", "", "", ""]],
    columnStyles: { 3: { halign: "right" }, 4: { halign: "right" } },
  });
  paragraph(doc, cursor, EQUIPMENT_COMPLIANCE_NOTE, { size: 8.5, colour: MUTED });

  // ---- Investment summary ----
  sectionHeading(doc, cursor, "Investment summary");
  pricePanel(
    doc,
    cursor,
    {
      label: "SYSTEM PRICE",
      value: money(gst.preTaxTotal + gst.rebatesTotal + gst.discountsTotal),
      note: gstNote ? "+ GST" : "no GST applies",
    },
    { label: "NET INVESTMENT", value: money(gst.grandTotal), note: "including GST where it applies" },
  );

  const charges = asList(quote.additionalCosts).filter((c) => !isDeductionCost(c));
  const deductions = asList(quote.additionalCosts).filter((c) => isDeductionCost(c));
  if (charges.length || deductions.length) {
    row({
      head: [["Additional costs, rebates & discounts", "Basis", "Amount"]],
      body: [
        ...charges.map((cost) => [
          [cost.costType, cost.description].filter(Boolean).join(" — "),
          cost.calcType === "percentage" ? `${cost.value}% of items` : "Fixed amount",
          money(additionalCostAmount(cost, items.total)),
        ]),
        ...deductions.map((cost) => [
          [cost.costType, cost.description].filter(Boolean).join(" — "),
          cost.calcType === "percentage" ? `${cost.value}% of items` : "Fixed amount",
          `-${money(Math.abs(additionalCostAmount(cost, items.total)))}`,
        ]),
      ],
      columnStyles: { 2: { halign: "right" } },
    });
  }

  const totalsRows = [
    ["Items subtotal", money(items.beforeDiscount)],
    ["Item discounts", `-${money(items.discount)}`],
    ["Additional costs", money(gst.chargesTotal)],
    ...(gst.rebatesTotal ? [["Rebates", `-${money(gst.rebatesTotal)}`]] : []),
    ...(gst.discountsTotal ? [["Discounts", `-${money(gst.discountsTotal)}`]] : []),
    ["Pre-tax total", money(gst.preTaxTotal)],
    [`GST${quote.taxTreatment !== "no_gst" ? ` (${quote.gstRatePct}%)` : ""}`, money(gst.gst)],
    ["NET INVESTMENT", money(gst.grandTotal)],
  ];
  row({
    body: totalsRows,
    theme: "plain",
    styles: { ...TABLE_STYLES, cellPadding: 4 },
    tableWidth: 300,
    margin: { left: doc.internal.pageSize.getWidth() - MARGIN - 300, right: MARGIN },
    columnStyles: { 1: { halign: "right" } },
    didParseCell: (data) => {
      if (data.row.index === totalsRows.length - 1) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 10.5;
        data.cell.styles.textColor = GOLD;
      }
    },
  });

  // ---- Conditions and exclusions ----
  const conditionRows = linesOf(inclusions);
  const exclusionRows = linesOf(exclusions);
  if (conditionRows.length) {
    sectionHeading(doc, cursor, "Conditions & inclusions");
    row({ body: conditionRows.map((text) => [text]) });
  }
  if (exclusionRows.length) {
    sectionHeading(doc, cursor, "Exclusions");
    row({ body: exclusionRows.map((text) => [text]) });
  }
  paragraph(doc, cursor, ESTIMATE_DISCLAIMERS[1], { size: 8, colour: MUTED, italic: true });

  // ---- Commercial terms ----
  doc.addPage();
  cursor.y = BODY_TOP;
  sectionHeading(doc, cursor, "Commercial terms and conditions");
  paragraph(doc, cursor, TERMS_PREAMBLE, { size: 8.5, colour: MUTED, italic: true });
  paragraph(doc, cursor, TERMS_INTRO);

  for (const part of COMMERCIAL_TERMS) {
    cursor.room(46);
    doc.setFont("times", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...GOLD);
    doc.text(`${part.n}.  ${part.title}`, MARGIN, cursor.y);
    doc.setTextColor(...INK);
    cursor.y += 15;

    const width = doc.internal.pageSize.getWidth() - MARGIN * 2 - 28;
    for (const [n, text] of part.clauses) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      const lines = doc.splitTextToSize(text, width);
      lines.forEach((line, i) => {
        cursor.room(12);
        if (i === 0) {
          doc.setFont("helvetica", "bold");
          doc.text(n, MARGIN, cursor.y);
          doc.setFont("helvetica", "normal");
        }
        doc.text(line, MARGIN + 28, cursor.y);
        cursor.y += 11.5;
      });
      cursor.y += 3;
    }
    cursor.y += 8;
  }

  // ---- Next steps and acceptance ----
  doc.addPage();
  cursor.y = BODY_TOP;
  sectionHeading(doc, cursor, "Next steps & acceptance");
  paragraph(doc, cursor, NEXT_STEPS_INTRO);
  bullets(doc, cursor, NEXT_STEPS);

  subHeading(doc, cursor, "Acceptance confirmation");
  paragraph(doc, cursor, ACCEPTANCE_NOTE, { size: 8.5, colour: MUTED });
  row({
    body: [
      ["Client name", "\n"],
      ["Signature", "\n"],
      ["Date", "\n"],
    ],
    columnStyles: { 0: LABEL_COL },
    styles: { ...TABLE_STYLES, minCellHeight: 34 },
  });

  drawFurniture(doc, company);
  return doc;
}

/** Normalises the two sources — the live quote, or a saved version's snapshot. */
function sourceFor({ opp, quote, unit, version }) {
  const company = {
    ...COMPANY,
    ...(unit?.name ? { name: unit.name } : {}),
    ...(unit?.abn ? { abn: unit.abn } : {}),
    ...(unit?.address ? { address: unit.address } : {}),
  };
  if (version?.snapshot?.quote) {
    const snap = version.snapshot;
    return {
      quote: snap.quote,
      opportunityNumber: snap.opportunityNumber,
      // Older snapshots predate these; the quote still renders without them.
      site: snap.site || "",
      inclusions: snap.inclusions || "",
      exclusions: snap.exclusions || "",
      company,
      version,
    };
  }
  const input = opp?.estimationInput || {};
  return {
    quote,
    opportunityNumber: opp?.number,
    site: joinAddress(opp?.siteLine1, [opp?.siteSuburb, opp?.siteState, opp?.sitePostcode].filter(Boolean).join(" ")),
    inclusions: input.inclusions || "",
    exclusions: input.exclusions || "",
    company,
    version: null,
  };
}

/** Downloads the PDF for the live quote, or for a saved version when `version` is given. */
export async function downloadInvoice({ opp, quote, unit, version }) {
  const source = sourceFor({ opp, quote, unit, version });
  const doc = await buildInvoiceDoc(source);
  doc.save(invoiceFileName(source));
}

/**
 * A blob: URL of the PDF, for showing it in the browser. The caller owns the
 * URL and must pass it to URL.revokeObjectURL when the preview closes.
 */
export async function invoicePreviewUrl({ opp, quote, unit, version }) {
  const doc = await buildInvoiceDoc(sourceFor({ opp, quote, unit, version }));
  return URL.createObjectURL(doc.output("blob"));
}
