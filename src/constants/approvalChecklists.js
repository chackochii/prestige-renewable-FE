// The approvals checklists (stage 5): everything the Operations Coordinator
// works through before procurement can start. Consolidated from CL-07 (DNSP
// application), CL-08 (DA applicability) and CL-09 (finance application).
// Job creation in Green Deal (CL-10) is the last table of the procurement
// checklists — see constants/procurementChecklists.js.
//
// The list is data, not markup: the approvals panel renders every section from
// here (components/ChecklistForm), and helpers/checklist.js decides what "done"
// means for each kind of item. Items are numbered within their section, as the
// checklists number them.
//
// Item kinds:
//   auto         — shown from the job record (source names the rows); the
//                  coordinator ticks that it is right
//   select       — a dropdown (options: [{ value, label, group? }])
//   yesno        — a Yes / No dropdown
//   text, number, date, time, textarea — a single answer
//   checkbox     — a tick
//   checkDetails — a tick, then a text box (detailsRequired: the text is needed too)
//   group        — several answers under one item (fields: [...]); done when every
//                  field not marked optional is answered. `action` adds a
//                  system button the integration will drive one day.
//   documents    — one upload slot per required document (slots: [...])
//   files        — an upload
//   status       — the application tracked through to a decision, with its
//                  records; a status's `requires` says what must be in place
//                  first (items: every earlier item done; fields: these records;
//                  conditions: named conditions with these values)
//
// `note` carries the checklist's comment for the item. `owner` marks an item
// someone other than the section's owner completes. `onlyIf` names a
// condition (section.conditions, evaluated by the stage's helper); when it is
// false the item reads "Not needed" and counts as done, and `waitingOn` says
// which items settle it.

export const CHECKLIST_OWNER = "Operations Coordinator";

/** Distribution networks by state. NSW first — that is where Sydpro installs. */
export const DNSP_NETWORKS = [
  { value: "Ausgrid", label: "Ausgrid", group: "NSW" },
  { value: "Endeavour Energy", label: "Endeavour Energy", group: "NSW" },
  { value: "Essential Energy", label: "Essential Energy", group: "NSW" },
  { value: "Evoenergy", label: "Evoenergy", group: "ACT" },
  { value: "Energex", label: "Energex", group: "QLD" },
  { value: "Ergon Energy", label: "Ergon Energy", group: "QLD" },
  { value: "CitiPower", label: "CitiPower", group: "VIC" },
  { value: "Powercor", label: "Powercor", group: "VIC" },
  { value: "Jemena", label: "Jemena", group: "VIC" },
  { value: "United Energy", label: "United Energy", group: "VIC" },
  { value: "AusNet Services", label: "AusNet Services", group: "VIC" },
  { value: "SA Power Networks", label: "SA Power Networks", group: "SA" },
  { value: "TasNetworks", label: "TasNetworks", group: "TAS" },
  { value: "Western Power", label: "Western Power", group: "WA" },
  { value: "Horizon Power", label: "Horizon Power", group: "WA" },
  { value: "Power and Water", label: "Power and Water", group: "NT" },
];

export const DNSP_APPLICATION_TYPES = [
  { value: "basic_micro", label: "Basic micro-embedded generation (up to 30 kVA)" },
  { value: "negotiated", label: "Negotiated connection (over 30 kVA or non-standard)" },
  { value: "alteration", label: "Connection alteration (adding a battery or expanding a system)" },
  { value: "upgrade", label: "Supply upgrade (e.g. single to three phase)" },
];

export const DWELLING_TYPES = [
  { value: "house", label: "Free-standing house" },
  { value: "townhouse", label: "Townhouse or villa" },
  { value: "semi", label: "Semi-detached or duplex" },
  { value: "apartment", label: "Apartment or unit" },
  { value: "other", label: "Other" },
];

export const OCCUPANCY_STATUSES = [
  { value: "owner_occupier", label: "Owner-occupier" },
  { value: "owner_rented", label: "Owner — rented out" },
  { value: "tenant", label: "Tenant" },
];

export const FINANCE_OPTIONS = [
  { value: "brighte_hes", label: "Brighte Home Energy Saver Loan" },
  { value: "zero_interest", label: "0% Interest Repayment Plan" },
];

/**
 * Where each application can be. `track` is the status the approval track on
 * the overview shows; `requires` is what must be recorded before the status
 * can be chosen: every earlier item done (items), these records filled in
 * (fields), and whether a DA has to be needed or not (conditions).
 */
const DNSP_STATUSES = [
  { value: "not_started", label: "Not started", track: "not_started" },
  { value: "submitted", label: "Submitted — with the DNSP", track: "submitted", requires: { items: true, fields: ["reference", "submittedOn"] } },
  {
    value: "approved",
    label: "Approved",
    track: "approved",
    done: true,
    requires: { items: true, fields: ["reference", "submittedOn", "connectionDocs"] },
  },
  { value: "rejected", label: "Rejected", track: "rejected", requires: { items: true, fields: ["reference", "submittedOn"] } },
];

