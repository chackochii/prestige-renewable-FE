// The full financial workout of an energy proposal, as tables, in the order
// the proposal skill sets: price → incentives → net after incentives →
// Option A / Option B → savings → payback, then the open items. Read-only —
// every figure is the API calculator's.

import Alert from "@/components/Alert";
import Badge from "@/components/Badge";

const money = (v) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v) || 0);
const dollars = (v) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", maximumFractionDigits: 0 }).format(Math.round(Number(v) || 0));
const whole = (v) => new Intl.NumberFormat("en-AU", { maximumFractionDigits: 0 }).format(Math.round(Number(v) || 0));
const BAND = { peak: "Peak", shoulder: "Shoulder", offPeak: "Off-peak", flat: "Single rate" };

function Rows({ rows, head = ["Item", "Amount"] }) {
  return (
    <div className="table-wrap">
      <table className="table compact ep-workout-table">
        <thead>
          <tr>
            <th>{head[0]}</th>
            <th style={{ textAlign: "right" }}>{head[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value, tone], i) => (
            <tr key={i} className={tone ? `ep-row-${tone}` : ""}>
              <td>{label}</td>
              <td style={{ textAlign: "right", whiteSpace: "nowrap" }}>{value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function ProposalWorkout({ result, ai, stale = false }) {
  if (!result) return null;
  const { usage, cost, system, prices, incentives: inc, net, optionA: A, optionB: B, savings: s, payback } = result;
  return (
    <div className="ep-workout">
      {stale ? (
        <Alert tone="info" style={{ marginBottom: 12 }}>
          Showing the figures for your unsaved changes — save to keep them.
        </Alert>
      ) : null}

      <div className="ep-workout-grid">
        <section>
          <h4>Usage (annualised)</h4>
          <Rows
            head={["Measure", "Value"]}
            rows={[
              ["Usage per day", `${usage.kwhPerDay} kWh`],
              ["Usage per year", `${whole(usage.annualKwh)} kWh`],
              ["Based on", usage.annualBasis],
              ...Object.entries(usage.split)
                .filter(([, pct]) => pct > 0)
                .map(([band, pct]) => [`${BAND[band]} share`, `${pct}%`]),
              ["Export per day", `${usage.exportPerDay} kWh`],
              ["Cost per year (current rates)", dollars(cost.total)],
              ["Blended rate", cost.blendedCents ? `${cost.blendedCents} c/kWh` : "—"],
              ...(usage.billedAnnualCost ? [["Cost per year from the bills' totals", dollars(usage.billedAnnualCost)]] : []),
            ]}
          />
        </section>
        <section>
          <h4>System</h4>
          <Rows
            head={["Measure", "Value"]}
            rows={[
              ...(system.nominalKwh ? [["Battery", `${system.nominalKwh} kWh nominal · ${system.usableKwh} kWh usable · ${system.category ?? "—"}`]] : []),
              ...(system.solarKw ? [["New solar", `${system.solarKw} kW${system.panelCount ? ` · ${system.panelCount} panels` : ""}`]] : []),
              ...(system.solarKw ? [["Solar generation", `${whole(s.annualGenerationKwh)} kWh/yr (~${whole(s.yieldPerKwp)} kWh/kWp)`]] : []),
              ...(system.evChargers ? [["EV chargers", system.evChargers]] : []),
              ["Solar-window load", `${s.windowSharePct}% · ${s.windowLoadPerDay} kWh/day`],
              ["Evening + overnight load", `${s.eveningLoadPerDay} kWh/day`],
            ]}
          />
        </section>
      </div>

      <h4>1. Price</h4>
      <Rows
        rows={[
          ...prices.lines.map((l) => [l.label, `${money(l.incGst)}  (${money(l.exGst)} ex GST)`]),
          ["Total system price (incl. GST)", money(prices.totalIncGst), "total"],
          ["GST included", money(prices.gstIncluded)],
        ]}
      />

      <h4>2. Incentives</h4>
      <Rows
        head={["Certificate", "Value"]}
        rows={[
          [`PRCs ${inc.prc.category ?? ""}: ${inc.prc.formula || "no battery"}`, inc.prc.count ? `${whole(inc.prc.count)} × ${money(inc.prc.price)} = ${money(inc.prc.value)}` : "—"],
          [`Battery STCs: ${inc.batteryStc.formula || "—"}`, inc.batteryStc.count ? `${whole(inc.batteryStc.count)} × ${money(inc.batteryStc.price)} = ${money(inc.batteryStc.value)}` : "—"],
          [`Solar STCs: ${inc.solarStc.formula || "—"}`, inc.solarStc.count ? `${whole(inc.solarStc.count)} × ${money(inc.solarStc.price)} = ${money(inc.solarStc.value)}` : "—"],
          ["Total incentives", `– ${money(inc.total)}`, "total"],
        ]}
      />

      <h4>3. Net after incentives</h4>
      <Rows rows={[["Net price (incl. GST)", money(net.incGst), "net"], ["Net price (ex GST)", money(net.exGst)]]} />

      <div className="ep-workout-grid">
        <section>
          <h4>4. Option A — {A.months}-month plan</h4>
          <Rows
            rows={[
              ...(A.financeCost ? [[`Finance (${A.financePct}% of net)`, `+ ${money(A.financeCost)}`]] : []),
              [`Upfront (${A.upfrontPct}%)`, money(A.upfront)],
              [`Months 1–${A.months - 1}`, `${money(A.monthly)} / month`],
              [`Month ${A.months}`, money(A.final)],
              ["GST included", money(A.gstIncluded)],
              ["Total", money(A.total), "net"],
            ]}
          />
        </section>
        <section>
          <h4>Option B — pay outright</h4>
          <Rows
            rows={[
              ...(B.discountPct ? [[`Less ${B.discountPct}% for paying outright`, `– ${money(net.incGst - B.total)}`]] : []),
              ...B.milestones.map((m) => [`${m.label} (${m.pct}%)`, money(m.amount)]),
              ["GST included", money(B.gstIncluded)],
              ["Total", money(B.total), "net"],
            ]}
          />
        </section>
      </div>

      <h4>5. Savings (incl. GST)</h4>
      <Rows
        head={["Saving", "Per year"]}
        rows={[
          ...s.lines.map((l) => [`${l.label}${l.kwh != null ? ` — ${whole(l.kwh)} kWh${l.cents ? ` at ~${l.cents} c` : ""}` : ""}`, `~${dollars(l.value)}`]),
          ...(s.topUpKwh ? [[`Grid top-up from the ${BAND[s.topUpBand]?.toLowerCase() ?? ""} band (netted above)`, `${whole(s.topUpKwh)} kWh`]] : []),
          ["Estimated annual benefit", `~${dollars(s.annualBenefit)}`, "total"],
          ["Average monthly benefit", `~${dollars(s.monthlyBenefit)} (~${dollars(s.monthlyBenefitExGst)} ex GST)`],
          ["Grid energy offset", `~${s.gridOffsetPct}%`],
          ["CO2-e avoided", `~${s.co2Tonnes} t/yr`],
        ]}
      />

      <h4>6. Payback</h4>
      <Rows
        head={["Measure", "Years"]}
        rows={[
          ["Option A (total payable ÷ annual benefit)", payback.optionA ? `~${payback.optionA}` : "—"],
          ["Option B", payback.optionB ? `~${payback.optionB}` : "—", "net"],
          ...(payback.returnPctB ? [["Return a year, paid outright", `~${payback.returnPctB}%`]] : []),
        ]}
      />

      <h4>Open items</h4>
      {result.flags.length || ai?.openItems?.length ? (
        <ul className="ep-flags">
          {result.flags.map((f, i) => (
            <li key={`f${i}`}>
              <Badge tone={f.level === "warning" ? "warning" : "info"}>{f.level === "warning" ? "check" : "note"}</Badge> {f.text}
            </li>
          ))}
          {(ai?.openItems ?? []).map((text, i) => (
            <li key={`a${i}`}>
              <Badge tone="gold">AI</Badge> {text}
            </li>
          ))}
        </ul>
      ) : (
        <p className="row-meta">None.</p>
      )}
      {ai?.workingNotes ? (
        <details style={{ marginTop: 8 }}>
          <summary className="row-meta" style={{ cursor: "pointer" }}>
            How the AI read the bills and chose the system
          </summary>
          <p className="row-meta" style={{ whiteSpace: "pre-wrap" }}>{ai.workingNotes}</p>
        </details>
      ) : null}
    </div>
  );
}
