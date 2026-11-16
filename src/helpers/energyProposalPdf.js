// Builds the commercial Solar + BESS (+ EV) proposal PDF in the Prestige
// template — the layout of the sent proposals (Metro Petroleum St Marys V8,
// Nov 2026):
//
//   1  cover                                  (the template's cover image)
//   2  why solar + battery for <client>       six numbered advantages
//   3  energy profile & solution overview     invoices (and last year's),
//                                             where the money goes, key system
//                                             summary, key equipment cards
//   4  solar + BESS proposal                  prepared for, header tiles,
//                                             specification, price & incentives
//   5  payment options                        Option A, Option B, savings & payback
//   6  key assumptions & conditions           conditions, exclusions, acceptance,
//                                             important — estimates only
//   7  built into this system & value adds    six numbered value adds
//   8  back page                              (the template's back image)
//
// Every figure comes from the proposal's `result` (the API's calculator) and
// every sentence from its `text` (written from the figures, or by the AI, or
// edited) — nothing is worked out here. The template's photos and icons live in
// public/proposal/. jsPDF is imported only when a PDF is made, as for quotes.
//
// The same builder draws a proposal being edited (from the API) and one sent
// to a customer (a quote version's snapshot — helpers/invoice.js hands it here).

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 43; // side margin
const CW = PAGE_W - M * 2; // content width
const BOTTOM = PAGE_H - 44; // lowest line of content before a new page

// The template's palette.
const NAVY = [27, 36, 65];
const ORANGE = [195, 106, 18];
const BRONZE = [207, 138, 68];
const GOLD = [224, 162, 64];
const RULE_GOLD = [196, 160, 96];
const INK = [42, 46, 58];
const GREY = [68, 68, 68];
const SOFT = [110, 110, 110];
const LINE = [221, 221, 221];
const BEIGE = [232, 226, 210];
const NOTE_BG = [250, 250, 250];
const ROW_FILL = [243, 243, 243];
const WHITE = [255, 255, 255];

const ASSET = (name) => `/proposal/${name}`;

// ---- Formatting -------------------------------------------------------------------

const money = (v) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0);
const dollars = (v) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(Math.round(Number(v) || 0));
const whole = (v) => new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 }).format(Math.round(Number(v) || 0));
/** ~150,000 / ~235: kWh as the template rounds them in headlines. */
const approx = (v) => {
  const n = Math.abs(Number(v) || 0);
  const step = n >= 10000 ? 100 : n >= 1000 ? 10 : 1;
  return whole(Math.round((Number(v) || 0) / step) * step);
};
const trim = (n, places = 1) => {
  const f = 10 ** places;
  const r = Math.round((Number(n) || 0) * f) / f;
  return Number.isInteger(r) ? String(r) : r.toFixed(places).replace(/0+$/, "").replace(/\.$/, "");
};
/** "100" for 99.75 kW (headlines; the specification keeps the exact kW) — as the API's displayKw. */
const displayKw = (kw) => {
  const value = Number(kw) || 0;
  const rounded = Math.round(value);
  if (rounded >= 20 && Math.abs(value - rounded) / value <= 0.003) return String(rounded);
  return trim(value, 2);
};
const longDate = (iso) => (iso ? new Date(`${iso}T00:00:00`).toLocaleDateString("en-AU", { day: "numeric", month: "long", year: "numeric" }) : "");
const titleCase = (s) => String(s ?? "").replace(/\b([a-z])/g, (c) => c.toUpperCase());

/** The standard PDF fonts cannot draw a few characters the wording uses; spell them out, drop the rest. */
const SUBSTITUTE = { "≥": ">=", "≤": "<=", "→": "->", "“": '"', "”": '"', "‘": "'", "’": "'", " ": " " };
const DRAWABLE_EXTRA = new Set([0x2013, 0x2014, 0x2022, 0x2026, 0x20ac]); // – — • … €
const pdfText = (value) =>
  Array.from(String(value ?? ""), (ch) => SUBSTITUTE[ch] ?? ch)
    .join("")
    .split("")
    .filter((ch) => {
      const code = ch.charCodeAt(0);
      return code === 10 || (code >= 32 && code <= 126) || (code >= 161 && code <= 255) || DRAWABLE_EXTRA.has(code);
    })
    .join("");

/** What the proposal covers: EV only when the chargers are in the price (not EV-ready only). */
const evIncluded = (r) => r.system.evChargers > 0 && !r.system.evFuture;
const evFuture = (r) => r.system.evChargers > 0 && r.system.evFuture === true;

// ---- Images -----------------------------------------------------------------------

