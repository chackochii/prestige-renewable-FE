// 404. Inside the workspace it renders as a card; `standalone` gives it a
// full page for signed-out visitors.

import { useEffect } from "react";
import { Link, useLocation } from "react-router-dom";
import { Compass } from "lucide-react";
import EmptyState from "@/components/EmptyState";
import BrandMark from "@/components/BrandMark";
import { useAuth } from "@/hooks/useAuth";

export default function NotFoundPage({ standalone = false }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();

  useEffect(() => {
    const previous = document.title;
    document.title = "Page not found — Prestige Renewable";
    return () => {
      document.title = previous;
    };
  }, []);

  const content = (
    <EmptyState
      icon={<Compass size={28} strokeWidth={1.5} />}
      title="Page not found"
      body={`There is nothing at ${location.pathname}. Check the address, or head back.`}
      action={
        <div style={{ display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
          <Link to="/" className="btn btn-primary">
            {isAuthenticated ? "Back to home" : "Go to the start"}
          </Link>
          {!isAuthenticated ? (
            <Link to="/login" className="btn btn-ghost">
              Sign in
            </Link>
          ) : null}
        </div>
      }
    />
  );

  if (!standalone) return <div className="card card-pad">{content}</div>;

  return (
    <div className="gate-wrap">
      <div className="card card-pad gate-card">
        <div className="brand" style={{ padding: "0 0 8px" }}>
          <BrandMark size={32} />
          <div className="brand-name">Prestige Renewable</div>
        </div>
        {content}
      </div>
    </div>
  );
}
