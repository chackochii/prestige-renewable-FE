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

/** An ABN is 11 digits; spaces are ignored. */
export const isAbn = (value) => /^\d{11}$/.test(String(value ?? "").replace(/\s+/g, ""));

const VALIDATORS = { nmi: isNmi, abn: isAbn };

/** What is wrong with a typed answer (`validate`), or "". */
export function validationError(field, value) {
  if (!field?.validate || blank(value) || VALIDATORS[field.validate]?.(value)) return "";
  return field.invalidText ?? "Check this value.";
}

/** A field's options - fixed, or worked out from the other answers (`optionsFor`). */
export const optionsOf = (field, answers) => (field.optionsFor ? field.optionsFor(answers ?? {}) : (field.options ?? []));

/** Required: not optional, or optional until the answer it goes with is given (`requiredWith`). */
export const fieldRequired = (field, answers) => !field.optional || (Boolean(field.requiredWith) && !blank(answers?.[field.requiredWith]));

/** Whether an item (or field, or record) applies: true, false, or null while that is not yet known. */
export function appliesTo(entry, ctx) {
  if (!entry?.onlyIf) return true;
  const value = ctx?.conditions?.[entry.onlyIf];
  return value === undefined ? null : value;
}

/**
 * Whether a field shows, from another answer in the same section:
 * `showIf: { key, in: [values] }` - shown when that answer (or, for a
 * multi-select, any of its choices) is one of the values.
 */
export function shownBy(entry, answers) {
  // `showWhen(answers)` - shown while a worked-out condition holds (an approved amount below the finance amount).
  if (entry?.showWhen && !entry.showWhen(answers ?? {})) return false;
  if (!entry?.showIf) return true;
  const { key, in: values = [] } = entry.showIf;
  const value = answers?.[key];
  return Array.isArray(value) ? value.some((choice) => values.includes(choice)) : values.includes(value);
}

/** Today as yyyy-mm-dd, in local time - the latest an approval date can be. */
export const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

/**
 * What is wrong with a date answer, or "": `noFuture` dates cannot be after
 * today, and `notBefore` names the answer they cannot be earlier than.
 */
export function dateError(field, value, answers) {
  if (field?.kind !== "date" || blank(value)) return "";
  if (field.noFuture && value > today()) return "Cannot be in the future.";
  const floor = field.notBefore ? answers?.[field.notBefore] : null;
  if (floor && value < floor) return `Cannot be earlier than the ${field.notBeforeLabel ?? "submission date"}.`;
  return "";
}

/** Is one answer filled in, for a field of this kind? */
export function answered(field, value, ctx) {
  switch (field.kind) {
    case "checkbox":
      return value === true;
    case "files":
      return hasFiles(value);
    case "multi":
      return Array.isArray(value) && value.length > 0;
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
      // A confirmation that cannot be given while the record it confirms has gaps.
      return value === true && !(item.blockWhenMissing && ctx?.autoMissing?.(item.source));
    case "checkbox":
      return value === true;
    case "checkDetails":
      return value === true && (!item.detailsRequired || !blank(answers?.[item.detailsKey]));
    case "group":
      return item.fields
        .filter((field) => fieldRequired(field, answers) && shownBy(field, answers))
        .every((field) => {
          const fieldApplies = appliesTo(field, ctx);
          if (fieldApplies === false) return true;
          if (fieldApplies === null) return false;
          return answered(field, answers?.[field.key], ctx) && !validationError(field, answers?.[field.key]);
        });
    case "documents":
      return item.slots.every((slot) => hasFiles(answers?.documents?.[slot.key]));
    case "status": {
      // A finishing status is done once the records it needs are in.
      const status = statusOf(section, answers);
      return Boolean(status?.done) && !statusBlockers(section, answers, ctx).length;
    }
    default:
      return answered(item, value, ctx);
  }
}

/** The records the chosen status shows: its `fields`, less any hidden by another answer. */
export function statusRecords(section, answers, statusValue = statusOf(section, answers)?.value) {
  const item = statusItemOf(section);
  const status = item?.statuses.find((candidate) => candidate.value === statusValue);
  const keys = status?.fields ?? [];
  return keys.map((key) => item.records.find((record) => record.key === key)).filter((record) => record && shownBy(record, answers));
}

/**
 * Why the chosen status cannot be saved yet, one sentence per missing or
 * wrong record ("Attach the approval evidence to mark this as Approved.").
 * Empty when it can.
 */
export function statusBlockers(section, answers, ctx, statusValue = statusOf(section, answers)?.value) {
  const item = statusItemOf(section);
  const status = item?.statuses.find((candidate) => candidate.value === statusValue);
  if (!status) return [];
  const required = new Set(status.required ?? []);
  const reasons = [];
  for (const record of statusRecords(section, answers, statusValue)) {
    const value = answers?.[record.key];
    const label = record.labels?.[status.value] ?? record.label;
    // "Approved Export Limit (kW)" → "approved export limit (kW)": capitalised words lowered, units and acronyms kept.
    const named = label.replace(/\b[A-Z][a-z]+\b/g, (word) => word.toLowerCase());
    if (required.has(record.key) && !answered(record, value, ctx))
      reasons.push(
        record.kind === "checkbox"
          ? `Tick "${label}" to mark this as ${status.label}.`
          : `${record.kind === "files" ? "Attach" : "Record"} the ${named} to mark this as ${status.label}.`,
      );
    const wrong = dateError(record, value, answers);
    if (wrong) reasons.push(`${label}: ${wrong}`);
  }
  // A rule of the status's own (`check(answers, ctx)` → why not, or null).
  const failed = status.check?.(answers ?? {}, ctx ?? {});
  if (failed) reasons.push(failed);
  // Items above that must be complete first (finance: Sections 1 and 2 before lodging).
  for (const key of status.requiresItems ?? []) {
    const item = section.items.find((entry) => entry.key === key);
    if (item && !itemDone(section, item, answers, ctx)) reasons.push(`Complete ${item.label} first to mark this as ${status.label}.`);
  }
  // Answers from the items above that this status cannot be saved without.
  for (const { key, label } of status.requiredAnswers ?? []) {
    if (blank(answers?.[key])) reasons.push(`Record the ${label} to mark this as ${status.label}.`);
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
/** Items hidden until they apply (`hideUnlessApplies`) are left out of the count while hidden. */
export const itemShown = (item, ctx) => !item.hideUnlessApplies || appliesTo(item, ctx) === true;

export function checklistSummary(section, answers, ctx, { locked = false, lockedLabel = "Not open yet" } = {}) {
  const shown = section.items.filter((item) => itemShown(item, ctx));
  const total = shown.length;
  const done = shown.filter((item) => itemDone(section, item, answers, ctx)).length;
  if (!sectionApplies(section, answers)) return { applies: false, locked: false, done: 0, total, label: "Not needed on this job", tone: "neutral" };
  if (locked) return { applies: true, locked: true, done, total, label: lockedLabel, tone: "neutral" };
  const status = statusOf(section, answers);
  if (status) return { applies: true, locked: false, done, total, label: status.label, tone: TRACK_TONES[status.track] ?? "neutral" };
  if (done === total) return { applies: true, locked: false, done, total, label: "Complete", tone: "success" };
  return { applies: true, locked: false, done, total, label: done ? "In progress" : "Ready to start", tone: done ? "warning" : "info" };
}