async function dataUrl(src) {
  const response = await fetch(src);
  if (!response.ok) throw new Error(`Could not load ${src}`);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function loadAssets() {
  const files = {
    cover: "cover.jpg",
    back: "back.jpg",
    logo: "logo.png",
    whyBanner: "why-banner.jpg",
    paymentBanner: "payment-banner.jpg",
    iconSolar: "icon-solar.png",
    iconSystem: "icon-system.png",
    iconOffset: "icon-offset.png",
    iconBenefit: "icon-benefit.png",
    battery: "battery.png",
    batteryEbox: "battery-ebox.jpg",
    panel: "solar-panel.jpg",
    inverter: "inverter.jpg",
    ev: "ev.jpg",
  };
  const entries = await Promise.all(Object.entries(files).map(async ([key, name]) => [key, await dataUrl(ASSET(name)).catch(() => null)]));
  return Object.fromEntries(entries);
}

const formatOf = (data) => (String(data).startsWith("data:image/png") ? "PNG" : "JPEG");

// ---- Drawing helpers --------------------------------------------------------------

function setFont(doc, size, style = "normal", colour = INK) {
  doc.setFont("helvetica", style);
  doc.setFontSize(size);
  doc.setTextColor(...colour);
}

/** Wrapped text from (x, y) within width; returns the y under it. */
function wrap(doc, text, x, y, width, { size = 8.5, style = "normal", colour = GREY, lineHeight = 1.42, align = "left", maxLines = 99 } = {}) {
  setFont(doc, size, style, colour);
  const lines = doc.splitTextToSize(pdfText(text), width).slice(0, maxLines);
  const step = size * lineHeight;
  lines.forEach((line, i) => doc.text(line, align === "center" ? x + width / 2 : align === "right" ? x + width : x, y + i * step, { align }));
  return y + lines.length * step;
}

/** Spaced capitals, like the template's small labels. */
function spaced(doc, text, x, y, { size = 6.5, colour = GOLD, style = "bold", align = "left", charSpace = 0.9 } = {}) {
  setFont(doc, size, style, colour);
  doc.text(pdfText(text).toUpperCase(), x, y, { align, charSpace });
}

function logo(doc, assets) {
  if (!assets.logo) return;
  doc.addImage(assets.logo, "PNG", PAGE_W - M - 70, 24, 70, 47.4, "logo", "FAST");
}

/** Draws an image inside a box, scaled to fit and centred. */
function fitImage(doc, image, x, y, w, h) {
  if (!image) return;
  const props = doc.getImageProperties(image);
  const scale = Math.min(w / props.width, h / props.height);
  const iw = props.width * scale;
  const ih = props.height * scale;
  doc.addImage(image, formatOf(image), x + (w - iw) / 2, y + (h - ih) / 2, iw, ih, undefined, "FAST");
}

/** "WHY SOLAR + BATTERY" / "FOR CLIENT" — a navy line and an orange line. */
function twoLineTitle(doc, first, second, y = 78, size = 19) {
  setFont(doc, size, "bold", NAVY);
  doc.text(pdfText(first), M, y);
  setFont(doc, size, "bold", ORANGE);
  const lines = doc.splitTextToSize(pdfText(second), CW - 90);
  lines.forEach((line, i) => doc.text(line, M, y + size * 1.15 * (i + 1)));
  return y + size * 1.15 * lines.length;
}

/** The orange numbered dot. */
function numberDot(doc, n, cx, cy) {
  doc.setFillColor(...ORANGE);
  doc.circle(cx, cy, 9.5, "F");
  setFont(doc, 7, "bold", WHITE);
  doc.text(String(n).padStart(2, "0"), cx, cy + 2.4, { align: "center" });
}

/** A white disc with an icon in it, as on the navy tiles and strips. */
function iconDisc(doc, image, cx, cy, r) {
  doc.setFillColor(255, 255, 255);
  doc.circle(cx, cy, r, "F");
  if (image) {
    const size = r * 1.7;
    doc.addImage(image, "PNG", cx - size / 2, cy - size / 2, size, size * 0.93, undefined, "FAST");
  }
}

/** A heading with the gold rule under it (pages 4–6). */
function ruledHeading(doc, text, y) {
  setFont(doc, 10, "bold", NAVY);
  doc.text(pdfText(text).toUpperCase(), M, y);
  doc.setDrawColor(...RULE_GOLD);
  doc.setLineWidth(1);
  doc.line(M, y + 6, M + CW, y + 6);
  return y + 14;
}

/** Room for `needed` points below y, else a new page (with the logo); returns where to draw. */
function room(doc, assets, y, needed) {
  if (y + needed <= BOTTOM) return y;
  doc.addPage();
  logo(doc, assets);
  return 90;
}

/** The six numbered cards of pages 2 and 7: two columns, light rules. */
function numberedCards(doc, items, top, startNumber) {
  const colW = (CW - 24) / 2;
  const rowH = 100;
  const list = items.slice(0, 6);
  const rows = Math.ceil(list.length / 2);
  doc.setDrawColor(...BEIGE);
  doc.setLineWidth(0.8);
  doc.line(M + colW + 12, top - 6, M + colW + 12, top + rows * rowH - 4);
  list.forEach((item, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = M + col * (colW + 24);
    const y = top + row * rowH;
    numberDot(doc, startNumber + i, x + 10, y + 16);
    setFont(doc, 8.6, "bold", NAVY);
    const titleLines = doc.splitTextToSize(pdfText(item.title).toUpperCase(), colW - 34);
    titleLines.slice(0, 2).forEach((line, k) => doc.text(line, x + 28, y + 12 + k * 10.5));
    wrap(doc, item.body, x + 28, y + 13 + Math.min(titleLines.length, 2) * 10.5, colW - 34, { size: 7.9, colour: GREY, maxLines: 6 });
  });
  for (let r = 1; r <= rows; r += 1) {
    doc.setDrawColor(...BEIGE);
    doc.line(M, top + r * rowH - 6, M + CW, top + r * rowH - 6);
  }
  return top + rows * rowH;
}

/** The navy rounded strip with an icon, a spaced label and a headline (pages 2 and 7). */
function deliveredStrip(doc, assets, label, headline, y) {
  doc.setFillColor(...NAVY);
  doc.roundedRect(M, y, CW, 46, 4, 4, "F");
  doc.setFillColor(253, 240, 220);
  doc.circle(M + 30, y + 23, 14, "F");
  if (assets.iconSolar) doc.addImage(assets.iconSolar, "PNG", M + 19, y + 13, 22, 20, "iconSolar", "FAST");
  doc.setDrawColor(120, 128, 150);
  doc.setLineWidth(0.6);
  doc.line(M + 58, y + 12, M + 58, y + 34);
  spaced(doc, label, M + 72, y + 19, { size: 6, colour: [215, 218, 228], style: "normal", charSpace: 0.8 });
  setFont(doc, 11, "bold", GOLD);
  let size = 11;
  while (size > 8 && doc.getTextWidth(pdfText(headline)) > CW - 84) {
    size -= 0.5;
    doc.setFontSize(size);
  }
  doc.text(pdfText(headline), M + 72, y + 34);
}

// ---- Pages ------------------------------------------------------------------------------

function fullPageImage(doc, image) {
  if (image) doc.addImage(image, formatOf(image), 0, 0, PAGE_W, PAGE_H, undefined, "MEDIUM");
}

const kindsOf = (r, battery = "BATTERY") =>
  [r.system.solarKw ? "SOLAR" : null, r.system.nominalKwh ? battery : null, evIncluded(r) ? "EV" : null].filter(Boolean).join(" + ") || "ENERGY";

function whyPage(doc, assets, p) {
  const t = p.text;
  logo(doc, assets);
  let y = twoLineTitle(doc, `WHY ${kindsOf(p.result)}`, `FOR ${p.document.clientShort.toUpperCase()}`);
  y = wrap(doc, t.whySubtitle, M, y + 16, CW, { size: 8.6, colour: GREY });
  deliveredStrip(doc, assets, "Delivered by this proposal", t.deliveredBy, y + 12);
  numberedCards(doc, t.advantages, y + 86, 1);
  if (assets.whyBanner) doc.addImage(assets.whyBanner, "JPEG", 0, PAGE_H - 158, PAGE_W, 158, "whyBanner", "MEDIUM");
}

/** A card with a navy title bar (the energy page). `badge` puts an orange tag beside the title. */
function card(doc, x, y, w, h, title, { align = "center", badge = null } = {}) {
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.8);
  doc.roundedRect(x, y, w, h, 4, 4, "S");
  doc.setFillColor(...NAVY);
  doc.roundedRect(x, y, w, 25, 4, 4, "F");
  doc.rect(x, y + 12, w, 13, "F");
  if (align === "center") {
    spaced(doc, title, x + w / 2, y + 16, { size: 7.6, colour: WHITE, align: "center", charSpace: 1 });
    return;
  }
  setFont(doc, 9, "bold", WHITE);
  doc.text(pdfText(title), x + 8, y + 16.5);
  if (badge) {
    const bx = x + 8 + doc.getTextWidth(pdfText(title)) + 6;
    setFont(doc, 5.6, "bold", WHITE);
    const bw = doc.getTextWidth(badge.toUpperCase()) + 9;
    doc.setFillColor(...ORANGE);
    doc.roundedRect(bx, y + 8, bw, 10, 2.5, 2.5, "F");
    doc.text(badge.toUpperCase(), bx + bw / 2, y + 14.6, { align: "center" });
  }
}

