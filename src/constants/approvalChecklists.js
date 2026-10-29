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
//   select       — a dropdown (options: [{ value, label, group? }]); an item
//                  with `optionsFrom` gets its options from the API instead
//                  (the stage's wrapper fills them in)
//   yesno        — a Yes / No dropdown
//   text, number, date, time, textarea — a single answer
//   checkbox     — a tick
//   checkDetails — a tick, then a text box (detailsRequired: the text is needed too)
//   group        — several answers under one item (fields: [...]); done when every
//                  field not marked optional is answered. `action` adds a
//                  system button the integration will drive one day.
//   documents    — one upload slot per required document (slots: [...])
//   files        — an upload
//   status       — the application tracked through to a decision: the status
//                  first, then only the records it needs (a status's `fields`),
//                  with the ones in its `required` needed before it can be saved
//   multi        — several choices as chips (`exclusive`: the one that clears the rest)
//
// A field's `showIf: { key, in }` shows it only while another answer is one of
// those values; a date's `noFuture` / `notBefore` keep it out of the future and
// no earlier than another date answer. `hideUnlessApplies` hides an `onlyIf`
// item (and leaves it out of the count) until it applies.
//
// `note` carries the checklist's comment for the item. `owner` marks an item
// someone other than the section's owner completes. `onlyIf` names a
// condition (section.conditions, evaluated by the stage's helper); when it is
// false the item reads "Not needed" and counts as done, and `waitingOn` says
// which items settle it.

export const CHECKLIST_OWNER = "Operations Coordinator";

export const DNSP_APPLICATION_TYPES = [
  { value: "basic_micro", label: "Basic micro-embedded generation (up to 30 kVA)" },
  { value: "negotiated", label: "Negotiated connection (over 30 kVA or non-standard)" },
  { value: "alteration", label: "Connection alteration (adding a battery or expanding a system)" },
  { value: "upgrade", label: "Supply upgrade (e.g. single to three phase)" },
];

/** Property Type (was Dwelling Type - a commercial site is not a dwelling). */
export const PROPERTY_TYPES = [
  { value: "house", label: "House" },
  { value: "townhouse", label: "Townhouse" },
  { value: "unit", label: "Unit" },
  { value: "commercial", label: "Commercial (e.g. motel, shop, office, warehouse)" },
  { value: "other", label: "Other" },
];

export const RESIDENTIAL_OCCUPANCY = [
  { value: "owner_occupier", label: "Owner Occupier" },
  { value: "owner_rented", label: "Owner - Rented Out" },
  { value: "tenant", label: "Tenant" },
];

export const COMMERCIAL_OCCUPANCY = [
  { value: "owner_operated", label: "Owner-Operated" },
  { value: "owner_leased", label: "Owner - Leased to Business" },
  { value: "business_tenant", label: "Business Tenant (Leases the Premises)" },
];

export const APPLICANT_ROLES = [
  { value: "owner", label: "Owner" },
  { value: "director", label: "Director" },
  { value: "signatory", label: "Authorised Signatory" },
];

export const FINANCE_PROVIDERS = [
  { value: "brighte", label: "Brighte" },
  { value: "other", label: "Other" },
];

/**
 * Finance products by provider. `covers` - the property types a product can
 * finance; the Brighte home products are residential only until the provider
 * confirms which cover commercial installs. `terms` - the terms (months) it
 * offers.
 */
export const FINANCE_OPTIONS = [
  { value: "brighte_hes", label: "Brighte Home Energy Saver Loan", provider: "brighte", covers: ["house", "townhouse", "unit", "other"], terms: [12, 24, 36, 48, 60, 84] },
  { value: "zero_interest", label: "0% Interest Repayment Plan", provider: "brighte", covers: ["house", "townhouse", "unit", "other"], terms: [12, 24, 36, 48, 60] },
  { value: "other", label: "Other", provider: "any", covers: null, terms: [12, 24, 36, 48, 60, 72, 84, 120] },
];

export const REPAYMENT_FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "fortnightly", label: "Fortnightly" },
  { value: "monthly", label: "Monthly" },
];

const isCommercial = (answers) => answers.propertyType === "commercial";

/** The products the chosen provider offers for the chosen property type ("Other" always). */
export const financeProductsFor = (answers) =>
  FINANCE_OPTIONS.filter(
    (option) =>
      (option.provider === "any" || option.provider === answers.financeProvider) &&
      (!option.covers || !answers.propertyType || option.covers.includes(answers.propertyType)),
  );

