// Warranty & maintenance records.

import { ShieldCheck } from "lucide-react";
import ModulePlaceholder from "@/components/ModulePlaceholder";

export default function WarrantyPage() {
  return (
    <ModulePlaceholder
      title="Warranty"
      description="Warranty registrations, certificates and maintenance records for delivered jobs."
      icon={<ShieldCheck size={28} strokeWidth={1.5} />}
      emptyTitle="No warranty records yet"
      emptyBody="Warranty records are created at handover. The warranty service is not connected to the API yet."
    />
  );
}