function energyPage(doc, assets, p) {
  const { result, text: t } = p;
  logo(doc, assets);
  let y = twoLineTitle(doc, `${p.document.clientShort} –`, "Energy Profile & Solution Overview", 78, 17);
  setFont(doc, 8.6, "normal", GREY);
  doc.text(pdfText(t.intro || "Commercial Solar + Battery Storage Proposal"), M, y + 18);
  y += 32;

  // Current energy use: the invoices, then the bill's same period last year (marked *).
  const colW = (CW - 14) / 2;
  const boxH = 172;
  card(doc, M, y, colW, boxH, "Current energy use");
  const cols = [
    { label: "INVOICE", x: M + 6, align: "left" },
    { label: "KWH/DAY", x: M + 98, align: "right" },
    { label: "OFF-PEAK", x: M + 140, align: "right" },
    { label: "EXPORT KWH", x: M + 190, align: "right" },
    { label: "COST (INC. GST)", x: M + colW - 6, align: "right" },
  ];
  setFont(doc, 6.4, "bold", INK);
  cols.forEach((c) => {
    const words = c.label.split(" ");
    const split = words.length > 1 && c.label.length > 9 ? [words.slice(0, -1).join(" "), words.at(-1)] : [c.label];
    split.forEach((line, i) => doc.text(line, c.x, y + 37 + i * 7.5, { align: c.align }));
  });
  doc.setDrawColor(...LINE);
  doc.line(M, y + 50, M + colW, y + 50);
  let ry = y + 62;
  const rows = [...result.usage.periods.slice(0, 4), ...(result.usage.comparisons ?? []).slice(0, 2)].slice(0, 5);
  rows.forEach((per) => {
    setFont(doc, 7.6, "normal", INK);
    const label = doc.splitTextToSize(pdfText(`${per.label || "—"}${per.comparison ? "*" : ""}`), 80);
    label.slice(0, 2).forEach((line, i) => doc.text(line, cols[0].x, ry + i * 8));
    doc.text(trim(per.kwhPerDay, 1), cols[1].x, ry, { align: "right" });
    doc.text(per.comparison ? "—" : per.offPeakPct ? `${per.offPeakPct}%` : "—", cols[2].x, ry, { align: "right" });
    doc.text(per.comparison ? "—" : whole(per.exportKwh), cols[3].x, ry, { align: "right" });
    doc.text(!per.comparison && per.costIncGst ? money(per.costIncGst) : "—", cols[4].x, ry, { align: "right" });
    ry += label.length > 1 ? 21 : 17;
    doc.setDrawColor(...LINE);
    doc.line(M, ry - 9, M + colW, ry - 9);
  });
  if (!rows.length) {
    setFont(doc, 7.6, "italic", SOFT);
    doc.text("No bill periods entered", cols[0].x, ry);
    ry += 17;
  }
  doc.setFillColor(...NOTE_BG);
  doc.rect(M + 0.5, ry - 6, colW - 1, y + boxH - ry + 5, "F");
  wrap(doc, t.energyNote, M + 8, ry + 4, colW - 16, { size: 6.4, colour: SOFT, maxLines: Math.max(3, Math.floor((y + boxH - ry - 6) / 9.1)) });

  // Where the money goes — largest first, supply last.
  const rx = M + colW + 14;
  card(doc, rx, y, colW, boxH, "Where the money goes");
  const short = (w) => String(w || "").replace(/\s*(on\s+)?weekdays?/i, "").trim();
  const bandLabel = {
    offPeak: "Off-peak energy",
    shoulder: `Shoulder energy (${short(t.shoulderWindow) || "10am–2pm"})`,
    peak: `Peak energy (${short(t.peakWindow) || "4–8pm"})`,
    flat: "Energy (single rate)",
  };
  const bars = [
    ...result.cost.bands
      .filter((b) => b.cost)
      .map((b) => ({ label: bandLabel[b.band], value: b.cost }))
      .sort((a, b) => b.value - a.value),
    ...(result.cost.supply ? [{ label: "Daily supply", value: result.cost.supply }] : []),
  ];
  const maxBar = Math.max(1, ...bars.map((b) => b.value));
  let by = y + 40;
  bars.slice(0, 5).forEach((b) => {
    const labelLines = doc.splitTextToSize(pdfText(b.label), 66);
    setFont(doc, 7.4, "normal", INK);
    labelLines.slice(0, 2).forEach((line, i) => doc.text(line, rx + 6, by + i * 8));
    doc.setFillColor(...BRONZE);
    doc.rect(rx + 78, by - 6.5, Math.max(4, (b.value / maxBar) * (colW - 132)), 8, "F");
    doc.text(dollars(b.value), rx + colW - 6, by, { align: "right" });
    by += labelLines.length > 1 ? 24 : 19;
    doc.setDrawColor(...LINE);
    doc.line(rx, by - 11, rx + colW, by - 11);
  });
  doc.setFillColor(...NOTE_BG);
  doc.rect(rx + 0.5, by - 6, colW - 1, y + boxH - by + 5, "F");
  wrap(doc, t.moneyNote, rx + 8, by + 4, colW - 16, { size: 6.4, colour: SOFT, maxLines: 7 });

  // Key system summary
  y += boxH + 26;
  setFont(doc, 13, "bold", ORANGE);
  doc.text("Key System Summary", M, y);
  doc.setDrawColor(...RULE_GOLD);
  doc.setLineWidth(0.8);
  doc.line(M, y + 7, M + CW, y + 7);
  y += 16;
  const tileW = (CW - 28) / 3;
  const sys = result.system;
  const sav = result.savings;
  const systemValue = [sys.nominalKwh ? `${trim(sys.nominalKwh, 1)} kWh` : null, sys.solarKw ? `${displayKw(sys.solarKw)} kW` : null].filter(Boolean).join(" + ") || `${sys.evChargers} EV chargers`;
  const systemLabel = [sys.nominalKwh ? "Battery" : null, sys.solarKw ? "Solar" : null].filter(Boolean).join(" + ") || "System";
  const tiles = [
    { icon: assets.iconSystem, label: systemLabel, value: systemValue, sub: [sys.usableKwh ? `~${whole(sys.usableKwh)} kWh usable` : null, sys.solarKw ? `~${approx(sav.annualGenerationKwh)} kWh/yr solar` : null].filter(Boolean).join(" · ") },
    { icon: assets.iconOffset, label: "Grid energy offset", value: `~${sav.gridOffsetPct}%`, sub: `of annual kWh supplied by solar${sys.nominalKwh && sys.solarKw ? ", direct and via battery" : ""}` },
    { icon: assets.iconBenefit, label: "Annual benefit", value: `~${dollars(sav.annualBenefit)}`, sub: "per year, incl. GST" },
  ];
  tiles.forEach((tile, i) => {
    const x = M + i * (tileW + 14);
    doc.setFillColor(...NAVY);
    doc.roundedRect(x, y, tileW, 64, 4, 4, "F");
    iconDisc(doc, tile.icon, x + 25, y + 32, 16);
    spaced(doc, tile.label, x + 50, y + 16, { size: 5.6, charSpace: 0.7 });
    let size = 12.5;
    setFont(doc, size, "bold", WHITE);
    while (size > 8 && doc.getTextWidth(pdfText(tile.value)) > tileW - 58) {
      size -= 0.5;
      doc.setFontSize(size);
    }
    doc.text(pdfText(tile.value), x + 50, y + 32);
    wrap(doc, tile.sub, x + 50, y + 42, tileW - 56, { size: 5.6, colour: [215, 218, 228], lineHeight: 1.3, maxLines: 3 });
  });

  // Key equipment: one column per card, the photo above the details.
  y += 64 + 30;
  setFont(doc, 13, "bold", ORANGE);
  doc.text("Key Equipment", M, y);
  doc.setDrawColor(...RULE_GOLD);
  doc.setLineWidth(0.8);
  doc.line(M, y + 7, M + CW, y + 7);
  y += 16;
  const equipment = equipmentCards(p, assets).slice(0, 4);
  if (!equipment.length) return;
  const gap = 8;
  const eqW = (CW - gap * (equipment.length - 1)) / equipment.length;
  const imageH = 84;
  // As tall as the fullest card needs, within the page.
  const heightOf = (eq) => {
    setFont(doc, 8, "bold");
    let h = 25 + imageH + 22 + Math.min(3, doc.splitTextToSize(pdfText(eq.name), eqW - 16).length) * 10.8 + 3;
    setFont(doc, 6.9);
    for (const line of eq.lines) h += Math.min(3, doc.splitTextToSize(pdfText(line), eqW - 16).length) * 9.3;
    return h + 10;
  };
  const eqH = Math.min(BOTTOM - y, Math.max(...equipment.map(heightOf)));
  equipment.forEach((eq, i) => {
    const x = M + i * (eqW + gap);
    card(doc, x, y, eqW, eqH, eq.title, { align: "left", badge: eq.badge });
    if (eq.image) {
      if (eq.photo) {
        // A scene photo fills the band; a product shot sits in it.
        doc.addImage(eq.image, formatOf(eq.image), x + 0.5, y + 25, eqW - 1, imageH + 6, undefined, "FAST");
      } else fitImage(doc, eq.image, x + 8, y + 31, eqW - 16, imageH - 6);
    }
    let ty = wrap(doc, eq.name, x + 8, y + 25 + imageH + 22, eqW - 16, { size: 8, style: "bold", colour: INK, maxLines: 3, lineHeight: 1.35 });
    ty += 3;
    eq.lines.forEach((line) => {
      if (ty > y + eqH - 8) return;
      ty = wrap(doc, line, x + 8, ty, eqW - 16, { size: 6.9, colour: INK, lineHeight: 1.35, maxLines: 3 });
    });
  });
}

