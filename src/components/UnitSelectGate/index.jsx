// Post-login gate: a person with several business units chooses one before
// the workspace renders (the choice is remembered per user). A single unit is
// selected automatically (see businessUnitsSlice); no units means no access.

import LoadingState from "@/components/LoadingState";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";

export default function UnitSelectGate({ children }) {
  const { user, logout } = useAuth();
  const { unit, units, status, error, switchUnit, reload } = useBusinessUnit();

  if (status === "idle" || status === "loading") return <LoadingState screen label="Loading your workspace…" />;

  if (status === "failed") {
    return (
      <div className="gate-wrap">
        <div className="card card-pad gate-card">
          <h2>Could not load business units</h2>
          <p className="lede" style={{ marginBottom: 16 }}>
            {error || "The server did not respond."}
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            <button type="button" className="btn btn-primary" onClick={reload}>
              Try again
            </button>
            <button type="button" className="btn btn-ghost" onClick={logout}>
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (units.length === 0) {
    return (
      <div className="gate-wrap">
        <div className="card card-pad gate-card">
          <h2>No business unit assigned</h2>
          <p className="lede" style={{ marginBottom: 16 }}>
            {user?.name}, your account is not assigned to any business unit yet. Ask an administrator to add you to
            one, then sign in again.
          </p>
          <button type="button" className="btn btn-ghost" onClick={logout}>
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (!unit) {
    return (
      <div className="gate-wrap">
        <div className="card card-pad gate-card">
          <div className="kicker">Welcome, {user?.name}</div>
          <h2 style={{ fontSize: 22 }}>Choose a business unit</h2>
          <p className="lede" style={{ marginBottom: 16 }}>
            You work across several units. Pick the one to open; sign out and back in to work in another.
          </p>
          <div className="list-stack">
            {units.map((u) => (
              <button key={u.id} type="button" className="list-row" onClick={() => switchUnit(u.id)}>
                <div>
                  <div className="row-title">{u.name}</div>
                  <div className="row-meta">
                    {u.code}
                    {u.legalName ? ` · ${u.legalName}` : ""}
                  </div>
                </div>
                <span className={`badge ${u.status === "active" ? "success" : "neutral"}`}>{u.status}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return children;
}
