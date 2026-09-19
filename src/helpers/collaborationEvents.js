// The events a request or assignment raises, as the inbox shows them.
//
// prestige-be will push these properly once a notification service exists —
// the event names below are the catalog it should emit. Until then the inbox
// derives the same list from the requests the person can already see, so the
// screen is useful rather than empty.

import {
  departmentLabel,
  isAssignee,
  isRequester,
  requestCode,
  statusMeta,
} from "@/constants/collaboration";
import { isOverdue } from "@/helpers/dateTimeHelpers";
import { notificationPriority } from "@/utils/notificationPriority";

/** Event names prestige-be should emit. Keep in step with the API. */
export const COLLABORATION_EVENTS = {
  REQUEST_CREATED: "request.created",
  RESPONSE_SUBMITTED: "request.response.submitted",
  CLARIFICATION_REQUESTED: "request.clarification.requested",
  RESPONSE_ACCEPTED: "request.response.accepted",
  COST_CHANGED: "request.cost.changed",
  SCHEDULE_CHANGED: "assignment.schedule.changed",
  ACTIVITY_COMPLETED: "assignment.completed",
  REPORT_SUBMITTED: "assignment.report.submitted",
  REQUEST_OVERDUE: "request.overdue",
};

const event = (request, { key, title, detail, at }) => {
  const overdue = statusMeta(request.kind, request.status).open && isOverdue(request.dueAt);
  return {
    id: `${key}-${request.id}`,
    key,
    request,
    title,
    detail,
    at: at || request.updatedAt || request.createdAt,
    project: [request.opportunityNumber, request.opportunityName].filter(Boolean).join(" · "),
    reference: requestCode(request),
    priority: notificationPriority({ priority: request.priority, status: request.status, overdue }),
  };
};

/**
 * What the signed-in person should be told about, newest first. `assigned`
 * are requests they must act on; `raised` are their own, where the other team
 * has moved something.
 */
export function collaborationNotifications({ assigned = [], raised = [], user } = {}) {
  const events = [];

  for (const request of assigned) {
    if (!isAssignee(request, user)) continue;
    const meta = statusMeta(request.kind, request.status);
    if (["pending", "requested", "assigned"].includes(request.status)) {
      events.push(
        event(request, {
          key: COLLABORATION_EVENTS.REQUEST_CREATED,
          title: request.kind === "assignment" ? "New assignment for you" : "New information request for you",
          detail: `${request.title} — raised by ${request.createdByName || "another team"}`,
          at: request.createdAt,
        }),
      );
    }
    if (request.status === "clarification_required") {
      events.push(
        event(request, {
          key: COLLABORATION_EVENTS.CLARIFICATION_REQUESTED,
          title: "Clarification requested",
          detail: request.clarificationNote || `${request.title} was sent back to you`,
        }),
      );
    }
    if (meta.open && isOverdue(request.dueAt)) {
      events.push(
        event(request, {
          key: COLLABORATION_EVENTS.REQUEST_OVERDUE,
          title: "Overdue",
          detail: `${request.title} passed its due date`,
        }),
      );
    }
  }

  for (const request of raised) {
    if (!isRequester(request, user)) continue;
    const by = request.assigneeName || departmentLabel(request.department);
    if (request.status === "responded") {
      events.push(
        event(request, {
          key: COLLABORATION_EVENTS.RESPONSE_SUBMITTED,
          title: "Response received",
          detail: `${by} answered ${request.title}`,
          at: request.response?.submittedAt,
        }),
      );
    }
    if (request.status === "rescheduled") {
      events.push(
        event(request, {
          key: COLLABORATION_EVENTS.SCHEDULE_CHANGED,
          title: "Schedule changed",
          detail: `${by} rescheduled ${request.title}`,
        }),
      );
    }
    if (request.status === "completed") {
      events.push(
        event(request, { key: COLLABORATION_EVENTS.ACTIVITY_COMPLETED, title: "Activity completed", detail: `${by} completed ${request.title}` }),
      );
    }
    if (request.status === "report_submitted") {
      events.push(
        event(request, { key: COLLABORATION_EVENTS.REPORT_SUBMITTED, title: "Report submitted", detail: `${by} submitted a report for ${request.title}` }),
      );
    }
    if (request.costImpact) {
      events.push(
        event(request, {
          key: COLLABORATION_EVENTS.COST_CHANGED,
          title: "Material cost change",
          detail: `${request.costImpact.summary || "Costs changed"} — affects the quotation`,
        }),
      );
    }
    if (statusMeta(request.kind, request.status).open && isOverdue(request.dueAt)) {
      events.push(
        event(request, { key: COLLABORATION_EVENTS.REQUEST_OVERDUE, title: "Overdue", detail: `${by} has not answered ${request.title}` }),
      );
    }
  }

  return events.sort((a, b) => new Date(b.at) - new Date(a.at));
}
