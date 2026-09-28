// The pre-site inspection report: what the crew member records on site, on
// the second screen of the inspection form.
//
// Every field is optional. An inspection that turns up one thing worth knowing
// is worth recording, and a half-filled report beats a blank one — the crew
// fills in what they found and leaves the rest.
//
// The list is data, not markup: the form renders itself from these sections,
// so adding a question is one line here.

export const FIELD_KINDS = {
  checkbox: "checkbox",
  text: "text",
  number: "number",
  textarea: "textarea",
  files: "files",
  signature: "signature",
  date: "date",
};

export const INSPECTION_SECTIONS = [
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
      { key: "meter", label: "Meter location and meter type", kind: "text" },
      { key: "inverterLocation", label: "Proposed inverter location", kind: "text" },
      { key: "batteryLocation", label: "Proposed battery location", kind: "text" },
      { key: "cablePathway", label: "Cable pathway and approximate cable length", kind: "text" },
      { key: "accessDifficulties", label: "Access or installation difficulties identified", kind: "textarea" },
      { key: "scaffoldRequired", label: "Scaffolding or EWP required", kind: "checkbox" },
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
      { key: "__photos", label: "Additional site photos", kind: "files" },
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
      { key: "estimationNotified", label: "Estimation team notified of any special requirements", kind: "checkbox" },
    ],
  },
  {
    key: "signoff",
    title: "Sign-off",
    fields: [
      { key: "signature", label: "Site crew member signature", kind: "signature" },
      { key: "signedBy", label: "Name", kind: "text", hint: "who signed" },
      { key: "submittedOn", label: "Submission date", kind: "date" },
    ],
  },
];

/** Every field in the report, flattened — handy for reading a saved one back. */
export const INSPECTION_FIELDS = INSPECTION_SECTIONS.flatMap((section) =>
  section.fields.filter((field) => !field.key.startsWith("__")).map((field) => ({ ...field, section: section.title })),
);

/**
 * The items a requester can mark as required. The photo slot is left out: a
 * request asks for photos through its own document slots, which become real
 * upload slots on the site member's form.
 */
export const SELECTABLE_FIELDS = INSPECTION_FIELDS.filter((field) => field.kind !== "files");

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