const termsFor = (answers) =>
  (FINANCE_OPTIONS.find((option) => option.value === answers.financeOption)?.terms ?? FINANCE_OPTIONS.at(-1).terms).map((months) => ({ value: String(months), label: `${months} months` }));

/**
 * Where each application can be. `track` is the status the approval card on
 * the overview shows; `fields` are the records the status shows (in the
 * item's `records` order) and `required` the ones it cannot be saved without;
 * `done` marks a status that finishes the application.
 */
// Failed after the fact (UAT exit logic, Oct 2026): blocks the exit like a rejection and, once
// the job has moved on, flags Approval Review Needed.
const LAPSED_STATUSES = [
  { value: "revoked", label: "Revoked", track: "rejected", fields: ["decidedOn", "lapseReason"], required: ["decidedOn", "lapseReason"] },
  // A reason is needed for Revoked; Expired speaks for itself (NF-10/11).
  { value: "expired", label: "Expired", track: "rejected", fields: ["decidedOn", "lapseReason"], required: ["decidedOn"] },
];
const LAPSE_RECORD = { key: "lapseReason", label: "Reason", kind: "textarea", placeholder: "Why it was revoked, or what has expired" };
const LAPSE_DATES = { revoked: "Revoked Date", expired: "Expiry Date" };
// When the approval stops being valid (TR-03): warned about before, and an
// approval past it is set to Expired while procurement has not started.
const EXPIRY_RECORD = { key: "expiresOn", label: "Valid Until", kind: "date", notBefore: "decidedOn", notBeforeLabel: "decision date", hint: "optional - if the approval has an expiry date" };

const DNSP_STATUSES = [
  { value: "not_started", label: "Not Started", track: "not_started" },
  { value: "submitted", label: "Submitted", track: "submitted", fields: ["reference", "submittedOn"], required: ["reference", "submittedOn"] },
  {
    value: "info_requested",
    label: "Further Information Requested",
    track: "submitted",
    fields: ["reference", "submittedOn", "infoRequested"],
    required: ["infoRequested"],
  },
  {
    value: "approved",
    label: "Approved",
    track: "approved",
    done: true,
    fields: ["reference", "submittedOn", "decidedOn", "expiresOn", "connectionDocs"],
    required: ["decidedOn", "connectionDocs"],
  },
  {
    value: "approved_conditions",
    label: "Approved with Conditions",
    track: "approved",
    done: true,
    fields: ["reference", "submittedOn", "decidedOn", "expiresOn", "connectionDocs", "conditions", "limitDiffers", "approvedExportKw"],
    required: ["decidedOn", "connectionDocs", "conditions", "approvedExportKw"],
  },
  {
    value: "rejected",
    label: "Rejected",
    track: "rejected",
    fields: ["reference", "decidedOn", "rejectionReason"],
    required: ["reference", "decidedOn", "rejectionReason"],
  },
  { value: "not_applicable", label: "Not Applicable", track: "not_applicable", done: true, fields: ["naReason"], required: ["naReason"] },
  ...LAPSED_STATUSES,
];

const DA_STATUSES = [
  { value: "not_started", label: "Not Started", track: "not_started" },
  { value: "lodged", label: "Lodged", track: "submitted", fields: ["reference", "submittedOn"], required: ["reference", "submittedOn"] },
  {
    value: "approved",
    label: "Approved",
    track: "approved",
    done: true,
    fields: ["reference", "submittedOn", "decidedOn", "expiresOn", "evidence"],
    required: ["reference", "submittedOn", "decidedOn", "evidence"],
  },
  {
    value: "refused",
    label: "Rejected",
    track: "rejected",
    fields: ["reference", "decidedOn", "rejectionReason"],
    required: ["reference", "decidedOn", "rejectionReason"],
  },
  { value: "exempt", label: "Exempt", track: "approved", done: true, fields: ["exemptionDetails", "evidence"], required: ["evidence"] },
  { value: "not_applicable", label: "Not Applicable", track: "not_applicable", done: true, fields: ["naReason"], required: ["naReason"] },
  ...LAPSED_STATUSES,
];

