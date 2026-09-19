// Preferred language for communication, captured on a lead when it isn't
// English, so it can be assigned to a native-speaking salesperson where the
// unit has one. Blank means English — the default — so nothing has to be
// filled in for most leads.
//
// The list is a starting point, not a limit: anything typed under "Other" is
// stored as-is, and a language already on a record that isn't listed here
// still shows in the picker.

export const COMMON_LANGUAGES = [
  "Mandarin",
  "Cantonese",
  "Arabic",
  "Vietnamese",
  "Hindi",
  "Punjabi",
  "Nepali",
  "Greek",
  "Italian",
  "Spanish",
  "Korean",
  "Tagalog",
];

export const DEFAULT_LANGUAGE = "English";

export function languageLabel(value) {
  return String(value ?? "").trim() || DEFAULT_LANGUAGE;
}