/** The key-equipment cards, in the template's order: battery, inverter, solar, EV charging. */
function equipmentCards(p, assets) {
  const { input, result } = p;
  const sys = input.system ?? {};
  const cards = [];
  if (sys.battery) {
    const usable = result.system.usableKwh;
    const lines = sys.battery.description?.length
      ? [...sys.battery.description]
      : [`${trim(result.system.nominalKwh, 1)} kWh nominal LFP (~${whole(usable)} kWh usable)`, sys.battery.inverterKw ? `${trim(sys.battery.inverterKw, 0)} kW built-in hybrid inverter / PCS` : null, "BMS & fire protection in one cabinet", "Energy controller (ECC) & monitoring"].filter(Boolean);
    lines.push(`Quantity: ${sys.battery.quantity ?? 1}`);
    const ebox = /starcharge|ebox/i.test(`${sys.battery.name ?? ""} ${sys.battery.shortName ?? ""}`);
    cards.push({ title: "Battery Storage", name: sys.battery.name, lines, image: (ebox && assets.batteryEbox) || assets.battery });
  }
  if (sys.inverter) {
    cards.push({
      title: "Inverter",
      name: sys.inverter.name,
      lines: [...(sys.inverter.kw ? [`${trim(sys.inverter.kw, 1)} kW rated output`] : []), ...(sys.inverter.description ?? []), `Quantity: ${sys.inverter.quantity ?? 1}`].filter(Boolean),
      image: assets.inverter,
    });
  }
  if (sys.solar) {
    const r = result.system;
    // Without a separate inverter the panels run through the battery's own.
    const described = (sys.solar.description?.length ? sys.solar.description : ["i-TOPCon cells, up to 23.8% efficiency", "25-yr product, 30-yr power warranty"]).filter(
      (line) => !(sys.inverter && /^connected to the battery's hybrid inverter$/i.test(line)),
    );
    const lines = [`${displayKw(r.solarKw)} kW ${sys.solar.mounting || "rooftop"} array`, ...described, `~${approx(result.savings.annualGenerationKwh)} kWh a year (est.)`];
    cards.push({ title: "Solar PV", name: sys.solar.name, lines, image: assets.panel });
  }
  if (sys.ev && evFuture(result)) {
    const kw = trim(sys.ev.kwEach || 22, 0);
    cards.push({
      title: "EV Charging",
      badge: "Future",
      name: `EV-Ready ${titleCase(input.narrativeHints?.siteNoun || "Site")}`,
      lines: sys.ev.description?.length ? sys.ev.description : ["Not included in this price", `Add ${kw} kW AC or DC fast chargers later`, "Load-managed by the energy controller", "Quoted separately on request"],
      image: assets.ev,
      photo: true,
    });
  } else if (sys.ev) {
    cards.push({
      title: "EV Charging",
      name: sys.ev.name,
      lines: [`${sys.ev.chargers} × ${trim(sys.ev.kwEach || 22, 0)} kW AC chargers`, "Revenue estimate depends on use", `Quantity: ${sys.ev.chargers}`],
      image: assets.ev,
      photo: true,
    });
  }
  return cards;
}

function headerTiles(doc, tiles, y) {
  doc.setFillColor(...NAVY);
  doc.roundedRect(M, y, CW, 66, 4, 4, "F");
  const w = CW / tiles.length;
  tiles.forEach((tile, i) => {
    const cx = M + w * i + w / 2;
    if (i) {
      doc.setDrawColor(90, 98, 124);
      doc.setLineWidth(0.6);
      doc.line(M + w * i, y + 10, M + w * i, y + 56);
    }
    spaced(doc, tile.label, cx, y + 17, { size: 5.8, colour: GOLD, align: "center", charSpace: 0.7 });
    setFont(doc, 15, "bold", GOLD);
    doc.text(pdfText(tile.value), cx, y + 38, { align: "center" });
    tile.sub.forEach((line, k) => {
      setFont(doc, 5.8, "normal", [225, 228, 236]);
      doc.text(pdfText(line), cx, y + 50 + k * 7.5, { align: "center" });
    });
  });
  return y + 66;
}

/**
 * The template's ruled tables (pages 4–5): a navy grid, an optional heading
 * row, grey total rows and a navy closing row.
 */
function gridTable(doc, autoTable, y, { head, body, columnStyles, totalRows = [], netRow = null }) {
  autoTable(doc, {
    startY: y,
    head: head ? [head.map((h) => pdfText(h).toUpperCase())] : undefined,
    body: body.map((row) => row.map((c) => (typeof c === "string" ? pdfText(c) : c))),
    theme: "grid",
    margin: { left: M, right: M, top: 90, bottom: 44 },
    styles: { font: "helvetica", fontSize: 7.6, textColor: INK, lineColor: NAVY, lineWidth: 0.9, cellPadding: { top: 6, bottom: 6, left: 7, right: 7 }, valign: "middle" },
    headStyles: { fontStyle: "bold", fontSize: 6.6, textColor: INK, fillColor: WHITE },
    columnStyles,
    didParseCell: (data) => {
      // A right-aligned column has a right-aligned heading.
      if (data.section === "head") {
        if (columnStyles?.[data.column.index]?.halign) data.cell.styles.halign = columnStyles[data.column.index].halign;
        return;
      }
      if (data.section !== "body") return;
      if (totalRows.includes(data.row.index)) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 8.4;
        data.cell.styles.fillColor = ROW_FILL;
      }
      if (netRow !== null && data.row.index === netRow) {
        data.cell.styles.fontStyle = "bold";
        data.cell.styles.fontSize = 8.2;
        data.cell.styles.fillColor = NAVY;
        data.cell.styles.textColor = WHITE;
      }
    },
  });
  return doc.lastAutoTable.finalY;
}

