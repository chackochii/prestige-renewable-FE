// Costs: cost, price and margin from the current estimate on every live job.

import { CircleDollarSign } from "lucide-react";
import ModulePlaceholder from "@/components/ModulePlaceholder";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { formatPercent } from "@/utils/formatCurrency";

export default function CostsPage() {
  const { unit } = useBusinessUnit();
  return (
    <ModulePlaceholder
      title="Costs"
      description={`Cost, price and margin from the current estimate on every live job. Pricing below the ${formatPercent(unit?.marginFloor, 0)} margin floor needs approval before issue.`}
      icon={<CircleDollarSign size={28} strokeWidth={1.5} />}
      emptyTitle="No estimates yet"
      emptyBody="Cost and price appear once an estimator saves a solution option. The estimation service is not connected to the API yet."
    />
  );
}
