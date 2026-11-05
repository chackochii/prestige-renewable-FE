// Which logo a business unit shows - Sydpro's for Sydpro, Prestige's for every
// other unit - on screen, on the public links and in the PDFs.
//
// `unit` is the unit, or anything naming it: its code or name, or a job number
// ("SYD-26-0001" starts with the unit's code). `dark` is for a dark background,
// where Prestige's logo needs its white-lettered version.

export function unitLogo(unit, { dark = false } = {}) {
  const key = typeof unit === "string" ? unit : unit?.code || unit?.name || "";
  if (/^syd/i.test(key)) return { src: "/brand/sydpro-logo.png", alt: "Sydpro Electrical" };
  return { src: dark ? "/brand/prestige-logo-wide.png" : "/brand/prestige-logo-light.png", alt: "Prestige Renewable Solutions" };
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