/** A bordered two-column table: a bold label column and the text (pages 4 and 6). */
function boxTable(doc, autoTable, y, rows, { labelWidth = 72, fontSize = 7.2 } = {}) {
  autoTable(doc, {
    startY: y,
    body: rows.map(([label, value]) => [pdfText(label).toUpperCase(), pdfText(value)]),
    theme: "grid",
    margin: { left: M, right: M, top: 90, bottom: 44 },
    styles: { font: "helvetica", fontSize, textColor: INK, lineColor: NAVY, lineWidth: 0.9, cellPadding: { top: 5, bottom: 5, left: 6, right: 6 }, valign: "middle" },
    columnStyles: { 0: { cellWidth: labelWidth, fontStyle: "bold", fontSize: fontSize - 0.4 } },
  });
  return doc.lastAutoTable.finalY;
}

function proposalPage(doc, autoTable, assets, p) {
  const { result: r, text: t, input } = p;
  logo(doc, assets);
  setFont(doc, 16, "bold", NAVY);
  doc.text(`${kindsOf(r, "BESS")} PROPOSAL`, M, 84);
  const headEnd = wrap(doc, t.headline, M, 98, CW - 80, { size: 8.6, colour: GREY, maxLines: 2, lineHeight: 1.3 });

  const site = input.site ?? {};
  const supply = [site.nmi ? `NMI ${site.nmi}` : null, site.network ? `${site.network} network` : null, [site.retailer, site.tariffName].filter(Boolean).join(", ")].filter(Boolean).join(" · ");
  const prepared = [p.document.preparedBy, p.document.company.name, p.document.company.abn ? `ABN ${p.document.company.abn}` : null].filter(Boolean).join(", ");
  let y = boxTable(
    doc,
    autoTable,
    Math.max(112, headEnd + 4),
    [
      ["Prepared for", [input.client?.name, input.client?.abn ? `ABN ${input.client.abn}` : null].filter(Boolean).join(", ") || "—"],
      ["Site", site.address || "—"],
      ["Supply", supply || "—"],
      ["Quote no.", `${p.number}${p.revision > 1 ? ` (rev ${p.revision})` : ""}   Prepared: ${longDate(p.preparedOn)}   Valid until: ${longDate(p.validUntil)}`],
      ["Prepared by", prepared],
    ],
    { labelWidth: 92, fontSize: 7.4 },
  );

  const inc = r.incentives;
  const schemes = [inc.prc.count ? "NSW PRCs" : null, inc.batteryStc.count ? "battery" : null, inc.solarStc.count ? "solar STCs" : null].filter(Boolean).join(" + ").replace("battery + solar STCs", "battery & solar STCs");
  y = headerTiles(
    doc,
    [
      { label: "Total incentives", value: money(inc.total), sub: [schemes || "No incentives apply"] },
      { label: "Average monthly savings", value: `~${dollars(r.savings.monthlyBenefit)}`, sub: ["per month, incl. GST"] },
      { label: `${r.optionA.months}-month plan`, value: money(r.optionA.monthly), sub: [`per month incl. GST · ${trim(r.optionA.upfrontPct, 1)}% upfront`] },
    ],
    y + 22,
  );

  y = ruledHeading(doc, "System design & specification", y + 30);
  const sys = input.system ?? {};
  const spec = [];
  if (sys.battery)
    spec.push([
      "Battery Storage",
      sys.battery.specLabel || sys.battery.name,
      `${trim(r.system.nominalKwh, 1)} kWh nominal (~${whole(r.system.usableKwh)} kWh usable)${sys.battery.inverterKw ? `, ${trim(sys.battery.inverterKw * (sys.battery.quantity || 1), 0)} kW` : ""}`,
    ]);
  if (sys.solar)
    spec.push([
      "Solar PV",
      `${sys.solar.specLabel || sys.solar.name}, ${sys.solar.mounting || "rooftop"} array${sys.inverter ? "" : ", via the battery's hybrid inverter"}`,
      `${trim(r.system.solarKw, 2)} kW panels (${r.system.panelCount ? `${r.system.panelCount} × ${trim(sys.solar.panelWatts || 0, 0)} W` : "panel count to confirm"})`,
    ]);
  if (sys.inverter) spec.push(["Inverter", sys.inverter.specLabel || sys.inverter.name, sys.inverter.kw ? `${trim(sys.inverter.kw * (sys.inverter.quantity || 1), 1)} kW` : "—"]);
  if (sys.ev && evFuture(r)) spec.push(["EV Charging (Future)", `Not included — ${trim(sys.ev.kwEach || 22, 0)} kW AC or DC fast chargers can be added later`, "Quoted separately"]);
  else if (sys.ev) spec.push(["EV Charging", sys.ev.name, `${sys.ev.chargers} × ${trim(sys.ev.kwEach || 22, 0)} kW`]);
  spec.push(["Metering & Monitoring", "Smart metering, CT clamps, online portal", "Included"]);
  y = gridTable(doc, autoTable, y + 4, { head: ["Component", "Brand / Model", "Rating"], body: spec, columnStyles: { 0: { cellWidth: 92 }, 2: { cellWidth: 150 } } });

  y = ruledHeading(doc, "Price breakdown & incentives", room(doc, assets, y + 26, 160));
  const body = r.prices.lines.map((l) => [l.label, money(l.incGst)]);
  const totalIndex = body.length;
  body.push(["Total System Price (incl. GST)", money(r.prices.totalIncGst)]);
  body.push(["GST included", money(r.prices.gstIncluded)]);
  if (inc.prc.count) body.push([`PRCs, NSW PDRS ${inc.prc.category} (${whole(inc.prc.count)} PRCs @ ${money(inc.prc.price)})`, `– ${money(inc.prc.value)}`]);
  if (inc.batteryStc.count) body.push([`STCs, battery (Cheaper Home Batteries, ${whole(inc.batteryStc.count)} STCs @ ${dollars(inc.batteryStc.price)})`, `– ${money(inc.batteryStc.value)}`]);
  if (inc.solarStc.count) body.push([`STCs, new solar (Zone ${inc.solarStc.zone}, ${whole(inc.solarStc.count)} STCs @ ${dollars(inc.solarStc.price)})`, `– ${money(inc.solarStc.value)}`]);
  body.push(["Total Incentives", `– ${money(inc.total)}`]);
  const netIndex = body.length;
  body.push(["NET PRICE AFTER INCENTIVES (incl. GST)", money(r.net.incGst)]);
  y = gridTable(doc, autoTable, y + 4, { head: ["Item", "Amount"], body, columnStyles: { 1: { halign: "right", cellWidth: 120 } }, totalRows: [totalIndex], netRow: netIndex });
  wrap(doc, t.priceNote, M, room(doc, assets, y + 14, 24), CW, { size: 6.4, style: "italic", colour: SOFT, lineHeight: 1.45 });
}