// Finance (UAT redesign, Oct 2026): the approval is captured as the amount
// approved and its conditions, not a free-text note, so it can be checked
// against the quote.
// Section 3 (UAT redesign, Oct 2026). Lodging needs Sections 1 and 2 done
// (`requiresItems`); the customer notified date replaces the old tick.
const FINANCE_SECTIONS = ["detailsConfirmed", "financeDetails"];
const FINANCE_LODGED = ["reference", "submittedOn"];
// shortfallNote only shows (and is only needed) when less was approved than is financed.
const FINANCE_APPROVED = [...FINANCE_LODGED, "decidedOn", "approvedAmount", "shortfallNote", "evidence", "notifiedOn"];

/** The statuses that mean the application has gone to the lender. */
export const FINANCE_LODGED_STATUSES = ["submitted", "info_requested", "approved", "approved_conditions"];

/** Less was approved than the job needs financed. */
export const financeShortfall = (answers) =>
  answers.approvedAmount !== undefined && answers.approvedAmount !== "" && answers.financeAmount !== undefined && answers.financeAmount !== "" &&
  Number(answers.approvedAmount) < Number(answers.financeAmount);
const FINANCE_STATUSES = [
  { value: "not_started", label: "Not Started", track: "not_started" },
  { value: "submitted", label: "Submitted", track: "submitted", fields: FINANCE_LODGED, required: FINANCE_LODGED, requiresItems: FINANCE_SECTIONS },
  {
    value: "info_requested",
    label: "Further Information Requested",
    track: "submitted",
    fields: [...FINANCE_LODGED, "infoRequested"],
    required: ["infoRequested"],
    requiresItems: FINANCE_SECTIONS,
  },
  {
    value: "approved",
    label: "Approved",
    track: "approved",
    done: true,
    fields: [...FINANCE_APPROVED, "expiresOn"],
    required: FINANCE_APPROVED,
    requiresItems: FINANCE_SECTIONS,
    // Optional until the finance is approved.
    requiredAnswers: [{ key: "repaymentAmount", label: "repayment amount ($) in Finance Details" }],
  },
  {
    value: "approved_conditions",
    label: "Approved with Conditions",
    track: "approved",
    done: true,
    fields: [...FINANCE_APPROVED, "expiresOn", "conditions"],
    required: [...FINANCE_APPROVED, "conditions"],
    requiresItems: FINANCE_SECTIONS,
    requiredAnswers: [{ key: "repaymentAmount", label: "repayment amount ($) in Finance Details" }],
  },
  {
    value: "declined",
    label: "Declined",
    track: "rejected",
    fields: ["reference", "decidedOn", "declineReason", "notifiedOn"],
    required: ["reference", "decidedOn", "declineReason", "notifiedOn"],
  },
  // The customer no longer needs finance (paying upfront, say): nothing to wait on.
  {
    value: "withdrawn",
    label: "Withdrawn",
    track: "not_applicable",
    done: true,
    fields: ["withdrawnReason"],
    required: ["withdrawnReason"],
    // The customer is not financing any more, so the payment method has to say so first.
    check: (answers, ctx) => (ctx.paysByFinance ? "Change the payment method from finance first to mark this as Withdrawn." : null),
  },
  { value: "not_applicable", label: "Not Applicable", track: "not_applicable", done: true, fields: ["naReason"], required: ["naReason"] },
  ...LAPSED_STATUSES,
];

const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