const DA_STATUSES = [
  { value: "not_started", label: "Not started", track: "not_started" },
  {
    value: "lodged",
    label: "Lodged — with council or certifier",
    track: "submitted",
    requires: { items: true, conditions: { daRequired: true }, fields: ["reference", "submittedOn"] },
  },
  {
    value: "approved",
    label: "Approved — DA satisfied",
    track: "approved",
    done: true,
    requires: { items: true, conditions: { daRequired: true }, fields: ["reference", "submittedOn", "evidence"] },
  },
  {
    value: "exempt",
    label: "Exempt — no DA or consent needed",
    track: "approved",
    done: true,
    requires: { items: true, conditions: { daRequired: false }, fields: ["evidence"] },
  },
  { value: "refused", label: "Refused", track: "rejected", requires: { items: true, conditions: { daRequired: true }, fields: ["reference", "submittedOn"] } },
];

const FINANCE_STATUSES = [
  { value: "not_started", label: "Not started", track: "not_started" },
  { value: "submitted", label: "Submitted — with the lender", track: "submitted", requires: { items: true, fields: ["reference", "submittedOn"] } },
  {
    value: "approved",
    label: "Approved",
    track: "approved",
    done: true,
    requires: { items: true, fields: ["reference", "submittedOn", "customerNotified", "approvalDetails"] },
  },
  { value: "declined", label: "Declined", track: "rejected", requires: { items: true, fields: ["reference", "submittedOn", "customerNotified"] } },
];

