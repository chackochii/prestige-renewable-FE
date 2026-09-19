// Status pill for a request or assignment, with overdue folded in.

import Badge from "@/components/Badge";
import { statusMeta } from "@/constants/collaboration";
import { isOverdue } from "@/helpers/dateTimeHelpers";

export default function RequestStatusBadge({ request, showOverdue = true }) {
  const meta = statusMeta(request?.kind, request?.status);
  const overdue = showOverdue && meta.open && isOverdue(request?.dueAt);
  return (
    <Badge tone={overdue ? "danger" : meta.tone} title={overdue ? "Past its due date" : undefined}>
      {meta.label}
      {overdue ? " · overdue" : ""}
    </Badge>
  );
}
