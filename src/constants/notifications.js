// How notifications read on screen. The event catalogue itself is served by
// the API (GET /notifications/events) so the two sides cannot drift; these are
// the display bits the backend has no opinion about.

export const PRIORITIES = ["high", "medium", "low"];

export const PRIORITY_META = {
  high: { label: "High", tone: "danger" },
  medium: { label: "Medium", tone: "warning" },
  low: { label: "Low", tone: "neutral" },
};

export const priorityMeta = (priority) => PRIORITY_META[priority] || PRIORITY_META.medium;

// Fallback labels, used until the catalogue loads (and for any event this
// build has not heard of yet).
const EVENT_LABELS = {
  "assignment.salesperson": "Salesperson assigned",
  "assignment.estimator": "Estimator assigned",
  "assignment.coordinator": "Operations coordinator assigned",
  "stage.advanced": "Stage advanced",
  "lifecycle.changed": "Won / lost / closed",
  "sla.overdue": "SLA overdue",
  "lead.captured": "New lead captured",
  "estimation.on_hold": "Estimation on hold",
  "estimation.site_visit": "Pre-site inspection needed",
};

export const eventLabel = (event, catalogue = []) =>
  catalogue.find((e) => e.key === event)?.label || EVENT_LABELS[event] || event;
