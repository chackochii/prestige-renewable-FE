// Small string helpers.

const HUES = [355, 24, 42, 160, 190, 220, 265, 320];

/** A stable background/foreground color pair derived from a string (same input always gets the same hue). */
export function hueStyle(text) {
  const str = String(text || "");
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  const hue = HUES[hash % HUES.length];
  return { background: `hsl(${hue} 85% 95%)`, color: `hsl(${hue} 55% 38%)` };
}

export function initials(name = "") {
  return String(name)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function plural(count, singular, pluralForm = `${singular}s`) {
  return `${count} ${count === 1 ? singular : pluralForm}`;
}

export function firstName(name = "") {
  return String(name).trim().split(" ")[0] || "";
}

export function joinAddress(...parts) {
  return parts.filter((p) => String(p ?? "").trim()).join(", ");
}
