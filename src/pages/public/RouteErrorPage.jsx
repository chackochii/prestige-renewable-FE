// Router-level error page: shown when a route fails to render or the router
// itself throws (a bad URL segment, a chunk that failed to load after a
// deploy, …). The workspace shell has its own boundary for page errors.

import { Link, isRouteErrorResponse, useRouteError } from "react-router-dom";
import { TriangleAlert } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import BrandMark from "@/components/BrandMark";
import NotFoundPage from "@/pages/public/NotFoundPage";

export default function RouteErrorPage() {
  const error = useRouteError();

  if (isRouteErrorResponse(error) && error.status === 404) return <NotFoundPage standalone />;

  const message = isRouteErrorResponse(error)
    ? `${error.status} ${error.statusText}`
    : error?.message || "Something went wrong while loading this page.";
  const staleBuild = /Failed to fetch dynamically imported module|Loading chunk|import\(\)/i.test(String(error?.message));

  return (
    <div className="gate-wrap">
      <div className="card card-pad gate-card">
        <div className="brand" style={{ padding: "0 0 8px" }}>
          <BrandMark size={32} />
          <div className="brand-name">Prestige Renewable</div>
        </div>
        <EmptyState
          icon={<TriangleAlert size={28} strokeWidth={1.5} />}
          title={staleBuild ? "A new version is available" : "This page could not be loaded"}
          body={staleBuild ? "The app was updated since this tab was opened. Reload to pick up the latest version." : message}
          action={
            <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
              <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
                Reload
              </button>
              <Link to="/" className="btn btn-ghost" reloadDocument>
                Back to home
              </Link>
            </div>
          }
        />
      </div>
    </div>
  );
}
