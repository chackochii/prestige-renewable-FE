// Cross-department collaboration: the requests and assignments people raise
// from a stage when the next step belongs to another team.
//
// Two kinds, because they behave differently:
//   - information — "Sales, we're missing the client's usage data." Answered
//     once, on a form built from the fields the requester asked for, then
//     accepted or sent back for clarification.
//   - assignment  — "Operations, we need a site visit." Worked over time:
//     scheduled, progressed, completed, reported on.
//   - approval    — "Sales manager, approve this price variation." Raised from
//     the procurement approvals tab; the assignee approves or rejects it with
//     a note, and the decision lands on the job's approval.
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
  approval: {
    key: "approval",
    label: "Approval request",
    short: "Approval",
    prefix: "APR",
  },
};

/**
 * Which department an approval request for a price-variation approver goes
 * to (prestige-be collaborationRequest.js APPROVAL_ROLE_BY_DEPARTMENT).
 */
export const APPROVAL_DEPARTMENT_FOR_ROLE = { SMM: "sales", BO: "admin" };

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

/**
 * Which roles make a person part of a department. The API's people directory
 * stamps `departments` on every user from the same table (prestige-be
 * collaborationRequest.js DEPARTMENT_ROLES), and that is what counts; this
 * copy only stands in when a user arrives without it. Keep the two in step.
 */
const DEPARTMENT_ROLE_HINTS = {
  sales: ["SMM", "SREP"],
  operations: ["BOM", "OPC", "SITEOM", "CREW", "QSM", "OMM"],
  procurement: ["PROC"],
  finance: ["FIN"],
  admin: ["BO", "SYS", "HRM", "ADM"],
};

/** Whether a directory user belongs to a department. */
export function inDepartment(user, department) {
  if (!department) return true;
  if (Array.isArray(user?.departments)) return user.departments.includes(department);
  const roles = Array.isArray(user?.roles) ? user.roles : [];
  return (DEPARTMENT_ROLE_HINTS[department] || []).some((code) => roles.includes(code));
}

/**
 * The people a request to `department` can go to. When nobody in the unit
 * belongs to it, everyone is offered rather than an empty list — a unit with
 * no one in finance yet still has to send its finance request somewhere — and
 * `exact` says which happened, so the form can say so.
 */
export function peopleInDepartment(users = [], department) {
  const matched = users.filter((u) => inDepartment(u, department));
  return matched.length ? { people: matched, exact: true } : { people: users, exact: false };
}

/**
 * A request's priority says whether the thing has to happen, not how urgent
 * it is: the team receiving it schedules off necessity. One scale for every
 * kind of request, so a list of them sorts and reads as one list.
 */
export const PRIORITIES = [
  { key: "required", label: "Required", tone: "danger", order: 0 },
  { key: "not_required", label: "Not required", tone: "neutral", order: 3 },
  { key: "preferred", label: "Preferred", tone: "warning", order: 1 },
];

/**
 * The urgency scale this field used to carry. Requests raised before the
 * change still hold these, so they are recognised for display and sorting —
 * they are just no longer offered when raising anything new.
 */
const LEGACY_PRIORITIES = [
  { key: "low", label: "Low", tone: "neutral", order: 3 },
  { key: "medium", label: "Medium", tone: "warning", order: 2 },
  { key: "high", label: "High", tone: "danger", order: 1 },
  { key: "urgent", label: "Urgent", tone: "danger", order: 0 },
];

/** Never throws on a priority the API added, or one from the old scale. */
export function priorityMeta(key) {
  const found = PRIORITIES.find((p) => p.key === key) || LEGACY_PRIORITIES.find((p) => p.key === key);
  if (found) return found;
  return {
    key: key || "required",
    label: String(key || "Required").replace(/_/g, " "),
    tone: "neutral",
    order: 2,
  };
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
  // Still open: the findings are in, but the person who asked for the visit
  // has yet to approve them.
  { key: "report_submitted", label: "Report submitted", tone: "success", open: true, step: 6 },
  { key: "accepted", label: "Findings approved", tone: "success", open: false, step: 7 },
  { key: "returned", label: "Sent back", tone: "danger", open: true, step: 4 },
  { key: "review_required", label: "Review required", tone: "danger", open: true, step: 5 },
  { key: "cancelled", label: "Cancelled", tone: "neutral", open: false, step: 0 },
];

/** Approval requests: pending → approved or rejected. */
export const APPROVAL_STATUSES = [
  { key: "pending", label: "Awaiting approval", tone: "warning", open: true, step: 1 },
  { key: "approved", label: "Approved", tone: "success", open: false, step: 2 },
  { key: "rejected", label: "Rejected", tone: "danger", open: false, step: 2 },
  { key: "cancelled", label: "Cancelled", tone: "neutral", open: false, step: 0 },
];

