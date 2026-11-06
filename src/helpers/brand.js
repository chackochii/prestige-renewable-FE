// Which logo a business unit shows — on screen, on the public links and in the
// PDFs. The API says which company a unit trades as (business_units.brand:
// "prestige" or "sydpro") and carries it on the unit itself, on a public
// proposal's `business`, on a site-visit task, and from GET /public/leads/brand
// for the enquiry link. Until the API has said — or for anything from before it
// did — the code or name decides: Sydpro's for anything starting "syd" (its
// code, its name, or a job number like "SYD-26-0001"), Prestige's otherwise.
//
// `dark` is for a dark background, where Prestige's logo needs its
// white-lettered version and Sydpro's (dark lettering only) a white tile —
// the `unit-logo-tile` class, styles/app.css.

const LOGOS = {
  prestige: { light: "/brand/prestige-logo-light.png", dark: "/brand/prestige-logo-wide.png", alt: "Prestige Renewable Solutions" },
  sydpro: { light: "/brand/sydpro-logo.png", dark: "/brand/sydpro-logo.png", alt: "Sydpro Electrical", tileOnDark: true },
};

/** The brands a unit can trade as, as the API names them (the unit form's choices). */
export const BRANDS = Object.keys(LOGOS);

/** The company a brand key names, e.g. "Sydpro Electrical". */
export const brandLabel = (brand) => (LOGOS[brand] || LOGOS.prestige).alt;

/**
 * "prestige" | "sydpro" for a unit (or anything carrying `brand`), else from a
 * code, a name or a job number.
 */
export function unitBrand(unit) {
  if (unit && typeof unit === "object" && LOGOS[unit.brand]) return unit.brand;
  const key = typeof unit === "string" ? unit : unit?.code || unit?.name || "";
  return /^syd/i.test(key) ? "sydpro" : "prestige";
}

export function unitLogo(unit, { dark = false } = {}) {
  const logo = LOGOS[unitBrand(unit)];
  return { src: dark ? logo.dark : logo.light, alt: logo.alt, ...(dark && logo.tileOnDark ? { className: "unit-logo-tile" } : {}) };
}

/** The logo as a data: URL, for jsPDF's addImage. */
export async function logoDataUrl(unit) {
  const blob = await (await fetch(unitLogo(unit).src)).blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
