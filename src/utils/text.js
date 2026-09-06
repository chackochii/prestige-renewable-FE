// Small string helpers.

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
