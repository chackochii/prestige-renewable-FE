// Cross-department collaboration: the requests and assignments people raise
// from a stage when the next step belongs to another team.
//
// Two kinds, because they behave differently:
//   - information — "Sales, we're missing the client's usage data." Answered
//     once, on a form built from the fields the requester asked for, then
//     accepted or sent back for clarification.
//   - assignment  — "Operations, we need a site visit." Worked over time:
//     scheduled, progressed, completed, reported on.
//
// Statuses are data, not code: the flows below are the defaults the frontend
// understands, and any status the API sends that isn't listed still renders
// (see statusMeta) rather than breaking the screen.

export const REQUEST_KINDS = {
  information: {
    key: "information",
    label: "Information request",
    short: "Request",
    prefix: "REQ",
  },
  assignment: {
    key: "assignment",
    label: "Assignment",
    short: "Assignment",
    prefix: "ASG",
  },
};

/** Departments a request can be sent to. The API may add its own. */
export const DEPARTMENTS = [
  { key: "sales", label: "Sales" },
  { key: "operations", label: "Operations" },
  { key: "procurement", label: "Procurement" },
  { key: "finance", label: "Finance" },
  { key: "admin", label: "Administration" },
];

export function departmentLabel(key) {
  return DEPARTMENTS.find((d) => d.key === key)?.label || key || "—";
}

export const PRIORITIES = [
  { key: "low", label: "Low", tone: "neutral", order: 3 },
  { key: "medium", label: "Medium", tone: "warning", order: 2 },
  { key: "high", label: "High", tone: "danger", order: 1 },
  { key: "urgent", label: "Urgent", tone: "danger", order: 0 },
];

export function priorityMeta(key) {
  return PRIORITIES.find((p) => p.key === key) || PRIORITIES[0];
}

// ---- Statuses --------------------------------------------------------------

/** Information requests: pending → responded → under review → accepted. */
export const INFORMATION_STATUSES = [
  { key: "pending", label: "Pending", tone: "warning", open: true, step: 1 },
  { key: "clarification_required", label: "Clarification required", tone: "danger", open: true, step: 1 },
  { key: "draft_saved", label: "Draft saved", tone: "neutral", open: true, step: 1 },
  { key: "responded", label: "Response received", tone: "info", open: true, step: 2 },
  { key: "under_review", label: "Under review", tone: "info", open: true, step: 3 },
  { key: "accepted", label: "Accepted", tone: "success", open: false, step: 4 },
  { key: "returned", label: "Returned", tone: "danger", open: true, step: 1 },
  { key: "cancelled", label: "Cancelled", tone: "neutral", open: false, step: 0 },
];

/** Operations assignments: requested → … → completed → report submitted. */
export const ASSIGNMENT_STATUSES = [
  { key: "requested", label: "Requested", tone: "warning", open: true, step: 1 },
  { key: "assigned", label: "Assigned", tone: "info", open: true, step: 2 },
  { key: "scheduled", label: "Scheduled", tone: "info", open: true, step: 3 },
  { key: "rescheduled", label: "Rescheduled", tone: "warning", open: true, step: 3 },
  { key: "in_progress", label: "In progress", tone: "info", open: true, step: 4 },
  { key: "completed", label: "Completed", tone: "success", open: true, step: 5 },
  { key: "report_submitted", label: "Report submitted", tone: "success", open: false, step: 6 },
  { key: "review_required", label: "Review required", tone: "danger", open: true, step: 5 },
  { key: "cancelled", label: "Cancelled", tone: "neutral", open: false, step: 0 },
];

export function statusesFor(kind) {
  return kind === "assignment" ? ASSIGNMENT_STATUSES : INFORMATION_STATUSES;
}

/** Never throws on a status the API added — it just shows as-is. */
export function statusMeta(kind, key) {
  const found = statusesFor(kind).find((s) => s.key === key);
  if (found) return found;
  return {
    key: key || "unknown",
    label: String(key || "Unknown").replace(/_/g, " "),
    tone: "neutral",
    open: true,
    step: 0,
  };
}

/** Statuses an assignee may move an assignment to, from where it is now. */
export function nextAssignmentStatuses(current) {
  const flow = ["assigned", "scheduled", "rescheduled", "in_progress", "completed", "report_submitted", "review_required"];
  if (current === "report_submitted" || current === "cancelled") return [];
  return flow.filter((key) => key !== current);
}

// ---- Who may do what -------------------------------------------------------
//
// The API is the authority — these only decide which controls to render, so
// nobody is shown a form they cannot submit. Every rule below must also be
// enforced server-side.

export const isRequester = (request, user) => Boolean(user) && Number(request?.createdById) === Number(user.id);
export const isAssignee = (request, user) => Boolean(user) && Number(request?.assigneeId) === Number(user.id);

/** The assignee answering an information request. */
export function canRespond(request, user) {
  if (request?.kind !== "information" || !isAssignee(request, user)) return false;
  return ["pending", "clarification_required", "returned", "draft_saved"].includes(request.status);
}

/** The requester accepting a response, or sending it back for clarification. */
export function canDecide(request, user) {
  if (request?.kind !== "information" || !isRequester(request, user)) return false;
  return ["responded", "under_review"].includes(request.status);
}

