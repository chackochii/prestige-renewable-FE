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
      { key: "inspectionDate", label: "Inspection date", kind: "date", required: true, hint: "defaults to today - change it if the visit is logged later" },
    ],
  },
  {
    key: "site",
    title: "Site Inspection",
    // What the estimator picks from on the request (UAT, Oct 2026).
    fields: [
      { key: "roofCondition", label: "Roof Condition and Roof Type", kind: "text", placeholder: "e.g. Colorbond, good condition" },
      {
        key: "roofDimensions",
        label: "Roof Dimensions and Available Installation Area",
        kind: "text",
        placeholder: "e.g. 14m × 8m, ~95 m² usable",
      },
      { key: "roofPitch", label: "Roof Pitch and Orientation", kind: "text", placeholder: "e.g. 22°, north-west" },
      { key: "shading", label: "Shading or Obstructions", kind: "textarea" },
      { key: "switchboard", label: "Switchboard Location and Condition", kind: "textarea" },
      { key: "meter", label: "Meter Location and Meter Type", kind: "text", placeholder: "e.g. garage wall, smart meter" },
      { key: "inverterLocation", label: "Proposed Inverter Location", kind: "text" },
      { key: "batteryLocation", label: "Proposed Battery Location", kind: "text" },
      { key: "cablePathway", label: "Cable Pathway and Approximate Cable Length", kind: "text", placeholder: "e.g. through roof cavity, ~18 m" },
      { key: "scaffoldRequired", label: "Scaffolding or Elevated Work Platform (EWP) Requirements", kind: "checkbox" },
    ],
  },
  {
    key: "access",
    title: "Site Access & Observations",
    // On every crew form, whatever was picked: the estimator does not choose these.
    fields: [
      { key: "siteAccessConfirmed", label: "Site address and property access confirmed?", kind: "checkbox", standard: true },
      { key: "accessDifficulties", label: "Any access or installation difficulties identified?", kind: "textarea", standard: true },
      { key: "additionalWork", label: "Any additional electrical or building work identified?", kind: "textarea", standard: true },
      { key: "measurements", label: "Measurements and Other Site Observations", kind: "textarea", standard: true },
      { key: "risks", label: "Risks or Special Requirements", kind: "textarea", standard: true },
      {
        key: "unconfirmed",
        label: "Is there anything that cannot be confirmed from photos or mapping?",
        kind: "textarea",
        standard: true,
      },
      { key: "estimationComments", label: "Additional Comments for the Estimation Team", kind: "textarea", standard: true },
    ],
  },
  {
    key: "photos",
    title: "Photos",
    fields: [{ key: "__photos", label: "Additional site photos", kind: "files", hint: "take them with the camera or choose from the phone" }],
  },
  {
    key: "final",
    title: "Final Check",
    fields: [
      { key: "findingsRecorded", label: "All site findings recorded", kind: "checkbox", standard: true },
      { key: "photosUploaded", label: "Photos uploaded", kind: "checkbox", standard: true },
      { key: "measurementsRecorded", label: "Measurements recorded", kind: "checkbox", standard: true },
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

/** Sl. No for each item, in form order, as CL-04 numbers them. */
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
export const isSelectable = (field) =>
  field.kind !== "files" && field.kind !== "auto" && !field.required && !field.standard && !field.key.startsWith("__");

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

/**
 * Everything the requester asked for: the checklist items they ticked, plus
 * any they wrote themselves on the request. Theirs either way — the
 * coordinator adds to this, never quietly drops it.
 *
 * Both halves come off the request, so both depend on the API storing and
 * returning `inspectionChecklist` and `requestedFields`.
 */
export function requesterItems(request) {
  const ticked = inspectionFieldsFor(inspectionChecklistFrom(request));
  const seen = new Set(ticked.map((f) => f.key));
  const own = Array.isArray(request?.requestedFields) ? request.requestedFields : [];
  return [
    ...ticked,
    ...own
      .filter((f) => f?.key && f?.label && !seen.has(f.key))
      .map((f) => ({ key: f.key, label: f.label, kind: f.kind || "text" })),
  ];
}
