// KPI tile: label, value, optional hint / trend / sparkline.

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

export default function StatCard({ label, value, hint, icon, trend, spark, style }) {
  return (
    <div className="stat" style={style}>
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
        {hint ? <div className="hint">{hint}</div> : null}
      </div>
      {spark?.length ? <Sparkline data={spark} /> : null}
    </div>
  );
}
