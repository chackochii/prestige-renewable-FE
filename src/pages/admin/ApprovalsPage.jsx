// Approvals: council, DNSP, facility and rebate items across live jobs.

import { SquareCheckBig } from "lucide-react";
import ModulePlaceholder from "@/components/ModulePlaceholder";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";

export default function ApprovalsPage() {
  const { unit } = useBusinessUnit();
  const types = Array.isArray(unit?.approvalTypes) ? unit.approvalTypes : [];
  return (
    <ModulePlaceholder
      title="Approvals"
      description={`Outstanding approvals across live jobs in ${unit?.name}.${types.length ? ` This unit tracks: ${types.map((t) => t.label).join(", ")}.` : ""}`}
      icon={<SquareCheckBig size={28} strokeWidth={1.5} />}
      emptyTitle="No approval records yet"
      emptyBody="Approval items are raised on each opportunity at the approvals stage. The approvals service is not connected to the API yet, so there is nothing to list."
    />
  );
}
