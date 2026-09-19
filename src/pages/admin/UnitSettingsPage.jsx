// Administration → Unit settings: the parameters this business unit runs on.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Settings } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import AdminNav from "@/components/AdminNav";
import Card from "@/components/Card";
import Field from "@/components/Field";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import LoadingState from "@/components/LoadingState";
import NumberInput from "@/components/NumberInput";
import EnquiryLinkCard from "@/features/leads/EnquiryLinkCard";
import { STAGES } from "@/constants/stages";
import { PERMISSIONS } from "@/constants/permissions";
import { PRIORITIES, priorityMeta } from "@/constants/notifications";
import { getBusinessUnitConfig } from "@/services/api/businessUnitsApi";
import { useAppDispatch, useAppSelector } from "@/store";
import { updateBusinessUnitConfig } from "@/slices/businessUnitsSlice";
import { fetchNotificationEvents } from "@/slices/inboxSlice";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { useNotifications } from "@/hooks/useNotifications";

const errMessage = (err, fallback) => (typeof err === "string" ? err : err?.message || fallback);

function toForm(config) {
  return {
    marginFloor: Number(config.marginFloor) || 0,
    enabledStages: (config.enabledStages || []).map(Number),
    slaDays: { ...(config.slaDays || {}) },
    billingSplit: (config.billingSplit || []).map((m) => ({ ...m })),
    commissionTiers: (config.commissionTiers || []).map((t) => ({ ...t, ratePercent: Math.round(Number(t.rate) * 10000) / 100 })),
    approvalTypes: (config.approvalTypes || []).map((a) => ({ ...a })),
    siteWorkSubstages: (config.siteWorkSubstages || []).map((s) => ({ ...s })),
    notificationPriorities: { ...(config.notificationPriorities || {}) },
  };
}

function KeyLabelRows({ rows, onChange, keyMax, disabled, keyHint }) {
  const update = (i, field, value) => onChange(rows.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)));
  return (
    <>
      {rows.map((r, i) => (
        <div key={i} className="row-grid">
          <Field label={`Key${keyHint ? ` · ${keyHint}` : ""}`}>
            <input value={r.key} maxLength={keyMax} disabled={disabled} onChange={(e) => update(i, "key", e.target.value)} />
          </Field>
          <Field label="Label">
            <input value={r.label || ""} disabled={disabled} onChange={(e) => update(i, "label", e.target.value)} />
          </Field>
          <div>
            {!disabled ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange(rows.filter((_, idx) => idx !== i))}>
                Remove
              </button>
            ) : null}
          </div>
        </div>
      ))}
      {!disabled ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([...rows, { key: "", label: "" }])}>
          Add row
        </button>
      ) : null}
    </>
  );
}