function paymentPage(doc, autoTable, assets, p) {
  const { result: r, text: t } = p;
  logo(doc, assets);
  let y = ruledHeading(doc, "Payment options", 84);

  const A = r.optionA;
  setFont(doc, 7.6, "bold", NAVY);
  doc.text(`OPTION A — ${A.months}-MONTH PAYMENT PLAN`, M, y + 6);
  const aBody = [
    ["Net price after incentives (incl. GST)", money(r.net.incGst)],
    ...(A.financeCost ? [[`Add: finance cost, ${A.months}-month payment plan (${trim(A.financePct, 1)}% of net price)`, `+ ${money(A.financeCost)}`]] : []),
    [`Upfront payment on signing (${trim(A.upfrontPct, 1)}%)`, money(A.upfront)],
    [`Monthly instalments, months 1–${A.months - 1}`, `${money(A.monthly)} / month`],
    [`Final instalment, month ${A.months}`, money(A.final)],
    ["GST included", money(A.gstIncluded)],
    [`FINAL PRICE — ${A.months}-MONTH PLAN (incl. GST)`, money(A.total)],
  ];
  const amountCol = { 1: { halign: "right", cellWidth: 120 } };
  y = gridTable(doc, autoTable, y + 13, { body: aBody, columnStyles: amountCol, netRow: aBody.length - 1 });

  const B = r.optionB;
  setFont(doc, 7.6, "bold", NAVY);
  doc.text(`OPTION B — PAY OUTRIGHT (${B.discountPct ? `${trim(B.discountPct, 1)}% OFF` : "NO ADDITIONAL CHARGES"})`, M, y + 22);
  const bBody = [
    ["Net price after incentives (incl. GST)", money(r.net.incGst)],
    ...(B.discountPct ? [[`Less: ${trim(B.discountPct, 1)}% for paying outright`, `– ${money(r.net.incGst - B.total)}`]] : []),
    ...B.milestones.map((m) => [`${m.label} (${trim(m.pct, 1)}%)`, money(m.amount)]),
    ["GST included", money(B.gstIncluded)],
    ["FINAL PRICE — PAY OUTRIGHT (incl. GST)", money(B.total)],
  ];
  y = gridTable(doc, autoTable, y + 29, { body: bBody, columnStyles: amountCol, netRow: bBody.length - 1 });

  y = ruledHeading(doc, "Estimated savings & payback", room(doc, assets, y + 28, 150));
  const s = r.savings;
  const perYear = (v) => (v < 0 ? `– ${dollars(Math.abs(v))} / yr` : `~${dollars(v)} / yr`);
  const sBody = s.lines.map((l) => [l.label, perYear(l.value)]);
  const totalRow = sBody.length;
  sBody.push(["Estimated annual savings (incl. GST)", `~${dollars(s.annualBenefit)} / yr`]);
  sBody.push(["Average monthly savings", `~${dollars(s.monthlyBenefit)} / month`]);
  sBody.push(["Option A monthly instalment vs average monthly savings", `${money(A.monthly)} vs ~${dollars(s.monthlyBenefit)}`]);
  sBody.push(["Simple payback on total payable (Option A / Option B)", r.payback.optionA ? `~${Number(r.payback.optionA).toFixed(2)} / ~${Number(r.payback.optionB).toFixed(2)} yrs` : "—"]);
  y = gridTable(doc, autoTable, y + 4, { body: sBody, columnStyles: amountCol, totalRows: [totalRow], netRow: sBody.length - 1 });
  y = wrap(doc, t.savingsNote || t.optionANote, M, y + 14, CW, { size: 6.4, style: "italic", colour: SOFT });

  // The template's banner across the foot of the page, when the page has room for it.
  const bannerTop = 703;
  if (assets.paymentBanner && y < bannerTop - 6 && doc.internal.getNumberOfPages() === doc.getCurrentPageInfo().pageNumber) {
    const props = doc.getImageProperties(assets.paymentBanner);
    doc.addImage(assets.paymentBanner, "JPEG", 0, bannerTop, PAGE_W, (PAGE_W * props.height) / props.width, "paymentBanner", "MEDIUM");
  }
}

