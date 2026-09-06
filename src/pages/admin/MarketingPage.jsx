// Marketing planning & approval.

import { Megaphone } from "lucide-react";
import ModulePlaceholder from "@/components/ModulePlaceholder";

export default function MarketingPage() {
  return (
    <ModulePlaceholder
      title="Marketing planning & approval"
      description="Campaign briefs must be approved before they become lead sources; performance is measured by the leads, qualified opportunities and won jobs each campaign produces."
      icon={<Megaphone size={28} strokeWidth={1.5} />}
      emptyTitle="No campaigns yet"
      emptyBody="Campaign briefs and their performance will appear here once the marketing service is connected to the API."
    />
  );
}