export function statusesFor(kind) {
  return kind === "assignment" ? ASSIGNMENT_STATUSES : kind === "approval" ? APPROVAL_STATUSES : INFORMATION_STATUSES;
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
  if (["report_submitted", "accepted", "cancelled"].includes(current)) return [];
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

/**
 * The requester deciding on what came back: accepting a response or sending it
 * back for clarification, and — once a site visit has brought its findings in —
 * approving those findings or rejecting them for another look.
 */
export function canDecide(request, user) {
  if (!isRequester(request, user)) return false;
  if (request.kind === "assignment") {
    return inspectionDelivered(request) && !["accepted", "cancelled"].includes(request.status);
  }
  if (request.kind !== "information") return false;
  return ["responded", "under_review"].includes(request.status);
}

/** The person asked approving or rejecting an approval request. */
export function canApprove(request, user) {
  return request?.kind === "approval" && isAssignee(request, user) && request.status === "pending";
}

/** The approval requests on a job for one approver role, newest first. */
export function approvalRequestsFor(requests = [], role) {
  const department = APPROVAL_DEPARTMENT_FOR_ROLE[role];
  return requests
    .filter((r) => r.kind === "approval" && r.department === department && r.status !== "cancelled")
    .slice()
    .sort((a, b) => Number(b.id) - Number(a.id));
}

/** The coordinator moving an assignment along. */
export function canProgress(request, user) {
  if (request?.kind !== "assignment" || !isAssignee(request, user)) return false;
  return !["cancelled", "report_submitted", "accepted"].includes(request.status);
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
  if (canApprove(request, user)) return { key: "approve", label: "Approve or reject" };
  if (canProgress(request, user)) return { key: "progress", label: "Update progress" };
  if (canDecide(request, user)) {
    return request.kind === "information"
      ? { key: "review", label: "View response" }
      : { key: "review", label: "Review findings" };
  }
  if (request.kind === "assignment") return { key: "view", label: "View visit progress" };
  if (request.department === "procurement") return { key: "view", label: "Review cost changes" };
  return { key: "view", label: "View details" };
}

/**
 * The site-visit form a coordinator hands out. It is the assignment's own
 * to-do: pending from the moment the link is created until the person
 * attending submits the form, whatever the assignment's status says.
 */
export const SITE_VISIT_STATUSES = [
  { key: "pending", label: "Pending — form not submitted", tone: "warning", open: true },
  { key: "submitted", label: "Form submitted", tone: "success", open: false },
];

/** The task on a request, or null when no link has been created yet. */
export function siteVisitTask(request) {
  return request?.siteVisit && typeof request.siteVisit === "object" ? request.siteVisit : null;
}

/** Submitted only once the form actually came back; pending until then. */
export function siteVisitStatusMeta(task) {
  const key = task?.submittedAt || task?.status === "submitted" ? "submitted" : "pending";
  return SITE_VISIT_STATUSES.find((s) => s.key === key) || SITE_VISIT_STATUSES[0];
}

/**
 * The visit has brought something back: the person attending submitted the
 * form, or operations marked the assignment done. That is the point at which
 * the estimator who asked for it has findings to approve or reject.
 */
export function inspectionDelivered(request) {
  if (request?.kind !== "assignment") return false;
  const task = siteVisitTask(request);
  if (task?.submittedAt || task?.status === "submitted") return true;
  return ["completed", "report_submitted"].includes(request.status);
}

/** The requester has signed the findings off, so the job may be priced. */
export const inspectionApproved = (request) => request?.status === "accepted";

/** Every live pre-site inspection on a job, newest first. */
export function inspectionRequests(requests = []) {
  return requests
    .filter((r) => r.kind === "assignment" && r.department === "operations" && r.status !== "cancelled")
    .slice()
    .sort((a, b) => Number(b.id) - Number(a.id));
}

/**
 * The pre-site inspections on a job that the given coordinator was asked to do
 * and that have come back — findings in or approved — newest first. What
 * procurement reads when checking the BOQ against the site.
 */
export function completedInspectionsFor(requests = [], coordinatorId) {
  if (!coordinatorId) return [];
  return inspectionRequests(requests).filter(
    (r) => Number(r.assigneeId) === Number(coordinatorId) && (inspectionDelivered(r) || inspectionApproved(r)),
  );
}

/**
 * The one a job is currently running on: the most recent raised. A job may
 * carry several — a first visit that found more than expected, a re-visit after
 * a switchboard change — so raising another is always allowed.
 */
export function latestInspection(requests = []) {
  return inspectionRequests(requests)[0] || null;
}

/** Reference shown to people: the API's own code, or one built from the id. */
export function requestCode(request) {
  if (request?.code) return request.code;
  const prefix = REQUEST_KINDS[request?.kind]?.prefix || "REQ";
  return request?.id ? `${prefix}-${request.id}` : prefix;
}

/**
 * What an information request asks for is typed by the requester, one line per
 * item, and the response form is built from that list — nothing is pre-filled
 * on their behalf, so nobody is ever answering a question no one asked.
 */

/** Subject presets. They name the request; the items asked for are typed. */
export const INFORMATION_TEMPLATES = [
  { key: "client_usage", label: "Client energy usage", title: "Client energy usage and bills" },
  { key: "site_details", label: "Site details", title: "Site details confirmation" },
  { key: "client_decision", label: "Client decision & finance", title: "Client decision and finance requirements" },
  { key: "custom", label: "Something else", title: "" },
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
