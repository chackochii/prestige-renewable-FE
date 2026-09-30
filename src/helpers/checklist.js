// The rules every stage checklist runs on — approvals (CL-07/08/09) and
// procurement (CL-10 to CL-14) share them: when an item is done, what has to
// be recorded before a status can be chosen, and how a checklist reads at a
// glance. Pure functions over a checklist definition and its answers, so the
// panels agree — and so they can move to prestige-be unchanged.
//
// A checklist definition is a section { key, code, title, items: [...] } (see
// constants/approvalChecklists.js for the item kinds). Its answers are
// { [itemKey]: value }; uploads are lists of { id, filename }, and the
// documents item keeps them per slot under `documents`.
//
// `ctx` carries what the rules need from outside the answers:
//   conditions   — { name: true | false | null } for items' `onlyIf` and a
//                  status's `requires.conditions` (null = not known yet)
//   autoAnswered — (field) => true | false | undefined, for auto fields inside
//                  a group whose value comes from elsewhere (the finance
//                  application's NMI); undefined means it only shows something

export const blank = (value) => value === undefined || value === null || String(value).trim() === "";
export const hasFiles = (value) => Array.isArray(value) && value.length > 0;

/** An NMI is 10 letters or digits, 11 with its checksum digit; spaces are ignored. */
export const normaliseNmi = (value) => String(value ?? "").replace(/\s+/g, "").toUpperCase();
export const isNmi = (value) => /^[A-Z0-9]{10,11}$/.test(normaliseNmi(value));

const VALIDATORS = { nmi: isNmi };

/** Whether an item (or field, or record) applies: true, false, or null while that is not yet known. */
export function appliesTo(entry, ctx) {
  if (!entry?.onlyIf) return true;
  const value = ctx?.conditions?.[entry.onlyIf];
  return value === undefined ? null : value;
}

/** Is one answer filled in, for a field of this kind? */
export function answered(field, value, ctx) {
  switch (field.kind) {
    case "checkbox":
      return value === true;
    case "files":
      return hasFiles(value);
    case "number":
      return !blank(value) && Number.isFinite(Number(value));
    case "auto": {
      // Inside a group an auto field only shows something, unless the stage
      // says whether its source has it yet (the finance application's NMI).
      const known = ctx?.autoAnswered?.(field);
      return known === undefined ? true : known;
    }
    default:
      return field.validate ? Boolean(VALIDATORS[field.validate]?.(value)) : !blank(value);
  }
}

export const statusItemOf = (section) => section.items.find((item) => item.kind === "status") ?? null;

/** The status an application is at, from the section's list (the first one until chosen). */
export function statusOf(section, answers) {
  const item = statusItemOf(section);
  if (!item) return null;
  const value = answers?.status || item.statuses[0].value;
  return item.statuses.find((status) => status.value === value) ?? item.statuses[0];
}

/** Sl. No of an item within its section, from 1. */
export const itemNumber = (section, key) => section.items.findIndex((item) => item.key === key) + 1;

/** "items 5–6", "items 2, 7", "item 3" — how a list of item keys reads. */
export function itemRange(section, keys) {
  const numbers = keys.map((key) => itemNumber(section, key)).filter((n) => n > 0);
  if (!numbers.length) return "";
  if (numbers.length === 1) return `item ${numbers[0]}`;
  const consecutive = numbers.every((n, i) => i === 0 || n === numbers[i - 1] + 1);
  return consecutive && numbers.length > 2 ? `items ${numbers[0]}–${numbers[numbers.length - 1]}` : `items ${numbers.join(numbers.length === 2 && consecutive ? "–" : ", ")}`;
}

/** Is one checklist item done? Items that do not apply count as done; ones not yet known to apply do not. */
export function itemDone(section, item, answers, ctx) {
  const applies = appliesTo(item, ctx);
  if (applies === false) return true;
  if (applies === null) return false;
  const value = answers?.[item.key];
  switch (item.kind) {
    case "auto":
    case "checkbox":
      return value === true;
    case "checkDetails":
      return value === true && (!item.detailsRequired || !blank(answers?.[item.detailsKey]));
    case "group":
      return item.fields
        .filter((field) => !field.optional)
        .every((field) => {
          const fieldApplies = appliesTo(field, ctx);
          if (fieldApplies === false) return true;
          if (fieldApplies === null) return false;
          return answered(field, answers?.[field.key], ctx);
        });
    case "documents":
      return item.slots.every((slot) => hasFiles(answers?.documents?.[slot.key]));
    case "status": {
      const status = statusOf(section, answers);
      return Boolean(status?.done) && statusBlockers(section, answers, ctx, status.value).length === 0;
    }
    default:
      return answered(item, value, ctx);
  }
}

/**
 * What stops `statusValue` being chosen, as short phrases ("finish items 2, 7",
 * "record the reference number"). Empty when it can be chosen.
 */
export function statusBlockers(section, answers, ctx, statusValue) {
  const item = statusItemOf(section);
  const status = item?.statuses.find((candidate) => candidate.value === statusValue);
  const requires = status?.requires;
  if (!requires) return [];
  const reasons = [];

  if (requires.items) {
    const open = section.items.filter((entry) => entry.kind !== "status" && !itemDone(section, entry, answers, ctx)).map((entry) => entry.key);
    if (open.length) reasons.push(`finish ${itemRange(section, open)}`);
  }
  for (const [name, wanted] of Object.entries(requires.conditions ?? {})) {
    if ((ctx?.conditions?.[name] ?? null) === wanted) continue;
    const definition = section.conditions?.[name];
    const text = definition ? (wanted ? definition.whenTrue : definition.whenFalse) : `${name} must be ${wanted}`;
    reasons.push(definition?.items ? `${text} (${itemRange(section, definition.items)})` : text);
  }
  for (const key of requires.fields ?? []) {
    const record = item.records.find((candidate) => candidate.key === key);
    if (record && !answered(record, answers?.[key], ctx)) reasons.push(`record the ${record.label.toLowerCase()}`);
  }
  return reasons;
}

/** Does this section apply? An optional one only once switched on. */
export const sectionApplies = (section, answers) => !section.optional || answers?.applies === true;

const TRACK_TONES = { not_started: "neutral", submitted: "warning", approved: "success", rejected: "danger" };

/**
 * One checklist at a glance: { applies, locked, done, total, label, tone }.
 * `locked` — the checklist cannot be worked yet (its gate is not open).
 */
export function checklistSummary(section, answers, ctx, { locked = false, lockedLabel = "Not open yet" } = {}) {
  const total = section.items.length;
  const done = section.items.filter((item) => itemDone(section, item, answers, ctx)).length;
  if (!sectionApplies(section, answers)) return { applies: false, locked: false, done: 0, total, label: "Not needed on this job", tone: "neutral" };
  if (locked) return { applies: true, locked: true, done, total, label: lockedLabel, tone: "neutral" };
  const status = statusOf(section, answers);
  if (status) return { applies: true, locked: false, done, total, label: status.label, tone: TRACK_TONES[status.track] ?? "neutral" };
  if (done === total) return { applies: true, locked: false, done, total, label: "Complete", tone: "success" };
  return { applies: true, locked: false, done, total, label: done ? "In progress" : "Ready to start", tone: done ? "warning" : "info" };
}
