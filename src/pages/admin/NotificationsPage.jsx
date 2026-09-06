// Inbox: assignments, approvals, stage changes and overdue items for you.

import { BellOff } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

export default function NotificationsPage() {
  return (
    <>
      <PageHeader title="Inbox" description="Assignments, approvals, stage changes and overdue items for you in this unit." />
      <div className="card card-pad">
        <EmptyState
          icon={<BellOff size={28} strokeWidth={1.5} />}
          title="Nothing here"
          body="You're all caught up. Notices will land in this inbox once the notification service is connected to the API."
        />
      </div>
    </>
  );
}
