// KPI tile: label, value, optional hint / trend / sparkline. With `onClick`
// it is a filter: `active` marks the one applied, `hintTone` colours the hint.

import { TrendingDown, TrendingUp } from "lucide-react";

function Sparkline({ data = [] }) {
  const max = Math.max(1, ...data.map((n) => Number(n) || 0));
  return (
    <div className="sparkline" aria-hidden="true">
      {data.map((n, i) => (
        <span key={i} style={{ height: `${Math.max(8, (Number(n) / max) * 100)}%` }} />
      ))}
    </div>
  );
}

export default function StatCard({ label, value, hint, icon, trend, spark, style, onClick, active = false, hintTone }) {
  return (
    <div
      className={`stat${onClick ? " stat-filter" : ""}${active ? " is-active" : ""}`}
      style={style}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      aria-pressed={onClick ? active : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick();
              }
            }
          : undefined
      }
    >
      <div className="stat-body">
        <div className="stat-head">
          {icon ? <span className="stat-icon-inline">{icon}</span> : null}
          <span className="label">{label}</span>
        </div>
        <div className="stat-value-row">
          <span className="value">{value}</span>
          {trend != null ? (
            <span className={`trend-pill ${trend < 0 ? "down" : "up"}`}>
              {trend < 0 ? <TrendingDown size={11} /> : <TrendingUp size={11} />}
              {Math.abs(trend)}%
            </span>
          ) : null}
        </div>
        {hint ? <div className={`hint${hintTone ? ` tone-${hintTone}` : ""}`}>{hint}</div> : null}
      </div>
      {spark?.length ? <Sparkline data={spark} /> : null}
    </div>
  );
}
