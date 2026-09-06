// Home: a quiet view of the business unit — what is live, what is yours, what is late.

import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Briefcase, CircleDollarSign, History, Sparkles, Target, TrendingUp, TriangleAlert, UserCheck } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import StatCard from "@/components/StatCard";
import Card from "@/components/Card";
import Avatar from "@/components/Avatar";
import Alert from "@/components/Alert";
import LoadingState from "@/components/LoadingState";
import { oppTitle, oppValue } from "@/helpers/opportunity";
import { enabledStagesFor, stageById } from "@/constants/stages";
import { PERMISSIONS } from "@/constants/permissions";
import { isOverdue, periodStart, slaStatus, timeAgo } from "@/helpers/dateTimeHelpers";
import { formatCurrency } from "@/utils/formatCurrency";
import { firstName } from "@/utils/text";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { useOpportunities } from "@/hooks/useOpportunities";
import { useUnitUsers } from "@/hooks/useUnitUsers";

const PERIODS = [
  { key: "week", label: "This week" },
  { key: "month", label: "This month" },
  { key: "quarter", label: "This quarter" },
];

const TONE_COLOR = { success: "var(--brand)", warning: "var(--warning)", danger: "var(--danger)" };

const owners = (o) => [o.leadOwnerId, o.estimatorId, o.salespersonId, o.deliveryOwnerId].filter(Boolean);

