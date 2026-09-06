// Dashboards & reporting.

import { Link } from "react-router-dom";
import { Gauge } from "lucide-react";
import ModulePlaceholder from "@/components/ModulePlaceholder";

export default function DashboardsPage() {
  return (
    <ModulePlaceholder
      title="Dashboards"
      description="Cross-unit reporting on pipeline, delivery and cash. The Home screen already shows the live view of the unit you are working in."
      icon={<Gauge size={28} strokeWidth={1.5} />}
      emptyTitle="Reporting is not configured yet"
      emptyBody="Consolidated dashboards will appear here once the reporting service is connected to the API."
    >
      <div style={{ marginBottom: 16 }}>
        <Link to="/" className="btn btn-ghost btn-sm">
          Open the unit overview
        </Link>
      </div>
    </ModulePlaceholder>
  );
}