function conditionsPage(doc, autoTable, assets, p) {
  const { text: t } = p;
  logo(doc, assets);
  let y = ruledHeading(doc, "Key assumptions & conditions", 84);
  y = boxTable(doc, autoTable, y + 4, t.conditions.map((c) => [c.title, c.body]), { labelWidth: 86, fontSize: 6.6 });

  y = ruledHeading(doc, "Exclusions (not included in the system price)", room(doc, assets, y + 20, 80));
  y = boxTable(doc, autoTable, y + 4, t.exclusions.map((x) => [x.title, x.body]), { labelWidth: 86, fontSize: 6.6 });

  // Acceptance and the signature block stay together.
  y = ruledHeading(doc, "Acceptance", room(doc, assets, y + 20, 160));
  y = wrap(doc, t.acceptance, M, y + 6, CW, { size: 7, colour: INK, lineHeight: 1.5 });
  y += 6;
  const rows = [
    { label: "PAYMENT OPTION", h: 24, options: [t.optionAShort, t.optionBShort] },
    { label: "CLIENT NAME", h: 22 },
    { label: "SIGNATURE", h: 22 },
    { label: "DATE", h: 22 },
  ];
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.9);
  rows.forEach((row) => {
    doc.rect(M, y, 86, row.h);
    doc.rect(M + 86, y, CW - 86, row.h);
    setFont(doc, 6.4, "bold", INK);
    doc.text(row.label, M + 6, y + row.h / 2 + 2.2);
    if (row.options) {
      // Both options on one line, a tick box before each.
      let ox = M + 94;
      row.options.forEach((opt) => {
        doc.setLineWidth(0.6);
        doc.rect(ox, y + row.h / 2 - 3.5, 6, 6);
        setFont(doc, 6.8, "normal", INK);
        doc.text(pdfText(opt), ox + 10, y + row.h / 2 + 2);
        ox += doc.getTextWidth(pdfText(opt)) + 24;
      });
      doc.setLineWidth(0.9);
    }
    y += row.h;
  });

  if (t.estimates?.length) {
    y = ruledHeading(doc, "Important — estimates only", room(doc, assets, y + 20, 100));
    y = boxTable(doc, autoTable, y + 4, t.estimates.map((e) => [e.title, e.body]), { labelWidth: 86, fontSize: 6.6 });
  } else {
    y = wrap(doc, t.disclaimer, M, y + 12, CW, { size: 6.2, style: "italic", colour: SOFT });
  }
  const c = p.document.company;
  setFont(doc, 6.4, "normal", SOFT);
  doc.text(pdfText([c.name, c.abn ? `ABN ${c.abn}` : null, c.email].filter(Boolean).join(" · ")), PAGE_W / 2, PAGE_H - 26, { align: "center" });
}

