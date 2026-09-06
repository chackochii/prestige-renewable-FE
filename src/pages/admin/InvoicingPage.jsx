// Financials: milestone billing requests and tax-invoice references.

import { Wallet } from "lucide-react";
import ModulePlaceholder from "@/components/ModulePlaceholder";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";

export default function InvoicingPage() {
  const { unit } = useBusinessUnit();
  const split = Array.isArray(unit?.billingSplit) ? unit.billingSplit : [];
  return (
    <ModulePlaceholder
      title="Financials"
      description={`Milestone requests${split.length ? ` (${split.map((m) => `${m.percent}%`).join(" / ")})` : ""} and the tax-invoice references recorded from accounting.`}
      icon={<Wallet size={28} strokeWidth={1.5} />}
      emptyTitle="No billing requests yet"
      emptyBody="They are raised on acceptance, material delivery and commissioning. The billing service is not connected to the API yet."
    />
  );
}
