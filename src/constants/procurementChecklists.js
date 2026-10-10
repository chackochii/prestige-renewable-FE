// The procurement checklists (stage 6): confirming ordered materials match
// the approved design and arrive ready for installation. Consolidated from
// CL-11 (BOQ vs site requirement), CL-12 (supplier quote), CL-13 (purchase
// order release), CL-14 (material receipt) and CL-10 (job creation in Green
// Deal), which is the module's exit.
//
// Entry: every approval in the approvals checklists is through. Exit: the
// materials are confirmed ready and the Green Deal job is created; the job
// then goes to construction & commissioning.
//
// Owner: the Operations Coordinator, except the three approval decisions the
// Procurement Manager signs (item.owner). Item kinds and the meaning of
// `note`, `onlyIf`, `waitingOn` and a status's `requires` are described in
// constants/approvalChecklists.js; the conditions here are evaluated by
// helpers/procurementChecklist.js. Several purchase-order items restate what
// the supplier-quote table confirmed — they are kept as their own rows and
// shown from those answers rather than re-entered.

export const PROCUREMENT_CHECKLIST_OWNER = "Operations Coordinator";
export const PROCUREMENT_MANAGER = "Procurement Manager";

export const FULFILMENT_OPTIONS = [
  { value: "delivery", label: "Delivery to site" },
  { value: "pickup", label: "Pickup from supplier" },
];