/** The coordinator moving an assignment along. */
export function canProgress(request, user) {
  if (request?.kind !== "assignment" || !isAssignee(request, user)) return false;
  return !["cancelled", "report_submitted"].includes(request.status);
}

/** Only the requester may cancel, and only while it is still open. */
export function canCancel(request, user) {
  return isRequester(request, user) && statusMeta(request?.kind, request?.status).open;
}

/**
 * What the requester is allowed to see back. Progress notes an assignee marked
 * internal stay inside their own department — the frontend filters them so
 * they never reach the screen, and the API must do the same.
 */
export function visibleProgress(request, user) {
  const entries = Array.isArray(request?.progress) ? request.progress : [];
  if (isAssignee(request, user)) return entries;
  return entries.filter((entry) => !entry.internal);
}

/** The one action that makes sense for this person on this request, if any. */
export function contextualAction(request, user) {
  if (!request) return null;
  if (canRespond(request, user)) return { key: "respond", label: "Respond" };
  if (canProgress(request, user)) return { key: "progress", label: "Update progress" };
  if (canDecide(request, user)) {
    return request.kind === "information" ? { key: "review", label: "View response" } : { key: "review", label: "Review" };
  }
  if (request.kind === "assignment") return { key: "view", label: "View visit progress" };
  if (request.department === "procurement") return { key: "view", label: "Review cost changes" };
  return { key: "view", label: "View details" };
}

/** Reference shown to people: the API's own code, or one built from the id. */
export function requestCode(request) {
  if (request?.code) return request.code;
  const prefix = REQUEST_KINDS[request?.kind]?.prefix || "REQ";
  return request?.id ? `${prefix}-${request.id}` : prefix;
}

/**
 * The fields an information request asks for. Sales answers exactly these and
 * nothing else — the response form is built from this list.
 */
export const FIELD_TYPES = [
  { key: "text", label: "Short text" },
  { key: "textarea", label: "Long text" },
  { key: "number", label: "Number" },
  { key: "date", label: "Date" },
];

/** Ready-made field sets for the things estimation asks sales for most. */
export const INFORMATION_TEMPLATES = [
  {
    key: "client_usage",
    label: "Client energy usage",
    title: "Client energy usage and bills",
    fields: [
      { key: "annual_kwh", label: "Annual usage (kWh)", type: "number" },
      { key: "tariff", label: "Current tariff / retailer", type: "text" },
      { key: "bill_period", label: "Bill period covered", type: "text" },
      { key: "notes", label: "Anything else the client said", type: "textarea" },
    ],
  },
  {
    key: "site_details",
    label: "Site details",
    title: "Site details confirmation",
    fields: [
      { key: "roof_type", label: "Roof type", type: "text" },
      { key: "storeys", label: "Single or double storey", type: "text" },
      { key: "phase", label: "Electrical phase", type: "text" },
      { key: "access", label: "Access constraints", type: "textarea" },
    ],
  },
  {
    key: "client_decision",
    label: "Client decision & finance",
    title: "Client decision and finance requirements",
    fields: [
      { key: "timeframe", label: "Preferred installation timeframe", type: "text" },
      { key: "finance", label: "Finance assistance needed", type: "text" },
      { key: "budget", label: "Budget indication", type: "text" },
      { key: "notes", label: "Client comments", type: "textarea" },
    ],
  },
  { key: "custom", label: "Something else", title: "", fields: [] },
];

/**
 * What kind of file an upload slot expects. The requester names the item
 * themselves ("sketch of the switchboard run"), picks one of these, and can
 * add a comment saying what it has to show.
 */
export const DOCUMENT_TYPES = [
  { key: "image", label: "Image / photo" },
  { key: "document", label: "Document" },
];

export function documentTypeLabel(key) {
  return DOCUMENT_TYPES.find((t) => t.key === key)?.label || "File";
}

/**
 * Where a supplied file can be filed on the job itself. The keys are the
 * attachment categories prestige-be already accepts (see leadsApi) — the
 * requester picks one and the file lands in that part of the record.
 */
export const FILING_CATEGORIES = [
  { key: "photo", label: "Site photos" },
  { key: "sketch", label: "Sketches & drawings" },
  { key: "bill", label: "Electricity bills" },
  { key: "client_document", label: "Client documents" },
];

/** The documents a request asked for, normalised. */
export function requestedDocuments(request) {
  return Array.isArray(request?.requestedDocuments) ? request.requestedDocuments : [];
}

/** Files supplied against one requested document. */
export function documentUploads(request, documentKey) {
  const files = request?.response?.attachments || [];
  return files.filter((file) => file.documentKey === documentKey);
}

/** Ready-made assignments for operations. */
export const ASSIGNMENT_TEMPLATES = [
  {
    key: "site_visit",
    label: "Client site visit",
    title: "Client site visit",
    description: "Attend the site, confirm the install conditions and report back with photos.",
  },
  {
    key: "pre_site_inspection",
    label: "Pre-site inspection",
    title: "Pre-site inspection",
    description: "Inspect switchboard, roof structure and access before the estimate is finalised.",
  },
  {
    key: "measure_up",
    label: "Measure up",
    title: "Site measure up",
    description: "Take measurements needed to finalise the layout and the bill of quantities.",
  },
  { key: "custom", label: "Something else", title: "", description: "" },
];
