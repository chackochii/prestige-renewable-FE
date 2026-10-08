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

/**
 * True when a stored date carries a clock time rather than just a day.
 * Checked on the string, not a parsed Date, so a timezone shift cannot turn a
 * date-only value into a false positive.
 */
export function hasClockTime(value) {
  if (typeof value !== "string") return false;
  const time = value.split("T")[1];
  if (!time) return false;
  return !/^00:00(:00)?(\.\d+)?Z?$/.test(time);
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

// ---- Date and time inputs in the unit's timezone ---------------------------------
// A time someone types is a wall-clock time where the business unit works.
// Sent as a bare "2026-10-07T09:00" it was read in the *server's* zone (and
// shown back hours out); read back by cutting the ISO string it showed the UTC
// clock. These convert both ways through the unit's timezone instead.

const zoneOr = (timeZone) => {
  try {
    new Intl.DateTimeFormat("en-AU", { timeZone: timeZone || DEFAULT_TZ });
    return timeZone || DEFAULT_TZ;
  } catch {
    return DEFAULT_TZ;
  }
};

const wallParts = (instant, timeZone) =>
  Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(instant)
      .map((part) => [part.type, part.value]),
  );

/** How far `timeZone`'s clock is ahead of UTC at `instant`, in ms. */
const offsetAt = (instant, timeZone) => {
  const p = wallParts(instant, timeZone);
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - instant.getTime();
};

/** "2026-10-07" + "09:00" in `timeZone` → the ISO instant it is. */
export function zonedTimeToIso(date, time, timeZone) {
  const zone = zoneOr(timeZone);
  const [y, m, d] = String(date).split("-").map(Number);
  const [h, mi] = String(time).split(":").map(Number);
  const wall = Date.UTC(y, m - 1, d, h, mi);
  // The offset at a first guess can differ from the offset at the answer
  // across a daylight-saving change; a second pass settles it.
  let instant = wall - offsetAt(new Date(wall), zone);
  instant = wall - offsetAt(new Date(instant), zone);
  return new Date(instant).toISOString();
}

/**
 * A stored date/time as the date and time inputs show it, in the unit's
 * timezone: { date: "yyyy-mm-dd", time: "HH:MM" | "" }. A date stored without
 * a clock time (UTC midnight — see hasClockTime) is that calendar day with no
 * time, never shifted and never given a made-up "00:00".
 */
export function toDateTimeInputs(value, timeZone) {
  if (!value) return { date: "", time: "" };
  if (!hasClockTime(value)) return { date: toDateInput(value), time: "" };
  const instant = new Date(value);
  if (Number.isNaN(instant.getTime())) return { date: "", time: "" };
  const p = wallParts(instant, zoneOr(timeZone));
  return { date: `${p.year}-${p.month}-${p.day}`, time: `${p.hour}:${p.minute}` };
}

/**
 * Date and time inputs → the value to store: a date alone stays a date
 * ("yyyy-mm-dd", kept as that day); with a time it is that wall-clock time in
 * the unit's timezone, as an ISO instant. A time landing exactly on UTC
 * midnight (11 am in Sydney's summer) would read back as "no time", so it is
 * stored one second later — shown to the minute, nobody sees the second.
 */
export function fromDateTimeInputs(date, time, timeZone) {
  if (!date) return null;
  if (!time) return date;
  const iso = zonedTimeToIso(date, time, timeZone);
  return iso.endsWith("T00:00:00.000Z") ? iso.replace("T00:00:00.000Z", "T00:00:01.000Z") : iso;
}

/** Whether two stored date/times are the same moment ("2026-10-07" and "2026-10-07T00:00:00.000Z" are). */
export function sameInstant(a, b) {
  if (!a || !b) return !a && !b;
  return new Date(a).getTime() === new Date(b).getTime();
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
