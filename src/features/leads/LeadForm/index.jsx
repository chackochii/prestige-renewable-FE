// Lead pack form: customer, site, decision-maker, qualification, energy & source.

import { useEffect, useState } from "react";
import { Building2, ClipboardList, MapPin, UserCheck, Zap } from "lucide-react";
import Field from "@/components/Field";
import SectionHead from "@/components/SectionHead";
import NumberInput from "@/components/NumberInput";
import { AU_STATES, QUALIFICATIONS } from "@/constants/stages";
import { commissionTiersFor, leadSourceLabel, LEAD_TYPES, MANUAL_LEAD_SOURCES } from "@/features/leads/leadSourceOptions";
import { isAutomatedSource } from "@/features/leads/leadFormModel";

const SECTIONS = [
  { id: "lf-customer", label: "Customer", icon: Building2 },
  { id: "lf-site", label: "Site", icon: MapPin },
  { id: "lf-contact", label: "Decision-maker", icon: UserCheck },
  { id: "lf-qualification", label: "Qualification", icon: ClipboardList },
  { id: "lf-energy", label: "Energy & source", icon: Zap },
];

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function LeadForm({
  form,
  set,
  errors = {},
  estimators = [],
  sales = [],
  referrers = [],
  unit,
  disabled = false,
  // Qualified is only offered once the record has a logged meeting and site
  // evidence (see helpers/stageTransition.qualificationGateItems).
  allowQualified = true,
  qualifiedHint,
}) {
  const err = (field) => errors[field];
  const [active, setActive] = useState(SECTIONS[0].id);
  const automated = isAutomatedSource(form.leadSource);
  const tiers = commissionTiersFor(unit);
  const qualifiedLocked = !allowQualified && form.qualification !== "qualified";

  useEffect(() => {
    const nodes = SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean);
    if (!nodes.length || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
  }, []);

  const input = (field, props = {}) => (
    <input
      value={form[field]}
      disabled={disabled}
      onChange={(e) => set(field, e.target.value)}
      autoComplete="off"
      {...props}
    />
  );

  return (
    <>
      <div className="form-nav">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className={active === s.id ? "active" : ""}
            onClick={() => {
              setActive(s.id);
              scrollTo(s.id);
            }}
          >
            <s.icon size={13} /> {s.label}
          </button>
        ))}
      </div>

      <div className="section" id="lf-customer">
        <SectionHead icon={<Building2 size={13} />} title="Customer" />
        <div className="form-grid">
          <Field label="Lead type" className="span-2" error={err("leadType")}>
            <select value={form.leadType} disabled={disabled} onChange={(e) => set("leadType", e.target.value)}>
              <option value="">Select</option>
              {LEAD_TYPES.map((t) => (
                <option key={t.key} value={t.key}>
                  {t.label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Legal name" error={err("customerLegalName")}>
            {input("customerLegalName")}
          </Field>
          <Field label="Trading name">{input("customerTradingName")}</Field>
          <Field label="ABN">{input("customerAbn")}</Field>
          <Field label="Phone">{input("customerPhone")}</Field>
          <Field label="Email" className="span-2" error={err("customerEmail")}>
            {input("customerEmail", { type: "email" })}
          </Field>
          <Field label="Billing address" className="span-2">
            {input("customerBillingAddress")}
          </Field>
        </div>
      </div>

      <div className="section" id="lf-site">
        <SectionHead icon={<MapPin size={13} />} title="Site" />
        <div className="form-grid">
          <Field label="Street" className="span-2" error={err("siteLine1")}>
            {input("siteLine1")}
          </Field>
          <Field label="Suburb" error={err("siteSuburb")}>
            {input("siteSuburb")}
          </Field>
          <Field label="State">
            <select
              value={form.siteState}
              disabled={disabled}
              onChange={(e) => {
                set("siteState", e.target.value);
                set("siteJurisdiction", e.target.value);
              }}
            >
              {AU_STATES.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </Field>
          <Field label="Postcode">{input("sitePostcode")}</Field>
          <Field label="Site contact">{input("siteContact")}</Field>
          <Field label="Access notes" className="span-2">
            {input("siteAccessNotes")}
          </Field>
        </div>
      </div>

      <div className="section" id="lf-contact">
        <SectionHead icon={<UserCheck size={13} />} title="Decision-maker" />
        <div className="form-grid">
          <Field label="Name" error={err("contactName")}>
            {input("contactName")}
          </Field>
          <Field label="Role">{input("contactRole")}</Field>
          <Field label="Email" error={err("contactEmail")}>
            {input("contactEmail", { type: "email" })}
          </Field>
          <Field label="Phone">{input("contactPhone")}</Field>
        </div>
      </div>

      <div className="section" id="lf-qualification">
        <SectionHead icon={<ClipboardList size={13} />} title="Qualification" />
        <div className="form-grid">
          <Field
            label="Qualification"
            error={err("qualification")}
            hint={qualifiedLocked ? qualifiedHint || "Qualified unlocks after a client meeting and site evidence" : "Qualified needs an estimator and a next action"}
          >
            <select value={form.qualification} disabled={disabled} onChange={(e) => set("qualification", e.target.value)}>
              {QUALIFICATIONS.map((q) => (
                <option key={q.key} value={q.key} disabled={q.key === "qualified" && qualifiedLocked}>
                  {q.label}
                  {q.key === "qualified" && qualifiedLocked ? " (locked)" : ""}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Opportunity value (ex GST)" error={err("estimatedValue")}>
            <NumberInput value={form.estimatedValue} disabled={disabled} min={0} onChange={(v) => set("estimatedValue", v)} />
          </Field>
          <Field label="Authority / decision-maker">{input("qualificationAuthority")}</Field>
          <Field label="Timing">{input("qualificationTiming", { placeholder: "e.g. This quarter" })}</Field>
          <Field label="Next action" error={err("nextAction")}>
            {input("nextAction")}
          </Field>
          <Field label="Due date" error={err("nextActionDueAt")}>
            {input("nextActionDueAt", { type: "date" })}
          </Field>
        </div>
      </div>

      <div className="section" id="lf-energy">
        <SectionHead icon={<Zap size={13} />} title="Energy & source" />
        <div className="form-grid">
          <Field label="Annual usage (kWh)" hint="or tick bills on file" error={err("energyAnnualKwh")}>
            <NumberInput value={form.energyAnnualKwh} disabled={disabled} min={0} onChange={(v) => set("energyAnnualKwh", v)} />
          </Field>
          <Field label="Electricity bills">
            <label className="check">
              <input
                type="checkbox"
                checked={form.energyHasBills}
                disabled={disabled}
                onChange={(e) => set("energyHasBills", e.target.checked)}
              />
              Bills available on file
            </label>
          </Field>
          <Field label="Energy notes" className="span-2">
            {input("energyNotes")}
          </Field>

          <Field
            label="Lead source"
            error={err("leadSource")}
            hint={automated ? "set by the integration that captured this lead" : undefined}
          >
            {automated ? (
              <input value={leadSourceLabel(form.leadSource)} disabled />
            ) : (
              <select value={form.leadSource} disabled={disabled} onChange={(e) => set("leadSource", e.target.value)}>
                {MANUAL_LEAD_SOURCES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            )}
          </Field>
          {form.leadSource === "referrer" ? (
            <>
              <Field label="Referrer" error={err("referrerId")}>
                <select value={form.referrerId} disabled={disabled} onChange={(e) => set("referrerId", e.target.value)}>
                  <option value="">Select</option>
                  {referrers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.organisation}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Involvement tier">
                <select
                  value={form.involvementTier}
                  disabled={disabled}
                  onChange={(e) => set("involvementTier", e.target.value)}
                >
                  {tiers.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
            </>
          ) : (
            <div />
          )}

          <Field label="Assign estimator" hint="required to leave qualification" error={err("estimatorId")}>
            <select value={form.estimatorId} disabled={disabled} onChange={(e) => set("estimatorId", e.target.value)}>
              <option value="">Select estimator</option>
              {estimators.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                  {u.title ? ` · ${u.title}` : ""}
                </option>
              ))}
            </select>
            {estimators.length === 0 ? (
              <span className="field-error">No one in this unit can be assigned yet. Add users in Admin.</span>
            ) : null}
          </Field>
          <Field label="Salesperson">
            <select value={form.salespersonId} disabled={disabled} onChange={(e) => set("salespersonId", e.target.value)}>
              <option value="">Later</option>
              {sales.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Notes" className="span-2">
            <textarea rows={3} value={form.notes} disabled={disabled} onChange={(e) => set("notes", e.target.value)} />
          </Field>
        </div>
      </div>
    </>
  );
}
