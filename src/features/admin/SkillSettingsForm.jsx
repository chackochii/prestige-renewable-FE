// The calculator settings of an AI skill, as a form: company details for the
// PDF, the products and their prices, the incentive rules, finance and the
// savings assumptions. The API validates and merges them over its defaults;
// this form only edits the object (`value`) and hands back a new one.

import { Plus, Trash2 } from "lucide-react";
import Field from "@/components/Field";
import NumberInput from "@/components/NumberInput";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const KINDS = ["battery", "solar", "inverter", "ev", "other"];

/** A copy of `obj` with the value at `path` (["incentives", "prcPrice"]) replaced. */
function setIn(obj, path, value) {
  const [head, ...rest] = path;
  const copy = Array.isArray(obj) ? [...obj] : { ...(obj ?? {}) };
  copy[head] = rest.length ? setIn(copy[head], rest, value) : value;
  return copy;
}
const getIn = (obj, path) => path.reduce((o, k) => (o == null ? undefined : o[k]), obj);

function Section({ title, hint, children }) {
  return (
    <section className="skill-settings-section">
      <h3>{title}</h3>
      {hint ? <p className="row-meta" style={{ marginTop: -6, marginBottom: 12 }}>{hint}</p> : null}
      {children}
    </section>
  );
}

export default function SkillSettingsForm({ value, onChange, disabled = false }) {
  const set = (path, v) => onChange(setIn(value, path, v));
  const num = (label, path, { step = "any", hint } = {}) => (
    <Field label={label} hint={hint}>
      <NumberInput value={getIn(value, path)} onChange={(v) => set(path, v === "" ? 0 : v)} step={step} disabled={disabled} />
    </Field>
  );
  const text = (label, path, { hint, span } = {}) => (
    <Field label={label} hint={hint} className={span ? "span-2" : ""}>
      <input value={getIn(value, path) ?? ""} onChange={(e) => set(path, e.target.value)} disabled={disabled} />
    </Field>
  );

  const products = value.products ?? [];
  const inc = value.incentives ?? {};
  const fin = value.finance ?? {};
  const sav = value.savings ?? {};
  const milestoneTotal = (fin.milestones ?? []).reduce((s, m) => s + (Number(m.pct) || 0), 0);

  const tierTable = (path, cols) => {
    const rows = getIn(value, path) ?? [];
    return (
      <div className="table-wrap">
        <table className="table compact">
          <thead>
            <tr>
              {cols.map((c) => (
                <th key={c.key}>{c.label}</th>
              ))}
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {cols.map((c) => (
                  <td key={c.key}>
                    <NumberInput value={row[c.key]} onChange={(v) => set([...path, i, c.key], v === "" ? 0 : v)} step="any" disabled={disabled} />
                  </td>
                ))}
                <td style={{ textAlign: "right" }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => set(path, rows.filter((_, j) => j !== i))} disabled={disabled || rows.length <= 1} aria-label="Remove tier">
                    <Trash2 size={14} />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => set(path, [...rows, Object.fromEntries(cols.map((c) => [c.key, 0]))])} disabled={disabled}>
          <Plus size={14} /> Tier
        </button>
      </div>
    );
  };

  return (
    <div className="skill-settings">
      <Section title="Company on the proposal" hint="Printed on the proposal's header, footer and back page. Prepared by is the salesperson unless a name is set here.">
        <div className="form-grid">
          {text("Company name", ["company", "name"])}
          {text("ABN", ["company", "abn"])}
          {text("Email", ["company", "email"])}
          {text("Website", ["company", "website"])}
          {text("Address", ["company", "address"], { span: true })}
          {text("Prepared by (optional)", ["company", "preparedBy"])}
          {num("Valid for (days)", ["quote", "validityDays"], { step: 1 })}
          {text("Quote number prefix", ["quote", "prefix"])}
          {text("Quote number suffix", ["quote", "suffix"])}
          {num("GST %", ["gstRatePct"])}
        </div>
      </Section>

      <Section title="Products and prices" hint="AUD ex GST. A proposal copies the product's price when it is chosen; the estimator can change it on the proposal.">
        <div className="table-wrap">
          <table className="table compact stack">
            <thead>
              <tr>
                <th>Kind</th>
                <th>Name</th>
                <th>kWh</th>
                <th>kW</th>
                <th>Panel W</th>
                <th>Price ex GST</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {products.map((p, i) => (
                <tr key={p.key || i}>
                  <td data-label="Kind">
                    <select value={p.kind} onChange={(e) => set(["products", i, "kind"], e.target.value)} disabled={disabled}>
                      {KINDS.map((k) => (
                        <option key={k} value={k}>
                          {k}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td data-label="Name" style={{ minWidth: 220 }}>
                    <input value={p.name ?? ""} onChange={(e) => set(["products", i, "name"], e.target.value)} disabled={disabled} />
                    <textarea
                      rows={2}
                      style={{ marginTop: 6 }}
                      placeholder="Description lines on the equipment card, one per line"
                      value={(p.description ?? []).join("\n")}
                      onChange={(e) => set(["products", i, "description"], e.target.value.split("\n"))}
                      disabled={disabled}
                    />
                    <div className="row-meta">key: {p.key}</div>
                  </td>
                  <td data-label="kWh">
                    {p.kind === "battery" ? <NumberInput value={p.nominalKwh} onChange={(v) => set(["products", i, "nominalKwh"], v)} step="any" disabled={disabled} /> : "—"}
                  </td>
                  <td data-label="kW">
                    <NumberInput value={p.kind === "battery" ? p.inverterKw : p.kw} onChange={(v) => set(["products", i, p.kind === "battery" ? "inverterKw" : "kw"], v)} step="any" disabled={disabled} />
                  </td>
                  <td data-label="Panel W">
                    {p.kind === "solar" ? <NumberInput value={p.panelWatts} onChange={(v) => set(["products", i, "panelWatts"], v)} step="any" disabled={disabled} /> : "—"}
                  </td>
                  <td data-label="Price ex GST">
                    <NumberInput value={p.priceExGst} onChange={(v) => set(["products", i, "priceExGst"], v === "" ? 0 : v)} step="any" disabled={disabled} />
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => set(["products"], products.filter((_, j) => j !== i))} disabled={disabled} aria-label="Remove product">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          disabled={disabled}
          onClick={() => set(["products"], [...products, { key: `product_${Date.now().toString(36)}`, kind: "battery", name: "", nominalKwh: 0, inverterKw: 0, priceExGst: 0, description: [] }])}
        >
          <Plus size={14} /> Product
        </button>
      </Section>

      <Section title="Incentives" hint="PRCs = FLOOR(DSC kW × hours × years × network loss factor × multiplier). Zero PRCs unless new solar is at least the minimum share of usable capacity.">
        <div className="form-grid auto">
          {num("PRC price ($)", ["incentives", "prcPrice"])}
          {num("STC price ($)", ["incentives", "stcPrice"])}
          {num("Usable fraction of nominal", ["incentives", "usableFraction"])}
          {num("Min new solar ÷ usable", ["incentives", "minSolarToUsableRatio"])}
          {num("PRC hours", ["incentives", "prcHours"])}
          {num("PRC years", ["incentives", "prcYears"])}
          {num("PRC multiplier", ["incentives", "prcMultiplier"])}
          {num("Min client contribution ex GST ($)", ["incentives", "minClientContributionExGst"])}
        </div>
        <h4>Network loss factors</h4>
        <div className="form-grid auto">
          {Object.keys(inc.nlf ?? {}).map((network) => (
            <Field key={network} label={network}>
              <NumberInput value={inc.nlf[network]} onChange={(v) => set(["incentives", "nlf", network], v === "" ? 0 : v)} step="any" disabled={disabled} />
            </Field>
          ))}
          {num("Any other network", ["incentives", "defaultNlf"])}
        </div>
        <h4>BESS4 — tiered demand-shifting component (usable kWh → kW)</h4>
        <div className="form-grid auto">
          {num("Smallest usable kWh", ["incentives", "bess4", "minUsableKwh"])}
          {num("Largest usable kWh", ["incentives", "bess4", "maxUsableKwh"])}
          {num("DSC decimals", ["incentives", "bess4", "dscDecimals"], { step: 1 })}
        </div>
        {tierTable(["incentives", "bess4", "tiers"], [
          { key: "fromKwh", label: "From kWh" },
          { key: "toKwh", label: "To kWh" },
          { key: "kwPerKwh", label: "kW per kWh" },
        ])}
        <h4>BESS5 and battery STCs</h4>
        <div className="form-grid auto">
          {num("BESS5 kW per usable kWh", ["incentives", "bess5", "kwPerKwh"])}
          {num("Battery STC factor", ["incentives", "batteryStc", "factor"])}
          {num("Battery STCs up to (kWh nominal)", ["incentives", "batteryStc", "maxNominalKwh"])}
        </div>
        {tierTable(["incentives", "batteryStc", "tiers"], [
          { key: "fromKwh", label: "From kWh" },
          { key: "toKwh", label: "To kWh" },
          { key: "share", label: "Share counted" },
        ])}
        <h4>Solar STCs = FLOOR(kW × zone factor × deeming years)</h4>
        <div className="form-grid auto">
          {num("Deeming years", ["incentives", "solarStc", "deemingYears"])}
          {num("STC limit (kW)", ["incentives", "solarStc", "maxKw"])}
          {num("Default zone", ["incentives", "solarStc", "defaultZone"], { step: 1 })}
          {Object.keys(inc.solarStc?.zones ?? {}).map((zone) => (
            <Field key={zone} label={`Zone ${zone} factor`}>
              <NumberInput value={inc.solarStc.zones[zone]} onChange={(v) => set(["incentives", "solarStc", "zones", zone], v === "" ? 0 : v)} step="any" disabled={disabled} />
            </Field>
          ))}
        </div>
      </Section>

      <Section title="Finance and payment options" hint="Separate on net: the plan adds a finance line to the net price. Uplift: the finance % is added to battery and solar prices, and paying outright takes a discount.">
        <div className="form-grid auto">
          <Field label="Finance mode">
            <select value={fin.mode} onChange={(e) => set(["finance", "mode"], e.target.value)} disabled={disabled}>
              <option value="separate_on_net">Separate on net (default)</option>
              <option value="uplift">Uplift</option>
            </select>
          </Field>
          {num("Finance %", ["finance", "financePct"])}
          {num("Upfront %", ["finance", "upfrontPct"])}
          {num("Months", ["finance", "months"], { step: 1 })}
          {num("Outright discount % (uplift)", ["finance", "outrightDiscountPct"])}
        </div>
        <h4>Option B milestones {milestoneTotal !== 100 ? <span className="field-error"> · they add up to {milestoneTotal}%, not 100%</span> : null}</h4>
        {(fin.milestones ?? []).map((m, i) => (
          <div key={i} className="skill-inline-row">
            <input value={m.label} onChange={(e) => set(["finance", "milestones", i, "label"], e.target.value)} disabled={disabled} />
            <NumberInput value={m.pct} onChange={(v) => set(["finance", "milestones", i, "pct"], v === "" ? 0 : v)} step="any" disabled={disabled} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => set(["finance", "milestones"], fin.milestones.filter((_, j) => j !== i))} disabled={disabled || fin.milestones.length <= 1} aria-label="Remove milestone">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => set(["finance", "milestones"], [...(fin.milestones ?? []), { label: "", pct: 0 }])} disabled={disabled}>
          <Plus size={14} /> Milestone
        </button>
      </Section>

      <Section title="Savings model" hint="Month by month: solar used in the solar window, the battery storing the surplus and discharging in the evening, spare capacity topped up from the cheapest band for peak-rate energy, the rest exported.">
        <div className="form-grid auto">
          {num("Solar-window load % of import", ["savings", "solarWindowSharePct"])}
          {num("Battery round trip %", ["savings", "batteryEfficiencyPct"])}
          {num("Emissions (kg CO2-e per kWh)", ["savings", "emissionsKgPerKwh"])}
          <Field label="Battery discharge">
            <select value={sav.dischargeOrder} onChange={(e) => set(["savings", "dischargeOrder"], e.target.value)} disabled={disabled}>
              <option value="peak_first">Peak first, then shoulder, then off-peak</option>
              <option value="pro_rata">Spread across the evening bands</option>
            </select>
          </Field>
          <Field label="Peak top-up from the grid">
            <select value={sav.peakTopUp ? "yes" : "no"} onChange={(e) => set(["savings", "peakTopUp"], e.target.value === "yes")} disabled={disabled}>
              <option value="yes">Yes — only for peak-rate energy</option>
              <option value="no">No</option>
            </select>
          </Field>
        </div>
        <h4>Solar yield, kWh per kWp each month (total {Math.round((sav.yieldProfile ?? []).reduce((a, b) => a + (Number(b) || 0), 0))} a year)</h4>
        <div className="skill-months">
          {MONTHS.map((m, i) => (
            <Field key={m} label={m}>
              <NumberInput value={sav.yieldProfile?.[i]} onChange={(v) => set(["savings", "yieldProfile", i], v === "" ? 0 : v)} step="any" disabled={disabled} />
            </Field>
          ))}
        </div>
        <h4>EV revenue = chargers × kW × hours × days × weeks × margin</h4>
        <div className="form-grid auto">
          {num("Charger kW", ["savings", "ev", "kwEach"])}
          {num("Hours a day", ["savings", "ev", "hoursPerDay"])}
          {num("Days a week", ["savings", "ev", "daysPerWeek"])}
          {num("Weeks a year", ["savings", "ev", "weeksPerYear"])}
          {num("Net margin ($/kWh)", ["savings", "ev", "marginPerKwh"])}
        </div>
      </Section>

      <Section title="Exclusions" hint="The exclusions table on every proposal. {network} is replaced by the site's network.">
        {(value.exclusions ?? []).map((x, i) => (
          <div key={i} className="skill-inline-row wide">
            <input value={x.title} onChange={(e) => set(["exclusions", i, "title"], e.target.value)} disabled={disabled} />
            <textarea rows={2} value={x.body} onChange={(e) => set(["exclusions", i, "body"], e.target.value)} disabled={disabled} />
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => set(["exclusions"], value.exclusions.filter((_, j) => j !== i))} disabled={disabled} aria-label="Remove exclusion">
              <Trash2 size={14} />
            </button>
          </div>
        ))}
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => set(["exclusions"], [...(value.exclusions ?? []), { title: "", body: "" }])} disabled={disabled}>
          <Plus size={14} /> Exclusion
        </button>
      </Section>
    </div>
  );
}