export default function UnitSettingsPage() {
  const dispatch = useAppDispatch();
  const { hasPermission, isSuperAdmin } = useAuth();
  const { unit } = useBusinessUnit();
  const { notify } = useNotifications();
  const [form, setForm] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const canEdit = hasPermission(PERMISSIONS.ADMIN_UPDATE);
  // The notification events the priority table below is built from.
  const events = useAppSelector((s) => s.inbox.events);

  useEffect(() => {
    if (!events.length) dispatch(fetchNotificationEvents());
  }, [events.length, dispatch]);

  useEffect(() => {
    if (!unit?.id) return;
    let cancelled = false;
    setForm(null);
    setLoadError("");
    getBusinessUnitConfig(unit.id)
      .then((config) => {
        if (!cancelled) setForm(toForm(config));
      })
      .catch((err) => {
        if (!cancelled) setLoadError(errMessage(err, "Could not load the unit configuration."));
      });
    return () => {
      cancelled = true;
    };
  }, [unit?.id]);

  const billingTotal = useMemo(
    () => (form ? form.billingSplit.reduce((s, m) => s + (Number(m.percent) || 0), 0) : 0),
    [form],
  );

  const set = (field, value) => setForm((f) => ({ ...f, [field]: value }));

  const save = async () => {
    if (Math.abs(billingTotal - 100) > 0.01) return notify(`Billing split must total 100% (currently ${billingTotal}%).`, "danger");
    if (!form.enabledStages.length) return notify("Enable at least one stage.", "danger");
    setSaving(true);
    try {
      await dispatch(
        updateBusinessUnitConfig({
          id: unit.id,
          body: {
            marginFloor: Number(form.marginFloor),
            enabledStages: [...form.enabledStages].sort((a, b) => a - b),
            slaDays: Object.fromEntries(Object.entries(form.slaDays).map(([k, v]) => [k, Number(v) || 0])),
            billingSplit: form.billingSplit.map((m) => ({ key: m.key.trim(), label: m.label || m.key, percent: Number(m.percent) || 0 })),
            commissionTiers: form.commissionTiers.map((t) => ({ key: t.key, label: t.label, rate: (Number(t.ratePercent) || 0) / 100 })),
            approvalTypes: form.approvalTypes.filter((a) => a.key.trim()).map((a) => ({ key: a.key.trim(), label: a.label || a.key })),
            siteWorkSubstages: form.siteWorkSubstages.filter((s) => s.key.trim()).map((s) => ({ key: s.key.trim(), label: s.label || s.key })),
            notificationPriorities: form.notificationPriorities,
          },
        }),
      ).unwrap();
      notify("Unit settings saved");
    } catch (err) {
      notify(errMessage(err, "Could not save the settings."), "danger");
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  return (
    <>
      <PageHeader
        title="Unit settings"
        description={`The parameters ${unit?.name} runs on — margin floor, stages, SLA days, billing split and commission tiers.`}
        actions={
          canEdit && form ? (
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save settings"}
            </button>
          ) : null
        }
      />
      <AdminNav />

      <Card
        title={unit?.name}
        icon={<Settings size={16} />}
        sub={`${unit?.code} · ${unit?.legalName || "No legal name"} · ${unit?.timezone}`}
        actions={
          <>
            <Badge tone={unit?.status === "active" ? "success" : "neutral"}>{unit?.status}</Badge>
            {isSuperAdmin ? (
              <Link to="/superadmin" className="btn btn-ghost btn-sm">
                Edit identity
              </Link>
            ) : null}
          </>
        }
        style={{ marginBottom: 20 }}
      >
        <p className="lede">Name, legal name, timezone and status are managed by the system administrator.</p>
      </Card>

      <EnquiryLinkCard style={{ marginBottom: 20 }} />

      {loadError ? <Alert tone="danger">{loadError}</Alert> : null}
      {!form && !loadError ? <LoadingState label="Loading configuration…" /> : null}

      {form ? (
        <>
          {!canEdit ? <Alert tone="info">You have read access. Editing needs the “Update System Administration” permission.</Alert> : null}

          <Card title="Margin & stages" sub="Pricing below the floor needs approval before issue. Disabled stages are skipped, never renumbered." style={{ marginBottom: 20 }}>
            <div className="form-grid">
              <Field label="Margin floor (%)">
                <NumberInput value={form.marginFloor} min={0} max={100} disabled={!canEdit} onChange={(v) => set("marginFloor", v)} />
              </Field>
            </div>
            <div className="section" style={{ marginTop: 20, marginBottom: 0 }}>
              <h3>Stages this unit runs</h3>
              <div className="choice-grid">
                {STAGES.map((s) => (
                  <label key={s.id} className="choice">
                    <input
                      type="checkbox"
                      checked={form.enabledStages.includes(s.id)}
                      disabled={!canEdit}
                      onChange={() =>
                        set(
                          "enabledStages",
                          form.enabledStages.includes(s.id) ? form.enabledStages.filter((id) => id !== s.id) : [...form.enabledStages, s.id],
                        )
                      }
                    />
                    <span>
                      {s.id}. {s.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </Card>

          <Card title="SLA days" sub="Response-time target per stage, plus the approvals window." style={{ marginBottom: 20 }}>
            <div className="form-grid auto">
              {[...STAGES.map((s) => [String(s.id), `${s.id}. ${s.short}`]), ["approval", "Approvals window"]].map(([key, label]) => (
                <Field key={key} label={label}>
                  <NumberInput value={form.slaDays[key] ?? ""} min={0} disabled={!canEdit} onChange={(v) => set("slaDays", { ...form.slaDays, [key]: v })} />
                </Field>
              ))}
            </div>
          </Card>

          <Card title="Billing split" sub={`Milestone percentages must total 100%. Currently ${billingTotal}%.`} style={{ marginBottom: 20 }}>
            {form.billingSplit.map((m, i) => (
              <div key={i} className="row-grid billing">
                <Field label="Key">
                  <input value={m.key} maxLength={20} disabled={!canEdit} onChange={(e) => set("billingSplit", form.billingSplit.map((x, idx) => (idx === i ? { ...x, key: e.target.value } : x)))} />
                </Field>
                <Field label="Label">
                  <input value={m.label || ""} disabled={!canEdit} onChange={(e) => set("billingSplit", form.billingSplit.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))} />
                </Field>
                <Field label="Percent">
                  <NumberInput value={m.percent} min={0} max={100} disabled={!canEdit} onChange={(v) => set("billingSplit", form.billingSplit.map((x, idx) => (idx === i ? { ...x, percent: v } : x)))} />
                </Field>
                <div>
                  {canEdit ? (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => set("billingSplit", form.billingSplit.filter((_, idx) => idx !== i))}>
                      Remove
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
            {canEdit ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set("billingSplit", [...form.billingSplit, { key: "", label: "", percent: 0 }])}>
                Add milestone
              </button>
            ) : null}
          </Card>

          <Card title="Referrer commission tiers" sub="Rate paid on accepted contract value by involvement tier." style={{ marginBottom: 20 }}>
            {form.commissionTiers.map((t, i) => (
              <div key={t.key} className="row-grid tiers">
                <Field label="Tier">
                  <input value={t.key} disabled />
                </Field>
                <Field label="Label">
                  <input value={t.label || ""} disabled={!canEdit} onChange={(e) => set("commissionTiers", form.commissionTiers.map((x, idx) => (idx === i ? { ...x, label: e.target.value } : x)))} />
                </Field>
                <Field label="Rate (%)">
                  <NumberInput value={t.ratePercent} step="0.1" min={0} max={100} disabled={!canEdit} onChange={(v) => set("commissionTiers", form.commissionTiers.map((x, idx) => (idx === i ? { ...x, ratePercent: v } : x)))} />
                </Field>
              </div>
            ))}
          </Card>

          <Card title="Approval types" sub="External approvals gathered at the approvals stage. Leave empty if this unit has none." style={{ marginBottom: 20 }}>
            <KeyLabelRows rows={form.approvalTypes} keyMax={20} disabled={!canEdit} keyHint="up to 20 chars" onChange={(rows) => set("approvalTypes", rows)} />
          </Card>

          <Card title="Site-works sub-stages" sub="Checklist blocks signed off on site. Keys are short codes such as 7a." style={{ marginBottom: 20 }}>
            <KeyLabelRows rows={form.siteWorkSubstages} keyMax={5} disabled={!canEdit} keyHint="up to 5 chars" onChange={(rows) => set("siteWorkSubstages", rows)} />
          </Card>

          <Card
            title="Notification priority"
            sub="How loud each notice is for this unit. High-priority notices also pop up as a message the moment they arrive."
            style={{ marginBottom: 20 }}
          >
            {events.length === 0 ? (
              <p className="lede">Loading the notification list…</p>
            ) : (
              <div className="form-grid auto">
                {events.map((event) => (
                  <Field key={event.key} label={event.label} hint={`default ${priorityMeta(event.defaultPriority).label.toLowerCase()}`}>
                    <select
                      value={form.notificationPriorities[event.key] || ""}
                      disabled={!canEdit}
                      onChange={(e) => {
                        const next = { ...form.notificationPriorities };
                        if (e.target.value) next[event.key] = e.target.value;
                        else delete next[event.key];
                        set("notificationPriorities", next);
                      }}
                    >
                      <option value="">Default ({priorityMeta(event.defaultPriority).label})</option>
                      {PRIORITIES.map((key) => (
                        <option key={key} value={key}>
                          {priorityMeta(key).label}
                        </option>
                      ))}
                    </select>
                  </Field>
                ))}
              </div>
            )}
          </Card>

          {canEdit ? (
            <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
              {saving ? "Saving…" : "Save settings"}
            </button>
          ) : null}
        </>
      ) : null}
    </>
  );
}
