// Currency and percentage formatting (AUD, en-AU).

const whole = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  maximumFractionDigits: 0,
});

const cents = new Intl.NumberFormat("en-AU", {
  style: "currency",
  currency: "AUD",
  minimumFractionDigits: 2,
});

export function toNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function formatCurrency(value, { withCents = false } = {}) {
  const n = toNumber(value);
  if (n === null) return "—";
  return (withCents ? cents : whole).format(n);
}

export function formatPercent(value, digits = 1) {
  const n = toNumber(value);
  if (n === null) return "—";
  return `${n.toFixed(digits)}%`;
}

export function formatNumber(value) {
  const n = toNumber(value);
  if (n === null) return "—";
  return new Intl.NumberFormat("en-AU").format(n);
}
