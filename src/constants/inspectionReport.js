// The pre-site inspection form (CL-04): what the site crew member records on
// site, through the site-visit link the Operations Coordinator sends (EST-06).
//
// The crew member always gets the whole form. The items the requester (or the
// coordinator) marked become required; the rest are optional — an inspection
// that turns up one thing worth knowing is worth recording, and a half-filled
// report beats a blank one. The inspection date and the signature are always
// required. Job details come from the job record, and the submission date is
// recorded when the form is sent — neither is typed in.
//
// The list is data, not markup: the form, the requester's picker and the
// report view all render from these sections, so adding a question is one
// line here — and one in prestige-be collaboration/service/inspectionForm.js,
// which checks what comes back. Items are numbered in order, as CL-04 is.

export const FIELD_KINDS = {
  checkbox: "checkbox",
  text: "text",
  number: "number",
  textarea: "textarea",
  files: "files",
  signature: "signature",
  date: "date",
  auto: "auto",
};

/** The built-in upload slot for "additional site photos" (prestige-be SITE_PHOTOS_KEY). */
export const SITE_PHOTOS_KEY = "site_photos";

export const INSPECTION_SECTIONS = [
  {
    key: "job",
    title: "Job Details",
    fields: [
      {
        key: "__job",
        label: "Customer name, site address, job or quote number, and assigned site crew member",
        kind: "auto",
        hint: "shown from the job record",
      },
      { key: "inspectionDate", label: "Inspection date", kind: "date", required: true, hint: "defaults to today — change it if the visit is logged later" },
    ],
  },
  {
    key: "site",
    title: "Site Inspection",
    fields: [
      { key: "siteAccessConfirmed", label: "Site address and property access confirmed", kind: "checkbox" },
      { key: "roofCondition", label: "Roof condition and roof type", kind: "text", placeholder: "e.g. Colorbond, good condition" },
      {
        key: "roofDimensions",
        label: "Roof dimensions and available installation area",
        kind: "text",
        placeholder: "e.g. 14m × 8m, ~95 m² usable",
      },
      { key: "roofPitch", label: "Roof pitch and orientation", kind: "text", placeholder: "e.g. 22°, north-west" },
      { key: "shading", label: "Shading or obstructions identified", kind: "textarea" },
      { key: "switchboard", label: "Switchboard location and condition", kind: "textarea" },
      { key: "meter", label: "Meter location and meter type", kind: "text", placeholder: "e.g. garage wall, smart meter" },
      { key: "inverterLocation", label: "Proposed inverter location", kind: "text" },
      { key: "batteryLocation", label: "Proposed battery location", kind: "text" },
      { key: "cablePathway", label: "Cable pathway and approximate cable length", kind: "text", placeholder: "e.g. through roof cavity, ~18 m" },
      { key: "accessDifficulties", label: "Access or installation difficulties identified", kind: "textarea" },
      { key: "scaffoldRequired", label: "Scaffolding or EWP (elevated work platform) required", kind: "checkbox" },
      { key: "additionalWork", label: "Additional electrical or building work noted", kind: "textarea" },
      {
        key: "unconfirmed",
        label: "Anything that cannot be confirmed from photos or mapping",
        kind: "textarea",
        hint: "what the estimator cannot work out from a desktop review",
      },
    ],
  },
  {
    key: "photos",
    title: "Photos & Notes",
    fields: [
      { key: "__photos", label: "Additional site photos", kind: "files", hint: "take them with the camera or choose from the phone" },
      { key: "measurements", label: "Measurements and site observations", kind: "textarea" },
      { key: "risks", label: "Risks or special requirements", kind: "textarea" },
      { key: "estimationComments", label: "Comments for the Estimation team", kind: "textarea" },
    ],
  },
  {
    key: "final",
    title: "Final Check",
    fields: [
      { key: "findingsRecorded", label: "All site findings recorded", kind: "checkbox" },
      { key: "photosUploaded", label: "Photos uploaded", kind: "checkbox" },
      { key: "measurementsRecorded", label: "Measurements recorded", kind: "checkbox" },
      {
        key: "estimationNotified",
        label: "Estimation team notified of any special requirements",
        kind: "checkbox",
        hint: "sending this form notifies them automatically",
      },
    ],
  },
  {
    key: "signoff",
    title: "Sign-off",
    fields: [
      { key: "signature", label: "Site crew member signature", kind: "signature", required: true },
      { key: "submittedOn", label: "Submission date", kind: "auto", hint: "recorded automatically when the form is sent" },
    ],
  },
];

/** Sl. No for each item, in form order — 1 to 26, as CL-04 numbers them. */
export const ITEM_NUMBERS = Object.fromEntries(
  INSPECTION_SECTIONS.flatMap((section) => section.fields).map((field, index) => [field.key, index + 1]),
);

/** Every answerable field in the report, flattened — handy for reading a saved one back. */
export const INSPECTION_FIELDS = INSPECTION_SECTIONS.flatMap((section) =>
  section.fields.filter((field) => !field.key.startsWith("__")).map((field) => ({ ...field, section: section.title })),
);

/**
 * Can a requester mark this item as required? Not the photo slot (photos are
 * asked for through document slots), not what the form fills in by itself,
 * and not what is always required anyway.
 */
export const isSelectable = (field) => field.kind !== "files" && field.kind !== "auto" && !field.required && !field.key.startsWith("__");

/** The items a requester can mark as required. */
export const SELECTABLE_FIELDS = INSPECTION_FIELDS.filter(isSelectable);

/** The keys a request marked required, normalised. */
export function inspectionChecklistFrom(request) {
  const keys = request?.inspectionChecklist;
  return Array.isArray(keys) ? keys.filter((key) => SELECTABLE_FIELDS.some((f) => f.key === key)) : [];
}

/**
 * The full field definitions behind a list of keys, in the order the checklist
 * is written rather than the order they were ticked.
 */
export function inspectionFieldsFor(keys = []) {
  return SELECTABLE_FIELDS.filter((field) => keys.includes(field.key)).map((field) => ({
    key: field.key,
    label: field.label,
    kind: field.kind,
    hint: field.hint,
  }));
}

/** Keys on the inspection form, so a coordinator's extra questions can be told apart. */
export const FORM_KEYS = new Set(INSPECTION_FIELDS.map((field) => field.key));
