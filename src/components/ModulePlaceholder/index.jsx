// Page shell for a registry page whose module API is not connected yet.
// Keeps the page reachable (so per-role visibility and per-unit toggles can
// be configured now) without showing invented data.

import PageHeader from "@/components/PageHeader";
import EmptyState from "@/components/EmptyState";

export default function ModulePlaceholder({ title, description, icon, emptyTitle, emptyBody, children }) {
  return (
    <>
      <PageHeader title={title} description={description} />
      {children}
      <div className="card card-pad">
        <EmptyState
          icon={icon}
          title={emptyTitle || "Nothing to show yet"}
          body={
            emptyBody ||
            "This module's records are not available from the API yet. The page is in place so access can be configured; data will appear here once the service is connected."
          }
        />
      </div>
    </>
  );
}