function valuePage(doc, assets, p) {
  const { text: t } = p;
  logo(doc, assets);
  deliveredStrip(doc, assets, "Built into this system & potential value adds", t.valueHeadline || `More value from a ${t.deliveredBy}`, 96);
  const end = numberedCards(doc, t.valueAdds, 172, 7);
  const notes = t.valueFootnote?.length
    ? t.valueFootnote
    : [
        "Figures are indicative estimates for the proposed system, detailed on the previous pages.",
        `Benefits 07–${String(6 + Math.min(6, t.valueAdds.length)).padStart(2, "0")} are not included in the savings estimate or price. VPP enrolment and backup switchgear are quoted separately on request.`,
      ];
  let y = end + 12;
  notes.forEach((line) => {
    y = wrap(doc, line, M, y, CW, { size: 6.4, colour: SOFT, lineHeight: 1.45 });
  });
  if (t.sources) wrap(doc, `Sources: ${String(t.sources).replace(/^sources:\s*/i, "")}`, M, y + 6, CW, { size: 5.8, colour: SOFT, lineHeight: 1.45 });
}

// ---- The document ----------------------------------------------------------------------

/** The jsPDF document for a proposal (as the API returns it, or a sent version's snapshot). */
export async function buildEnergyProposalDoc(proposal) {
  const [pdfModule, tableModule, assets] = await Promise.all([import("jspdf"), import("jspdf-autotable"), loadAssets()]);
  const jsPDF = pdfModule.jsPDF || pdfModule.default;
  const autoTable = tableModule.default || tableModule.autoTable;
  const doc = new jsPDF({ unit: "pt", format: "a4", compress: true });
  doc.setProperties({
    title: `${proposal.document.clientShort} — ${proposal.text.headline}`,
    subject: `Proposal ${proposal.number}`,
    author: proposal.document.company.name,
    creator: proposal.document.company.name,
  });

  fullPageImage(doc, assets.cover);
  doc.addPage();
  whyPage(doc, assets, proposal);
  doc.addPage();
  energyPage(doc, assets, proposal);
  doc.addPage();
  proposalPage(doc, autoTable, assets, proposal);
  doc.addPage();
  paymentPage(doc, autoTable, assets, proposal);
  doc.addPage();
  conditionsPage(doc, autoTable, assets, proposal);
  doc.addPage();
  valuePage(doc, assets, proposal);
  doc.addPage();
  fullPageImage(doc, assets.back);
  return doc;
}

/** "MetroPetroleumStMarys_StMarys_Solar_BESS_Proposal.pdf" — client, suburb, what it is, the revision. */
export function energyProposalFileName(proposal) {
  const squash = (s) => String(s ?? "").replace(/[^A-Za-z0-9]+/g, "");
  const address = proposal.input?.site?.address ?? "";
  const suburb = (address.match(/,\s*([A-Za-z' ]+?)\s+(NSW|VIC|QLD|SA|WA|TAS|ACT|NT)\b/i) ?? [])[1] ?? "";
  const r = proposal.result?.system ?? {};
  const kind = [r.solarKw ? "Solar" : null, r.nominalKwh ? "BESS" : null, r.evChargers && !r.evFuture ? "EV" : null].filter(Boolean).join("_") || "Energy";
  return `${[squash(proposal.document?.clientShort), squash(suburb), kind, "Proposal"].filter(Boolean).join("_")}${proposal.revision > 1 ? `_rev${proposal.revision}` : ""}${proposal.status === "final" ? "" : "_DRAFT"}.pdf`;
}

export async function downloadEnergyProposal(proposal) {
  const doc = await buildEnergyProposalDoc(proposal);
  doc.save(energyProposalFileName(proposal));
}

/** A blob: URL of the PDF for previewing; the caller revokes it. */
export async function energyProposalPreviewUrl(proposal) {
  const doc = await buildEnergyProposalDoc(proposal);
  return URL.createObjectURL(doc.output("blob"));
}

/** The PDF as a Blob, to file on the job. */
export async function energyProposalBlob(proposal) {
  const doc = await buildEnergyProposalDoc(proposal);
  return doc.output("blob");
}