export default function HomePage() {
  const navigate = useNavigate();
  const { user, hasPermission } = useAuth();
  const { unit } = useBusinessUnit();
  const canReadLeads = hasPermission(PERMISSIONS.LEADS_READ);
  const { items, status, error, ready } = useOpportunities({}, { enabled: canReadLeads });
  const { users, userName } = useUnitUsers();
  const [period, setPeriod] = useState("month");

  const data = useMemo(() => {
    const active = items.filter((o) => o.lifecycle === "Active");
    const leads = active.filter((o) => Number(o.stage) === 1);
    const pipeline = active.filter((o) => Number(o.stage) >= 2);
    const pipelineValue = pipeline.reduce((s, o) => s + oppValue(o), 0);
    const overdue = active.filter((o) => isOverdue(o.slaDueAt));
    const overdueValue = overdue.reduce((s, o) => s + oppValue(o), 0);
    const mine = active.filter((o) => owners(o).includes(user.id));
    const since = periodStart(period);
    const closed = items.filter(
      (o) => ["Won", "Closed"].includes(o.lifecycle) && new Date(o.closedAt || o.updatedAt) >= since,
    );
    const closedValue = closed.reduce((s, o) => s + (Number(o.acceptedValue) || 0), 0);
    const onSchedule = pipelineValue > 0 ? Math.max(0, Math.min(100, Math.round(((pipelineValue - overdueValue) / pipelineValue) * 100))) : 100;
    const byStage = enabledStagesFor(unit).map((s) => ({
      ...s,
      count: active.filter((o) => Number(o.stage) === s.id).length,
    }));
    const health = { success: 0, warning: 0, danger: 0 };
    pipeline.forEach((o) => {
      const tone = slaStatus(o.slaDueAt).tone;
      health[tone === "neutral" ? "success" : tone] += 1;
    });
    const reps = new Map();
    items.forEach((o) => {
      const repId = o.salespersonId;
      if (!repId) return;
      if (!reps.has(repId)) reps.set(repId, { id: repId, pipelineVal: 0, won: 0, lost: 0, wonValue: 0, total: 0 });
      const r = reps.get(repId);
      r.total += 1;
      if (o.lifecycle === "Active" && Number(o.stage) >= 2) r.pipelineVal += oppValue(o);
      if (["Won", "Closed"].includes(o.lifecycle)) {
        r.won += 1;
        r.wonValue += Number(o.acceptedValue) || 0;
      }
      if (o.lifecycle === "Lost") r.lost += 1;
    });
    const team = [...reps.values()]
      .map((r) => ({
        ...r,
        name: userName(r.id) || "Unknown",
        winRate: r.won + r.lost ? Math.round((r.won / (r.won + r.lost)) * 100) : null,
        avgDeal: r.won ? r.wonValue / r.won : 0,
      }))
      .sort((a, b) => b.pipelineVal - a.pipelineVal);
    const activity = [...items].sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)).slice(0, 7);
    const attention = [
      ...overdue.map((o) => ({
        id: `sla-${o.id}`,
        oppId: o.id,
        tone: "danger",
        title: oppTitle(o),
        meta: `${stageById(o.stage).label} · ${slaStatus(o.slaDueAt).label}`,
        cta: "Open opportunity",
      })),
      ...leads
        .filter((o) => o.nextActionDueAt && isOverdue(o.nextActionDueAt) && !isOverdue(o.slaDueAt))
        .map((o) => ({
          id: `next-${o.id}`,
          oppId: o.id,
          tone: "warning",
          title: oppTitle(o),
          meta: `Next action overdue · ${o.nextAction || "no action set"}`,
          cta: "Review lead",
        })),
    ].slice(0, 6);
    return { active, leads, pipeline, pipelineValue, overdue, overdueValue, mine, closed, closedValue, onSchedule, byStage, health, team, activity, attention };
  }, [items, user.id, unit, period, userName]);

  const periodLabel = PERIODS.find((p) => p.key === period)?.label.toLowerCase();
  const healthTotal = Math.max(1, data.health.success + data.health.warning + data.health.danger);
  const donut = {
    background: `conic-gradient(var(--brand) 0 ${(data.health.success / healthTotal) * 360}deg, var(--warning) ${(data.health.success / healthTotal) * 360}deg ${((data.health.success + data.health.warning) / healthTotal) * 360}deg, var(--danger) ${((data.health.success + data.health.warning) / healthTotal) * 360}deg 360deg)`,
  };
  const maxStage = Math.max(1, ...data.byStage.map((s) => s.count));

  return (
    <>
      <PageHeader
        title={`Good day, ${firstName(user.name)}`}
        description={`A quiet view of ${unit?.name}: what is live, what is yours, and what is late.`}
        actions={
          hasPermission(PERMISSIONS.LEADS_CREATE) ? (
            <Link className="btn btn-primary" to="/leads/new">
              New lead
            </Link>
          ) : null
        }
      />

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {status === "loading" && !ready ? <LoadingState label="Loading the unit…" /> : null}
      {!canReadLeads ? (
        <Alert tone="info">
          Your roles don't include access to leads and the pipeline in {unit?.name}, so the figures below stay at
          zero. The pages you can open are listed in the sidebar.
        </Alert>
      ) : null}

      {canReadLeads ? (
        <div className="hero-forecast">
          <div className="hero-top">
            <span className="hero-eyebrow">
              <Sparkles size={13} /> Pipeline · {unit?.name}
            </span>
            <div className="segmented">
              {PERIODS.map((p) => (
                <button key={p.key} type="button" className={period === p.key ? "active" : ""} onClick={() => setPeriod(p.key)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <div className="hero-value-row">
            <span className="hero-value">{formatCurrency(data.pipelineValue)}</span>
            {data.overdue.length ? (
              <span className="hero-delta">
                <TriangleAlert size={13} /> {data.overdue.length} at risk
              </span>
            ) : (
              <span className="hero-delta">
                <TrendingUp size={13} /> all on track
              </span>
            )}
          </div>
          <div className="hero-caption">
            Across {data.pipeline.length} qualified opportunit{data.pipeline.length === 1 ? "y" : "ies"} · {data.onSchedule}% of value on schedule
          </div>
          <div className="hero-track">
            <i style={{ width: `${data.onSchedule}%` }} />
          </div>
          <div className="hero-chips">
            <div className="hero-chip">
              <div className="hc-label">
                <span className="dot" style={{ background: "#7ef0c2" }} /> Closed {periodLabel}
              </div>
              <div className="hc-value">{formatCurrency(data.closedValue)}</div>
            </div>
            <div className="hero-chip">
              <div className="hc-label">
                <span className="dot" style={{ background: "#ffb4a2" }} /> Past SLA
              </div>
              <div className="hc-value">{formatCurrency(data.overdueValue)}</div>
            </div>
            <div className="hero-chip">
              <div className="hc-label">
                <span className="dot" style={{ background: "#c4b5fd" }} /> Leads to qualify
              </div>
              <div className="hc-value">{data.leads.length}</div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="stats">
        <StatCard
          icon={<Briefcase size={17} />}
          label="Leads to qualify"
          value={data.leads.length}
          hint={canReadLeads ? <Link to="/leads">Open leads</Link> : "In this unit"}
          style={{ "--i": 0 }}
        />
        <StatCard icon={<UserCheck size={17} />} label="My work" value={data.mine.length} hint="Assigned to you right now" style={{ "--i": 1 }} />
        <StatCard
          icon={<TriangleAlert size={17} />}
          label="Past SLA"
          value={data.overdue.length}
          hint={data.overdue.length ? "Needs a decision or a chase" : "All on time"}
          style={{ "--i": 2 }}
        />
        <StatCard
          icon={<CircleDollarSign size={17} />}
          label="Closed value"
          value={formatCurrency(data.closedValue)}
          hint={`${data.closed.length} job${data.closed.length === 1 ? "" : "s"}, ${periodLabel}`}
          style={{ "--i": 3 }}
        />
      </div>

      <div className="grid-2">
        <div>
          <Card title="Pipeline by stage" sub="Active records per stage — open the pipeline for the full board.">
            <div className="pipeline-row">
              {data.byStage.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  className="pipe-cell"
                  style={{ "--i": i }}
                  onClick={() => navigate(`/pipeline?stage=${s.id}`)}
                >
                  <strong>{s.count}</strong>
                  <span>{s.short}</span>
                  <span className="pipe-bar">
                    <i style={{ width: `${(s.count / maxStage) * 100}%` }} />
                  </span>
                </button>
              ))}
            </div>
          </Card>

          {data.team.length ? (
            <Card title="Team performance" sub={`${data.team.length} rep${data.team.length === 1 ? "" : "s"} · sorted by open pipeline`} style={{ marginTop: 20 }}>
              <div className="table-wrap">
                <table className="table clickable stack">
                  <thead>
                    <tr>
                      <th>Rep</th>
                      <th>Pipeline</th>
                      <th>Closed</th>
                      <th>Win rate</th>
                      <th>Avg deal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.team.map((r) => (
                      <tr key={r.id} onClick={() => navigate("/pipeline")}>
                        <td data-label="Rep">
                          <div className="cell-with-avatar">
                            <Avatar name={r.name} size={30} />
                            <span className="row-title">{r.name}</span>
                          </div>
                        </td>
                        <td data-label="Pipeline">{formatCurrency(r.pipelineVal)}</td>
                        <td data-label="Closed">{formatCurrency(r.wonValue)}</td>
                        <td data-label="Win rate">
                          {r.winRate == null ? (
                            <span className="row-meta">No decided deals</span>
                          ) : (
                            <div className="table-progress">
                              <span className="tp-track">
                                <i style={{ width: `${r.winRate}%`, background: r.winRate >= 50 ? "var(--success)" : "var(--warning)" }} />
                              </span>
                              <span className="tp-val">{r.winRate}%</span>
                            </div>
                          )}
                        </td>
                        <td data-label="Avg deal">{r.avgDeal ? formatCurrency(r.avgDeal) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          ) : null}

          <Card title="Latest activity" sub="Most recently updated records in this unit." style={{ marginTop: 20 }}>
            {data.activity.length === 0 ? (
              <p className="lede">No activity recorded yet.</p>
            ) : (
              <div className="activity-feed">
                {data.activity.map((o) => (
                  <div key={o.id} className="activity-row">
                    <span className="activity-icon">
                      <History size={15} />
                    </span>
                    <div>
                      <div className="activity-text">
                        <b>{userName(o.salespersonId || o.leadOwnerId) || "Someone"}</b> updated{" "}
                        <Link to={`/opportunities/${o.id}`}>
                          <b>{oppTitle(o)}</b>
                        </Link>{" "}
                        — {stageById(o.stage).label}
                      </div>
                      <div className="activity-time">{timeAgo(o.updatedAt)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div>
          <Card title="Pipeline health" sub="Active opportunities by SLA status.">
            {data.pipeline.length === 0 ? (
              <p className="lede">No qualified opportunities in the pipeline yet.</p>
            ) : (
              <div className="donut-wrap">
                <div className="donut" style={donut}>
                  <div className="donut-center">
                    <strong>{data.pipeline.length}</strong>
                    <span>deals</span>
                  </div>
                </div>
                <div className="donut-legend">
                  {[
                    ["danger", "Stalled", data.health.danger],
                    ["warning", "At risk", data.health.warning],
                    ["success", "On track", data.health.success],
                  ].map(([tone, label, count]) => (
                    <div key={tone} className="donut-legend-row">
                      <span className="dl-label">
                        <span className="dl-dot" style={{ background: TONE_COLOR[tone] }} /> {label}
                      </span>
                      <span className="dl-value">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Card>

          <Card title="Needs attention" sub="Ranked by urgency — SLA breaches and overdue next actions." style={{ marginTop: 20 }}>
            {data.attention.length === 0 ? (
              <p className="lede">Nothing needs attention right now.</p>
            ) : (
              <div className="attn-list">
                {data.attention.map((a) => (
                  <button key={a.id} type="button" className="attn-row" onClick={() => navigate(`/opportunities/${a.oppId}`)}>
                    <div className="attn-row-top">
                      <span className="attn-title">
                        <span className="attn-dot" style={{ background: TONE_COLOR[a.tone] }} />
                        {a.title}
                      </span>
                      <Target size={13} style={{ color: "var(--muted)" }} />
                    </div>
                    <div className="attn-meta">{a.meta}</div>
                    <div className="attn-cta">{a.cta} →</div>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <Card title="My queue" sub="Items you own, with SLA status." style={{ marginTop: 20 }}>
            {data.mine.length === 0 ? (
              <p className="lede">Nothing assigned to you in this unit.</p>
            ) : (
              <div className="list-stack">
                {data.mine.slice(0, 5).map((o) => {
                  const sla = slaStatus(o.slaDueAt);
                  return (
                    <button key={o.id} type="button" className="list-row" onClick={() => navigate(`/opportunities/${o.id}`)}>
                      <div>
                        <div className="row-title">{oppTitle(o)}</div>
                        <div className="row-meta">
                          {o.number} · {stageById(o.stage).label}
                        </div>
                      </div>
                      <span className={`badge ${sla.tone}`}>{sla.label}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </Card>

          {users.length === 0 && ready ? (
            <Card title="Your team" sub="Nobody else is assigned to this unit yet." style={{ marginTop: 20 }}>
              <p className="lede" style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <Bell size={14} /> Add people in Administration to start assigning work.
              </p>
            </Card>
          ) : null}
        </div>
      </div>
    </>
  );
}
