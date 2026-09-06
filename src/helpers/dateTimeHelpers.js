// Date/time helpers. Display is in the business unit's timezone when given,
// otherwise Australia/Sydney.

const DEFAULT_TZ = "Australia/Sydney";

export function formatDate(value, { withTime = false, timeZone = DEFAULT_TZ } = {}) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  const day = date.toLocaleDateString("en-AU", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone,
  });
  if (!withTime) return day;
  const time = date.toLocaleTimeString("en-AU", { hour: "2-digit", minute: "2-digit", timeZone });
  return `${day} · ${time}`;
}

export function timeAgo(value) {
  if (!value) return "—";
  const diffMs = Date.now() - new Date(value).getTime();
  const minutes = Math.round(diffMs / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days}d ago` : formatDate(value);
}

/** SLA state for a due timestamp → { label, tone, overdue }. */
export function slaStatus(dueAt) {
  if (!dueAt) return { label: "No SLA", tone: "neutral", overdue: false };
  const due = new Date(dueAt);
  const days = Math.ceil((due - new Date()) / 86400000);
  if (days < 0) return { label: `${Math.abs(days)}d overdue`, tone: "danger", overdue: true };
  if (days === 0) return { label: "Due today", tone: "warning", overdue: false };
  if (days <= 2) return { label: `Due in ${days}d`, tone: "warning", overdue: false };
  return { label: `${days}d remaining`, tone: "success", overdue: false };
}

export function isOverdue(dueAt) {
  return Boolean(dueAt) && new Date(dueAt) < new Date();
}

export function daysSince(value) {
  if (!value) return null;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
}

/** ISO/date value → yyyy-mm-dd for <input type="date">. */
export function toDateInput(value) {
  if (!value) return "";
  return String(value).slice(0, 10);
}

/** Start of the current week / month / quarter. */
export function periodStart(period) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (period === "week") {
    const day = d.getDay();
    d.setDate(d.getDate() - (day === 0 ? 6 : day - 1));
    return d;
  }
  if (period === "month") {
    d.setDate(1);
    return d;
  }
  d.setMonth(Math.floor(d.getMonth() / 3) * 3, 1);
  return d;
}