export const APPROVAL_CHECKLISTS = [
  {
    key: "dnsp",
    code: "CL-07",
    title: "DNSP Application",
    tab: "DNSP application",
    track: "dnsp",
    items: [
      { key: "network", label: "Correct DNSP or network identified for the installation address", kind: "select", options: DNSP_NETWORKS },
      {
        key: "nmi",
        label: "NMI (National Meter Identifier) recorded",
        kind: "text",
        validate: "nmi",
        placeholder: "e.g. 4103123456",
        note: "New field — not captured earlier in the process.",
      },
      {
        key: "customerConfirmed",
        label: "Customer name, address, phase and existing system details shown correctly",
        kind: "auto",
        source: "customer",
        note: "Auto-filled from the job record.",
      },
      {
        key: "systemConfirmed",
        label: "Proposed system size, inverter and battery details shown correctly",
        kind: "auto",
        source: "system",
        note: "Auto-filled from the approved BOQ.",
      },
      { key: "exportConfirmed", label: "Inverter and battery export requirements confirmed against DNSP limits", kind: "checkbox" },
      {
        key: "application",
        label: "DNSP application type selected and required application information completed",
        kind: "group",
        fields: [
          { key: "applicationType", label: "Application type", kind: "select", options: DNSP_APPLICATION_TYPES },
          { key: "exportLimitKw", label: "Requested export limit (kW)", kind: "number" },
          { key: "applicationInfoComplete", label: "Required application information completed", kind: "checkbox" },
        ],
      },
      {
        key: "documents",
        label: "Required documents attached: design, BOQ and proposal",
        kind: "documents",
        slots: [
          { key: "design", label: "Design" },
          { key: "boq", label: "BOQ" },
          { key: "proposal", label: "Proposal" },
        ],
      },
      {
        key: "status",
        label: "DNSP application submitted and tracked through to approval",
        kind: "status",
        statuses: DNSP_STATUSES,
        records: [
          { key: "reference", label: "Reference number", kind: "text" },
          { key: "submittedOn", label: "Submission date", kind: "date" },
          { key: "decidedOn", label: "Approval date", kind: "date", optional: true },
          { key: "connectionDocs", label: "Final connection documents", kind: "files" },
        ],
      },
    ],
  },
  {
    key: "da",
    code: "CL-08",
    title: "DA Applicability",
    tab: "DA applicability",
    track: "da",
    // Whether a DA or consent is needed at all — settled by items 5 and 6.
    conditions: {
      daRequired: {
        items: ["solarNeedsDa", "batteryNeedsDa"],
        whenTrue: "only when a DA or consent is needed",
        whenFalse: "only when neither the solar nor the battery needs a DA",
      },
    },
    items: [
      { key: "councilConfirmed", label: "Property address and relevant local council confirmed", kind: "auto", source: "council" },
      { key: "heritageChecked", label: "Heritage listing or heritage area status checked", kind: "checkbox" },
      { key: "planningChecked", label: "Council planning controls and property restrictions checked", kind: "checkbox" },
      { key: "constraintsChecked", label: "Bushfire, flood, environmental or other site constraints checked", kind: "checkbox" },
      { key: "solarNeedsDa", label: "Does the solar installation require a DA or development consent?", kind: "yesno" },
      { key: "batteryNeedsDa", label: "Does the battery installation require a DA or development consent?", kind: "yesno" },
      {
        key: "exemptionChecked",
        label: "Applicable exemption, if any, confirmed",
        kind: "checkDetails",
        checkLabel: "Exemptions checked",
        detailsKey: "exemptionDetails",
        detailsLabel: "Exemption that applies",
        detailsHint: "leave blank if none applies",
        placeholder: "e.g. exempt development under the Transport and Infrastructure SEPP",
      },
      {
        key: "approvalPathway",
        label: "Where approval is required, the correct approval pathway identified",
        kind: "text",
        onlyIf: "daRequired",
        waitingOn: ["solarNeedsDa", "batteryNeedsDa"],
        notNeeded: "Not needed — neither the solar nor the battery requires a DA.",
        placeholder: "e.g. Complying development certificate through a private certifier",
      },
      {
        key: "status",
        label: "DA status recorded and confirmed satisfied, with approval or exemption evidence attached, before installation proceeds",
        kind: "status",
        statuses: DA_STATUSES,
        records: [
          { key: "reference", label: "Council or certifier reference", kind: "text", onlyIf: "daRequired" },
          { key: "submittedOn", label: "Lodgement date", kind: "date", onlyIf: "daRequired" },
          { key: "decidedOn", label: "Decision date", kind: "date", optional: true, onlyIf: "daRequired" },
          { key: "evidence", label: "Approval or exemption evidence", kind: "files" },
        ],
      },
    ],
  },
  {
    key: "finance",
    code: "CL-09",
    title: "Finance Application",
    tab: "Finance application",
    track: "finance",
    // Only when the customer is financing the job; the coordinator can switch it on or off.
    optional: true,
    appliesLabel: "The customer is financing this job",
    notApplicableText: "No finance on this job — the customer is paying outright, so there is no finance application to make. Tick above if that changes.",
    items: [
      {
        key: "contactConfirmed",
        label: "Customer full name, email and contact number shown correctly",
        kind: "auto",
        source: "contact",
        note: "Auto-filled from the lead record.",
      },
      {
        key: "dwelling",
        label: "NMI, dwelling type and occupancy status confirmed",
        kind: "group",
        note: "The NMI comes from the DNSP application — only dwelling type and occupancy status are new here.",
        fields: [
          { key: "__nmi", label: "NMI", kind: "auto", source: "nmi" },
          { key: "dwellingType", label: "Dwelling type", kind: "select", options: DWELLING_TYPES },
          { key: "occupancy", label: "Occupancy status", kind: "select", options: OCCUPANCY_STATUSES },
        ],
      },
      {
        key: "brighteChecked",
        label: "Existing or previous Brighte account or loan checked",
        kind: "checkDetails",
        checkLabel: "Checked for an existing or previous Brighte account or loan",
        detailsKey: "brighteDetails",
        detailsLabel: "What was found",
        detailsHint: "leave blank if none",
      },
      {
        key: "proposalConfirmed",
        label: "System details, models and total quoted amount shown correctly",
        kind: "auto",
        source: "proposal",
        note: "Auto-filled from the approved proposal.",
      },
      {
        key: "amounts",
        label: "Deposit amount, finance amount required and finance term confirmed",
        kind: "group",
        fields: [
          { key: "deposit", label: "Deposit ($)", kind: "number" },
          { key: "financeAmount", label: "Finance amount required ($)", kind: "number" },
          { key: "termMonths", label: "Finance term (months)", kind: "number" },
        ],
      },
      { key: "financeOption", label: "Required finance option selected", kind: "select", options: FINANCE_OPTIONS },
      {
        key: "eligibilityConfirmed",
        label: "Customer eligibility and repayment term for the selected option confirmed",
        kind: "checkDetails",
        checkLabel: "Customer is eligible for the selected option",
        detailsKey: "repaymentTerm",
        detailsLabel: "Repayment term",
        detailsRequired: true,
        placeholder: "e.g. 60 months, $96.50 a fortnight",
      },
      {
        key: "status",
        label: "Finance application submitted and tracked through to approval",
        kind: "status",
        note: "Covers submitting the application, notifying the customer and following up.",
        statuses: FINANCE_STATUSES,
        records: [
          { key: "reference", label: "Application reference", kind: "text" },
          { key: "submittedOn", label: "Submission date", kind: "date" },
          { key: "decidedOn", label: "Decision date", kind: "date", optional: true },
          { key: "customerNotified", label: "Customer notified of the outcome", kind: "checkbox" },
          { key: "approvalDetails", label: "Approval details", kind: "textarea", placeholder: "Approved amount, term and any conditions" },
        ],
      },
    ],
  },
];

export const checklistOf = (key) => APPROVAL_CHECKLISTS.find((section) => section.key === key) ?? null;