export const PROCUREMENT_CHECKLISTS = [
  {
    key: "boq",
    code: "CL-11",
    title: "BOQ vs Site Requirement",
    tab: "BOQ vs site",
    completeText: "The BOQ is confirmed against the site — quotes can be sought on it.",
    items: [
      { key: "boqMatches", label: "BOQ matches site requirements", kind: "checkbox" },
      { key: "materialsIncluded", label: "Required materials are included", kind: "checkbox" },
      { key: "quantitiesCorrect", label: "Quantities are correct", kind: "checkbox" },
      {
        key: "siteRequirementsIncluded",
        label: "Additional site requirements are included",
        kind: "checkbox",
        note: "Matches PRC-02 — items discovered on site beyond the original quote.",
      },
      {
        key: "changesApproved",
        label: "BOQ changes approved before ordering",
        kind: "checkDetails",
        owner: PROCUREMENT_MANAGER,
        checkLabel: "Changes to the BOQ approved before ordering",
        detailsKey: "changesApprovedDetails",
        detailsLabel: "What changed",
        detailsHint: "write “no changes” if the BOQ stands as proposed",
        detailsRequired: true,
        placeholder: "e.g. Rail 54 → 60 to the site measure — approved 20 Sept",
        note: "Covers scope or quantity changes to the BOQ itself, discovered at this stage.",
      },
    ],
  },
  {
    key: "quote",
    code: "CL-12",
    title: "Supplier Quote",
    tab: "Supplier quote",
    completeText: "The supplier quote is confirmed and on record — the purchase order can be raised on it.",
    items: [
      {
        key: "quoteCurrent",
        label: "Quote confirmed as current",
        kind: "group",
        note: "Upload the quote from the supplier.",
        fields: [
          { key: "quoteCurrentConfirmed", label: "Quote confirmed as current", kind: "checkbox" },
          { key: "quoteFile", label: "Supplier's quote", kind: "files" },
        ],
      },
      {
        key: "supplierApproved",
        label: "Supplier confirmed as approved",
        kind: "checkbox",
        note: "Verifying the supplier's existing approved status, not an approval decision being made now.",
      },
      {
        key: "quoteMatchesBoq",
        label: "Product, model and quantities on the quote confirmed against the approved BOQ",
        kind: "checkbox",
        note: "Reconciles the supplier's quote against the BOQ confirmed in the previous table, not a fresh product decision.",
      },
      {
        key: "quotesCompared",
        label: "Quotes compared across different suppliers",
        kind: "checkDetails",
        checkLabel: "Quotes compared across suppliers",
        detailsKey: "comparedSuppliers",
        detailsLabel: "Suppliers compared",
        detailsRequired: true,
        placeholder: "e.g. Solar Juice, Krannich, Volt Electrical",
      },
      { key: "pricingConfirmed", label: "Pricing and GST confirmed", kind: "checkbox" },
      { key: "stockConfirmed", label: "Stock availability confirmed", kind: "checkbox" },
      {
        key: "fulfilment",
        label: "Delivery or pickup timeframe confirmed",
        kind: "group",
        fields: [
          { key: "fulfilmentMethod", label: "Delivery or pickup", kind: "select", options: FULFILMENT_OPTIONS },
          { key: "fulfilmentDate", label: "Date", kind: "date" },
          { key: "fulfilmentTime", label: "Time", kind: "time" },
        ],
      },
      { key: "freightCharges", label: "Freight or delivery charges confirmed ($)", kind: "number" },
      {
        key: "paymentTerms",
        label: "Payment or credit terms and due date confirmed",
        kind: "group",
        fields: [
          { key: "paymentDueDate", label: "Payment due date", kind: "date" },
          { key: "termsConfirmed", label: "Payment or credit terms confirmed", kind: "checkbox" },
        ],
      },
      { key: "finalQuoteFile", label: "Final supplier quote saved for records", kind: "files" },
    ],
  },
  {
    key: "po",
    code: "CL-13",
    title: "Purchase Order Release",
    tab: "PO release",
    completeText: "The purchase order is released and on record — materials are on their way.",
    conditions: {
      variationNeedsApproval: {
        whenTrue: "only when the quoted cost varies from the proposal",
        whenFalse: "only when there is no price variation",
      },
    },
    items: [
      {
        key: "basisConfirmed",
        label: "Approved BOQ and supplier quote confirmed as the basis for the PO",
        kind: "auto",
        source: "poBasis",
        confirmLabel: "Both are in place for this PO",
        note: "Both were verified in the previous two tables; this confirms they are in place, not re-verifying them from scratch.",
      },
      {
        key: "poAmount",
        label: "PO amount confirmed as matching the approved quote",
        kind: "group",
        fields: [
          { key: "__quotedTotal", label: "Approved quote", kind: "auto", source: "quotedTotal" },
          { key: "poAmountValue", label: "PO amount ($)", kind: "number" },
          { key: "poAmountMatches", label: "Matches the approved quote", kind: "checkbox" },
        ],
      },
      {
        key: "variationChecked",
        label: "If there is price variation, check against the 5% rule",
        kind: "auto",
        source: "variation",
        confirmLabel: "Checked against the 5% rule",
        note: "Calculated from the quoted cost against the accepted proposal.",
      },
      {
        key: "variationApproval",
        label: "Required approval obtained for variations",
        kind: "group",
        onlyIf: "variationNeedsApproval",
        waitingOn: ["variationChecked"],
        notNeeded: "Not needed — the quoted cost matches the proposal.",
        note: "Below 5%: the sales manager approves. 5% or more: the business owner and the sales manager. Taken from the Approvals tab — each approver decides on their own approval request, so it cannot be ticked here.",
        fields: [{ key: "__variationApprovals", label: "Approvals", kind: "auto", source: "variationApprovals" }],
      },
      {
        key: "supplierConfirmed",
        label: "Supplier and product details confirmed",
        kind: "auto",
        source: "suppliers",
        confirmLabel: "Confirmed for the PO",
        note: "Inherited from the approved supplier quote; not re-entered.",
      },
      {
        key: "deliveryConfirmed",
        label: "Stock and delivery details confirmed",
        kind: "auto",
        source: "stockDelivery",
        confirmLabel: "Confirmed for the PO",
        note: "Inherited from the approved supplier quote; not re-entered.",
      },
      {
        key: "termsConfirmed",
        label: "Payment or credit terms confirmed",
        kind: "auto",
        source: "paymentTerms",
        confirmLabel: "Confirmed for the PO",
        note: "Inherited from the approved supplier quote; not re-entered.",
      },
      {
        key: "releaseApproved",
        label: "Approval obtained from the authorised person before release",
        kind: "checkbox",
        owner: PROCUREMENT_MANAGER,
        note: "The standard release sign-off.",
      },
      {
        key: "poReleased",
        label: "PO released to supplier",
        kind: "group",
        action: { icon: "send", label: "Send to supplier", title: "Available once the purchase-order service is connected", note: "Purchase-order service not connected — send the PO and tick it here." },
        fields: [
          { key: "poReleasedConfirmed", label: "PO released to the supplier", kind: "checkbox" },
          { key: "poReleasedOn", label: "Released on", kind: "date", optional: true },
        ],
      },
      { key: "poRecords", label: "PO and approval records saved", kind: "files" },
    ],
  },
  {
    key: "receipt",
    code: "CL-14",
    title: "Material Receipt",
    tab: "Material receipt",
    completeText: "Materials are received and confirmed ready — installation can be booked.",
    conditions: {
      hasDiscrepancy: {
        items: ["discrepancies"],
        whenTrue: "only when something was missing, incorrect or damaged",
        whenFalse: "only when everything arrived as ordered",
      },
    },
    items: [
      { key: "matchesPo", label: "Materials confirmed as matching the purchase order", kind: "checkbox" },
      { key: "specsCorrect", label: "Product model and specifications confirmed as correct", kind: "checkbox" },
      { key: "quantitiesMatch", label: "Quantities confirmed as matching the order", kind: "checkbox" },
      { key: "damageChecked", label: "Materials checked for damage or defects", kind: "checkbox" },
      { key: "allArrived", label: "All ordered items confirmed as arrived", kind: "checkbox" },
      {
        key: "discrepancies",
        label: "Missing, incorrect or damaged items recorded",
        kind: "group",
        note: "Upload photos of damaged or incorrect items.",
        fields: [
          { key: "discrepancyFound", label: "Anything missing, incorrect or damaged?", kind: "yesno" },
          { key: "discrepancyDetails", label: "What was missing, incorrect or damaged", kind: "textarea", onlyIf: "hasDiscrepancy" },
          { key: "discrepancyPhotos", label: "Photos", kind: "files", onlyIf: "hasDiscrepancy", optional: true },
        ],
      },
      {
        key: "supplierNotified",
        label: "Supplier notified of any discrepancy",
        kind: "checkbox",
        onlyIf: "hasDiscrepancy",
        waitingOn: ["discrepancies"],
        notNeeded: "Not needed — everything arrived as ordered.",
      },
      {
        key: "replacementArranged",
        label: "Replacement arranged, if required",
        kind: "checkbox",
        onlyIf: "hasDiscrepancy",
        waitingOn: ["discrepancies"],
        notNeeded: "Not needed — everything arrived as ordered.",
      },
      {
        key: "materialsReady",
        label: "Materials confirmed ready before installation booking",
        kind: "checkbox",
        note: "The gate into construction & commissioning.",
      },
      {
        key: "recordsUpdated",
        label: "Job or stock records updated",
        kind: "checkbox",
        note: "Automatic once the stock service is connected; until then, tick when the records are updated by hand.",
      },
      { key: "receiptFiles", label: "Packing slip or payment / order receipt saved", kind: "files" },
    ],
  },
  {
    key: "jobCreation",
    code: "CL-10",
    title: "Job Creation",
    tab: "Job creation",
    // Opens once the price-variation approval (CL-13) and material receipt (CL-14) are complete.
    afterMaterials: true,
    completeText: "Job created in Green Deal and checked against the signed quote — ready for construction & commissioning.",
    items: [
      {
        key: "greenDealJob",
        label: "Job created in Green Deal",
        kind: "group",
        action: { icon: "leaf", label: "Create in Green Deal", title: "Available once the Green Deal API is connected", note: "Green Deal API not connected — create the job in Green Deal and record it here." },
        note: "Automatic if the Green Deal API supports it; otherwise a manual action. Opens once the price-variation approval (PO release) and material receipt are both complete.",
        fields: [
          { key: "greenDealJobId", label: "Green Deal job ID", kind: "text" },
          { key: "greenDealCreatedOn", label: "Created on", kind: "date", optional: true },
        ],
      },
      {
        key: "syncConfirmed",
        label: "Customer, site and approved system details synced to Green Deal, matching the signed quote and approved scope",
        kind: "auto",
        source: "greenDeal",
        confirmLabel: "These details are in Green Deal",
        note: "Already on the job record from Leads, Estimation, Approvals and Procurement — pushed automatically when the Green Deal API supports it, not re-entered.",
      },
      {
        key: "matchConfirmed",
        label: "Job creation in Green Deal confirmed to match the signed quote and approved scope",
        kind: "checkbox",
        note: "A human check that the sync landed correctly — kept even when the transfer is automatic.",
      },
    ],
  },
];

export const procurementChecklistOf = (key) => PROCUREMENT_CHECKLISTS.find((section) => section.key === key) ?? null;
