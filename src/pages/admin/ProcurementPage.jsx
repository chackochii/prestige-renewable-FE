// Procurement: purchase orders and delivery dates.

import { PackageSearch } from "lucide-react";
import ModulePlaceholder from "@/components/ModulePlaceholder";

export default function ProcurementPage() {
  return (
    <ModulePlaceholder
      title="Procurement"
      description="Purchase orders and delivery dates, so site windows can line up with what is actually arriving."
      icon={<PackageSearch size={28} strokeWidth={1.5} />}
      emptyTitle="No purchase orders"
      emptyBody="POs are raised from an opportunity once approvals are in place. The purchase-order service is not connected to the API yet."
    />
  );
}