export const APPROVAL_CHECKLISTS = [
  {
    key: "dnsp",
    code: "CL-07",
    title: "Network Connection Approval (DNSP)",
    tab: "Network Connection Approval (DNSP)",
    track: "dnsp",
    items: [
      {
        key: "network",
        label: "DNSP/Network",
        kind: "select",
        options: [],
        optionsFrom: "dnspNetworks", // maintained under Superadmin → DNSP networks
      },
      {
        key: "nmi",
        label: "NMI (National Meter Identifier)",
        kind: "text",
        validate: "nmi",
        placeholder: "e.g. 4103123456",
      },
      { key: "customerConfirmed", label: "Customer Details", kind: "auto", source: "customer", confirmLabel: "Customer Details Verified" },
      { key: "systemConfirmed", label: "Proposed Job Details", kind: "auto", source: "system", confirmLabel: "Job Details Verified" },
      { key: "exportConfirmed", label: "Inverter and battery export confirmed within DNSP limit", kind: "checkbox" },
      {
        key: "application",
        label: "Application Type",
        kind: "group",
        fields: [
          { key: "applicationType", label: "Application type", kind: "select", options: DNSP_APPLICATION_TYPES },
          { key: "exportLimitKw", label: "Requested export limit (kW)", kind: "number" },
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
        label: "Application Details",
        statusLabel: "Application Status",
        kind: "status",
        statuses: DNSP_STATUSES,
        records: [
          { key: "reference", label: "Application Reference Number", kind: "text" },
          { key: "submittedOn", label: "Submission Date", kind: "date", noFuture: true },
          { key: "infoRequested", label: "Information Requested", kind: "textarea", placeholder: "What the DNSP has asked for" },
          { key: "decidedOn", label: "Approval Date", labels: { rejected: "Decision Date", ...LAPSE_DATES }, kind: "date", noFuture: true, notBefore: "submittedOn" },
          EXPIRY_RECORD,
          { key: "connectionDocs", label: "Approval and Connection Documents", kind: "files" },
          { key: "conditions", label: "Conditions", kind: "textarea", placeholder: "The conditions on the approval" },
          { key: "limitDiffers", label: "Approved Limit Differs?", kind: "select", options: YES_NO },
          { key: "approvedExportKw", label: "Approved Export Limit (kW)", kind: "number", showIf: { key: "limitDiffers", in: ["yes"] } },
          { key: "rejectionReason", label: "Rejection Reason", kind: "textarea" },
          { key: "naReason", label: "Reason", kind: "textarea", placeholder: "Why no network approval is needed" },
          LAPSE_RECORD,
        ],
      },
    ],
  },
  {
    key: "da",
    code: "CL-08",
    title: "Council Approval (DA)",
    tab: "Council Approval (DA)",
    track: "da",
    // Whether a DA or consent is needed at all - settled by the solar and battery questions.
    conditions: {
      daRequired: {
        items: ["solarNeedsDa", "batteryNeedsDa"],
        whenTrue: "only when a DA or consent is needed",
        whenFalse: "only when neither the solar nor the battery needs a DA",
      },
    },
    items: [
      {
        key: "property",
        label: "Property Details",
        kind: "group",
        fields: [
          { key: "__address", label: "Property address", kind: "auto", source: "council" },
          { key: "council", label: "Local Council", kind: "text", hint: "Confirm from the address", placeholder: "e.g. Lane Cove Council" },
          {
            key: "strataScheme",
            label: "In a Strata Scheme?",
            kind: "select",
            options: YES_NO,
            flags: [{ when: { key: "strataScheme", in: ["yes"] }, text: "The property is in a strata scheme, so Strata Approval is required (added to the job automatically).", approval: "strata" }],
          },
          { key: "councilConfirmed", label: "Details Confirmed", kind: "checkbox" },
        ],
      },
      {
        key: "heritage",
        label: "Heritage Listing or Heritage Area",
        kind: "select",
        options: [
          { value: "not_listed", label: "Not Listed" },
          { value: "heritage_item", label: "Heritage Item" },
          { value: "conservation_area", label: "Heritage Conservation Area" },
        ],
        // Heritage Approval follows this answer: needed when listed, not applicable when not.
        flags: [
          {
            when: { key: "heritage", in: ["heritage_item", "conservation_area"] },
            text: "The property is heritage listed, so Heritage Approval is required.",
            approval: "heritage",
          },
        ],
      },
      {
        key: "planningControls",
        label: "Council Planning Controls and Restrictions",
        kind: "group",
        fields: [
          {
            key: "planning",
            label: "Restrictions",
            kind: "select",
            options: [
              { value: "none", label: "No Restrictions" },
              { value: "restrictions", label: "Restrictions Apply" },
            ],
          },
          { key: "planningNotes", label: "Notes", kind: "textarea", placeholder: "The restrictions that apply", showIf: { key: "planning", in: ["restrictions"] } },
        ],
      },
      {
        key: "siteConstraints",
        label: "Bushfire, Flood and Environmental Constraints",
        kind: "group",
        fields: [
          {
            key: "constraints",
            label: "Constraints",
            kind: "multi",
            exclusive: "none",
            options: [
              { value: "none", label: "None" },
              { value: "bushfire", label: "Bushfire Prone" },
              { value: "flood", label: "Flood Zone" },
              { value: "environmental", label: "Environmental" },
              { value: "other", label: "Other" },
            ],
          },
          {
            key: "constraintNotes",
            label: "Notes",
            kind: "textarea",
            optional: true,
            showIf: { key: "constraints", in: ["bushfire", "flood", "environmental", "other"] },
          },
        ],
      },
      {
        key: "exemption",
        label: "Exemption Applies",
        kind: "group",
        fields: [
          { key: "exemptionApplies", label: "Exemption Applies", kind: "select", options: YES_NO },
          {
            key: "exemptionDetails",
            label: "Exemption Details",
            kind: "text",
            span: true,
            placeholder: "Exempt development under SEPP (Transport and Infrastructure) 2021",
            showIf: { key: "exemptionApplies", in: ["yes"] },
          },
        ],
      },
      { key: "solarNeedsDa", label: "DA Required for Solar?", kind: "select", options: YES_NO },
      {
        key: "batteryNeedsDa",
        label: "DA Required for Battery?",
        kind: "select",
        options: [...YES_NO, { value: "na", label: "Not Applicable (No Battery)" }],
      },
      {
        key: "pathway",
        label: "Approval Pathway",
        kind: "group",
        onlyIf: "daRequired",
        hideUnlessApplies: true,
        fields: [
          {
            key: "pathwayType",
            label: "Approval Pathway",
            kind: "select",
            options: [
              { value: "cdc", label: "Complying Development Certificate (CDC)" },
              { value: "da", label: "Development Application (DA)" },
              { value: "other", label: "Other" },
            ],
          },
          { key: "pathwayNotes", label: "Pathway Notes", kind: "text", optional: true, placeholder: "CDC through private certifier" },
        ],
      },
      {
        key: "status",
        label: "DA Status",
        kind: "status",
        helper: "DA status must be Approved or Exempt, with evidence attached, before the job can move on.",
        statuses: DA_STATUSES,
        records: [
          { key: "reference", label: "Council or Certifier Reference", kind: "text" },
          { key: "submittedOn", label: "Lodgement Date", kind: "date", noFuture: true },
          { key: "decidedOn", label: "Decision Date", labels: LAPSE_DATES, kind: "date", noFuture: true, notBefore: "submittedOn", notBeforeLabel: "lodgement date" },
          EXPIRY_RECORD,
          { key: "exemptionDetails", label: "Exemption Details", kind: "text", readOnly: true, hint: "from Exemption Applies", required: false },
          { key: "evidence", label: "Approval or Exemption Evidence", kind: "files" },
          { key: "rejectionReason", label: "Reason", kind: "textarea", placeholder: "Why the application was refused" },
          { key: "naReason", label: "Reason", kind: "textarea", placeholder: "Why no council approval is involved" },
          LAPSE_RECORD,
        ],
      },
    ],
  },
  {
    key: "finance",
    code: "CL-09",
    title: "Finance Approval",
    tab: "Finance Approval",
    track: "finance",
    // Only when the customer is financing the job; the coordinator can switch it on or off.
    optional: true,
    appliesLabel: "The customer is financing this job",
    notApplicableText: "No finance on this job - the customer is paying outright, so there is no finance application to make. Tick above if that changes.",
    items: [
      {
        // Section 1: what the job record already holds, confirmed once. A gap
        // is fixed at its source (Estimation), not here.
        key: "detailsConfirmed",
        label: "Customer and System Summary",
        tag: "From job record",
        kind: "auto",
        source: "financeSummary",
        confirmLabel: "Details Confirmed",
        blockWhenMissing: true,
      },
      {
        // Section 2.
        key: "financeDetails",
        label: "Finance Details",
        kind: "group",
        fields: [
          { key: "propertyType", label: "Property Type", kind: "select", options: PROPERTY_TYPES },
          {
            key: "occupancy",
            label: "Occupancy Status",
            kind: "select",
            optionsFor: (answers) => (isCommercial(answers) ? COMMERCIAL_OCCUPANCY : RESIDENTIAL_OCCUPANCY),
            flags: [
              {
                when: { key: "occupancy", in: ["tenant", "business_tenant"] },
                text: "The customer is a tenant, so Landlord Consent is required (added to the job automatically).",
                approval: "landlord",
              },
            ],
          },
          {
            key: "strataScheme",
            label: "In a Strata Scheme?",
            kind: "select",
            options: YES_NO,
            flags: [{ when: { key: "strataScheme", in: ["yes"] }, text: "The property is in a strata scheme, so Strata Approval is required (added to the job automatically).", approval: "strata" }],
          },
          { key: "businessName", label: "Business Name", kind: "text", showIf: { key: "propertyType", in: ["commercial"] } },
          {
            key: "abn",
            label: "ABN",
            kind: "text",
            validate: "abn",
            invalidText: "An ABN is 11 digits.",
            placeholder: "11 digits",
            showIf: { key: "propertyType", in: ["commercial"] },
          },
          { key: "applicantRole", label: "Applicant Role", kind: "select", options: APPLICANT_ROLES, showIf: { key: "propertyType", in: ["commercial"] } },
          { key: "financeProvider", label: "Finance Provider", kind: "select", options: FINANCE_PROVIDERS },
          { key: "financeProviderOther", label: "Provider Details", kind: "text", placeholder: "Name of the finance provider", showIf: { key: "financeProvider", in: ["other"] } },
          { key: "financeOption", label: "Finance Product", kind: "select", optionsFor: financeProductsFor },
          { key: "financeOptionOther", label: "Product Details", kind: "text", placeholder: "The finance product", showIf: { key: "financeOption", in: ["other"] } },
          { key: "brighteExisting", label: "Existing Account or Loan with Provider", kind: "select", options: YES_NO },
          { key: "brighteNotes", label: "Notes", kind: "textarea", placeholder: "The existing account or loan", showIf: { key: "brighteExisting", in: ["yes"] } },
          { key: "deposit", label: "Deposit ($)", kind: "number" },
          // Worked out: the quote total less the deposit (ApprovalChecklist fills it in).
          { key: "financeAmount", label: "Finance Amount ($)", kind: "number", readOnly: true, hint: "quote total less the deposit" },
          { key: "termMonths", label: "Finance Term", kind: "select", optionsFor: termsFor },
          { key: "repaymentAmount", label: "Repayment Amount ($)", kind: "number", optional: true, hint: "optional until approved" },
          { key: "repaymentFrequency", label: "Repayment Frequency", kind: "select", options: REPAYMENT_FREQUENCIES, optional: true, requiredWith: "repaymentAmount" },
        ],
      },
      {
        key: "status",
        label: "Application Status",
        statusLabel: "Status",
        kind: "status",
        statuses: FINANCE_STATUSES,
        warnings: [
          {
            when: financeShortfall,
            text: "The approved amount is less than the finance amount. Note how the difference is covered (e.g. a larger deposit).",
          },
          {
            when: (answers, ctx) => Boolean(ctx.financeNeedsReview?.(answers)),
            text: "Needs Review: the quote total has changed since this application was submitted, so the approved amount may no longer match.",
          },
        ],
        records: [
          { key: "reference", label: "Application Reference", kind: "text" },
          { key: "submittedOn", label: "Submission Date", kind: "date", noFuture: true },
          { key: "infoRequested", label: "Information Requested", kind: "textarea", placeholder: "What the lender has asked for" },
          { key: "decidedOn", label: "Decision Date", labels: LAPSE_DATES, kind: "date", noFuture: true, notBefore: "submittedOn" },
          { key: "approvedAmount", label: "Approved Amount ($)", kind: "number" },
          { ...EXPIRY_RECORD, hint: "optional - finance approvals are often valid for 90 days" },
          {
            key: "shortfallNote",
            label: "Shortfall Note",
            hint: "how the difference is covered",
            kind: "textarea",
            placeholder: "e.g. A larger deposit",
            showWhen: financeShortfall,
          },
          { key: "evidence", label: "Approval Evidence", kind: "files" },
          { key: "conditions", label: "Conditions", kind: "textarea", placeholder: "The conditions on the approval" },
          { key: "declineReason", label: "Decline Reason", kind: "textarea" },
          {
            key: "notifiedOn",
            label: "Customer Notified Date",
            kind: "date",
            noFuture: true,
            notBefore: "decidedOn",
            notBeforeLabel: "decision date",
          },
          { key: "withdrawnReason", label: "Reason", kind: "textarea", placeholder: "e.g. Customer chose to pay upfront" },
          { key: "naReason", label: "Reason", kind: "textarea", placeholder: "Why no finance approval is needed" },
          LAPSE_RECORD,
        ],
      },
    ],
  },
];

export const checklistOf = (key) => APPROVAL_CHECKLISTS.find((section) => section.key === key) ?? null;
