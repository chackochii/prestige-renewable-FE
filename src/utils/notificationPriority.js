// Normal vs high-priority notification rules.
//
// High priority is what someone should act on today: anything overdue, work
// marked high or urgent, and anything that has bounced back to them
// (clarification asked for, a report sent back for review).

const HIGH_PRIORITIES = ["high", "urgent"];
const HIGH_STATUSES = ["clarification_required", "review_required", "returned"];

export const NOTIFICATION_PRIORITIES = {
  high: { key: "high", label: "Needs attention", tone: "danger" },
  normal: { key: "normal", label: "For information", tone: "info" },
};

/** `overdue` is passed in rather than derived, so the caller owns the clock. */
export function notificationPriority({ priority, status, overdue = false } = {}) {
  if (overdue || HIGH_PRIORITIES.includes(priority) || HIGH_STATUSES.includes(status))
    return NOTIFICATION_PRIORITIES.high;
  return NOTIFICATION_PRIORITIES.normal;
}

export const isHighPriority = (input) => notificationPriority(input).key === "high";
