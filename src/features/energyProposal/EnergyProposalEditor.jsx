// One energy proposal, open for review: the workout first (as the skill asks
// — confirm the figures before any document), then everything the figures and
// the PDF come from: the bills and tariff, the system and prices, the words,
// the quote details. Edits are recalculated live (POST …/calculate, nothing
// saved) and kept with Save. A final proposal is read-only; changing it means
// a new revision. Marking it final saves it as the next version of the job's
// quote — the version sales sends the customer at the proposal stage.

import { useEffect, useMemo, useState } from "react";
import { Download, Eye, FileCheck2, FilePlus2, Lock, Plus, RefreshCw, Save, Sparkles, Trash2, Upload } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Field from "@/components/Field";
import Modal from "@/components/Modal";
import NumberInput from "@/components/NumberInput";
import Tabs from "@/components/Tabs";
import LoadingState from "@/components/LoadingState";
import ProposalWorkout from "./ProposalWorkout";
import { downloadEnergyProposal, energyProposalBlob, energyProposalFileName, energyProposalPreviewUrl } from "@/helpers/energyProposalPdf";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useNotifications } from "@/hooks/useNotifications";
import { useAppDispatch } from "@/store";
import { fetchQuoteVersions } from "@/slices/leadsSlice";
import {
  deleteEnergyProposal,
  draftEnergyProposalWithAi,
  finaliseEnergyProposal,
  previewEnergyProposal,
  reviseEnergyProposal,
  rewriteEnergyProposalText,
  saveEnergyProposalPdf,
  updateEnergyProposal,
} from "@/slices/energyProposalsSlice";

const errText = (err, fallback) => (typeof err === "string" ? err : err?.message || fallback);
const money = (v) => new Intl.NumberFormat("en-AU", { style: "currency", currency: "AUD", minimumFractionDigits: 2 }).format(Number(v) || 0);
const NETWORKS = ["Ausgrid", "Endeavour Energy", "Essential Energy"];
const blankPeriod = () => ({ label: "", days: "", peakKwh: "", shoulderKwh: "", offPeakKwh: "", flatKwh: "", exportKwh: "", totalIncGst: "" });
/** Lines typed one per row ↔ the list the API keeps. */
const linesText = (list) => (Array.isArray(list) ? list.join("\n") : "");
const textLines = (value) =>
  String(value ?? "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

/** A copy of `obj` with `path` set to `value`. */
function setIn(obj, path, value) {
  const [head, ...rest] = path;
  const copy = Array.isArray(obj) ? [...obj] : { ...(obj ?? {}) };
  copy[head] = rest.length ? setIn(copy[head], rest, value) : value;
  return copy;
}

export default function EnergyProposalEditor({ opp, proposal, options, canEdit, onClose }) {
  const dispatch = useAppDispatch();
  const { notify } = useNotifications();
  const locked = proposal.status === "final" || !canEdit;
  const [tab, setTab] = useState("workout");
  const [input, setInput] = useState(proposal.input);
  const [narrative, setNarrative] = useState(proposal.narrative ?? {});
  const [meta, setMeta] = useState({ title: proposal.title ?? "", number: proposal.number, preparedOn: proposal.preparedOn ?? "", validUntil: proposal.validUntil ?? "" });
  const [preview, setPreview] = useState(null); // live result for unsaved input
  const [busy, setBusy] = useState(null); // what is running: "save" | "pdf" | "ai" | …
  const [pdfUrl, setPdfUrl] = useState(null);
  const [aiText, setAiText] = useState("");
  const [confirm, setConfirm] = useState(null); // "final" | "delete" | "redraft"

  // A fresh copy of the proposal (after any save) resets the editor.
  useEffect(() => {
    setInput(proposal.input);
    setNarrative(proposal.narrative ?? {});
    setMeta({ title: proposal.title ?? "", number: proposal.number, preparedOn: proposal.preparedOn ?? "", validUntil: proposal.validUntil ?? "" });
    setPreview(null);
  }, [proposal]);

  const inputDirty = useMemo(() => JSON.stringify(input) !== JSON.stringify(proposal.input), [input, proposal.input]);
  const narrativeDirty = useMemo(() => JSON.stringify(narrative) !== JSON.stringify(proposal.narrative ?? {}), [narrative, proposal.narrative]);
  const metaDirty = meta.title !== (proposal.title ?? "") || meta.number !== proposal.number || meta.preparedOn !== (proposal.preparedOn ?? "") || meta.validUntil !== (proposal.validUntil ?? "");
  const dirty = inputDirty || narrativeDirty || metaDirty;

  // Live figures while the input is being changed.
  const debouncedInput = useDebouncedValue(input, 600);
  useEffect(() => {
    if (locked || JSON.stringify(debouncedInput) === JSON.stringify(proposal.input)) {
      setPreview(null);
      return;
    }
    let cancelled = false;
    dispatch(previewEnergyProposal({ oppId: opp.id, body: { input: debouncedInput } }))
      .unwrap()
      .then((data) => !cancelled && setPreview(data.result))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [debouncedInput, proposal.input, locked, dispatch, opp.id]);

  useEffect(() => () => pdfUrl && URL.revokeObjectURL(pdfUrl), [pdfUrl]);

  const result = preview ?? proposal.result;
  const set = (path, value) => setInput((prev) => setIn(prev, path, value === "" ? null : value));
  const products = options?.settings?.products ?? [];

  const run = async (key, fn, success) => {
    setBusy(key);
    try {
      await fn();
      if (success) notify(success);
    } catch (err) {
      notify(errText(err, "Something went wrong."), "danger");
    } finally {
      setBusy(null);
    }
  };

  const save = () =>
    run(
      "save",
      () =>
        dispatch(
          updateEnergyProposal({
            oppId: opp.id,
            id: proposal.id,
            body: {
              ...(inputDirty ? { input } : {}),
              ...(narrativeDirty ? { narrative: { ...narrativeKeysCleared(proposal.narrative, narrative), ...narrative } } : {}),
              ...(metaDirty ? meta : {}),
            },
          }),
        ).unwrap(),
      "Proposal saved",
    );

  const showPdf = () =>
    run("pdf", async () => {
      const url = await energyProposalPreviewUrl(proposal);
      setPdfUrl(url);
    });

  const filePdf = () =>
    run(
      "file",
      async () => {
        const blob = await energyProposalBlob(proposal);
        await dispatch(saveEnergyProposalPdf({ oppId: opp.id, id: proposal.id, blob, filename: energyProposalFileName(proposal) })).unwrap();
      },
      "PDF saved to the job's documents",
    );

  const productPick = (kind, key) => {
    const product = products.find((p) => p.key === key);
    if (!product) return;
    if (kind === "battery")
      setInput((prev) =>
        setIn(prev, ["system", "battery"], { productKey: product.key, name: product.name, shortName: product.shortName ?? null, nominalKwh: product.nominalKwh, inverterKw: product.inverterKw ?? null, quantity: 1, priceExGst: product.priceExGst, lineLabel: product.lineLabel ?? null, specLabel: product.specLabel ?? null, description: product.description ?? [] }),
      );
    if (kind === "solar")
      setInput((prev) =>
        setIn(prev, ["system", "solar"], { productKey: product.key, name: product.name, kw: product.kw, panelWatts: product.panelWatts, panelCount: product.panelWatts ? Math.floor((product.kw * 1000) / product.panelWatts) : null, priceExGst: product.priceExGst, description: product.description ?? [] }),
      );
    if (kind === "ev") setInput((prev) => setIn(prev, ["system", "ev"], { productKey: product.key, name: product.name, chargers: prev.system?.ev?.chargers || 2, kwEach: product.kw, priceEachExGst: product.priceExGst }));
  };

  const num = (label, path, { hint, step = "any", suffix } = {}) => (
    <Field label={suffix ? `${label} (${suffix})` : label} hint={hint}>
      <NumberInput value={path.reduce((o, k) => (o == null ? undefined : o[k]), input) ?? ""} onChange={(v) => set(path, v)} step={step} disabled={locked} />
    </Field>
  );
  const text = (label, path, { hint, span, placeholder } = {}) => (
    <Field label={label} hint={hint} className={span ? "span-2" : ""}>
      <input value={path.reduce((o, k) => (o == null ? undefined : o[k]), input) ?? ""} onChange={(e) => set(path, e.target.value)} disabled={locked} placeholder={placeholder} />
    </Field>
  );

  const sys = input.system ?? {};
  const periods = input.periods ?? [];

  return (
    <div className="card card-pad ep-editor">
      <div className="ep-editor-head">
        <div>
          <div className="row-title" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            {proposal.number}
            {proposal.revision > 1 ? <Badge tone="info">rev {proposal.revision}</Badge> : null}
            <Badge tone={proposal.status === "final" ? "success" : "warning"}>{proposal.status}</Badge>
            {proposal.title}
          </div>
          <div className="row-meta">
            Net {money(result.net.incGst)} incl. GST · ~{money(result.savings.annualBenefit).replace(/\.\d+$/, "")}/yr benefit · payback ~{result.payback.optionA ?? "—"} / ~{result.payback.optionB ?? "—"} yrs
            {proposal.skill ? ` · skill v${proposal.skill.version}` : ""}
            {proposal.pdf ? " · PDF on the job" : ""}
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onClose} disabled={busy !== null}>
          Back to proposals
        </button>
      </div>

      {proposal.status === "final" ? (
        <Alert tone="success" style={{ margin: "12px 0" }}>
          <Lock size={14} /> Final — finalised {proposal.finalisedBy ? `by ${proposal.finalisedBy.name} ` : ""}
          {proposal.finalisedAt ? new Date(proposal.finalisedAt).toLocaleDateString("en-AU") : ""}.{" "}
          {proposal.quoteVersion
            ? `Saved as quote version ${proposal.quoteVersion.version} — this PDF is what goes to the customer when the job is sent to proposal.`
            : ""}{" "}
          To change it, make a new revision.
        </Alert>
      ) : null}

      <div className="ep-actions">
        {!locked ? (
          <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={!dirty || busy !== null}>
            <Save size={14} /> {busy === "save" ? "Saving…" : "Save"}
          </button>
        ) : null}
        <button type="button" className="btn btn-ghost btn-sm" onClick={showPdf} disabled={dirty || busy !== null} title={dirty ? "Save first — the PDF is built from the saved proposal" : undefined}>
          <Eye size={14} /> {busy === "pdf" ? "Building…" : "Preview PDF"}
        </button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => run("download", () => downloadEnergyProposal(proposal))} disabled={dirty || busy !== null}>
          <Download size={14} /> Download PDF
        </button>
        {canEdit ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={filePdf} disabled={dirty || busy !== null}>
            <Upload size={14} /> {busy === "file" ? "Saving…" : "Save PDF to job"}
          </button>
        ) : null}
        {!locked ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirm("final")} disabled={dirty || busy !== null}>
            <FileCheck2 size={14} /> Mark final
          </button>
        ) : null}
        {canEdit && proposal.status === "final" ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => run("revise", () => dispatch(reviseEnergyProposal({ oppId: opp.id, id: proposal.id })).unwrap(), "New revision started")} disabled={busy !== null}>
            <FilePlus2 size={14} /> New revision
          </button>
        ) : null}
        {!locked && options?.aiConfigured ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setConfirm("redraft")} disabled={busy !== null}>
            <RefreshCw size={14} /> Redraft with AI
          </button>
        ) : null}
        {!locked ? (
          <button type="button" className="btn btn-danger btn-sm" onClick={() => setConfirm("delete")} disabled={busy !== null}>
            <Trash2 size={14} />
          </button>
        ) : null}
      </div>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: "workout", label: "Workout", count: result.flags.length || undefined },
          { key: "bills", label: "Bills & tariff" },
          { key: "system", label: "System & prices" },
          { key: "words", label: "Words" },
          { key: "details", label: "Quote details" },
        ]}
      />

      {tab === "workout" ? <ProposalWorkout result={result} ai={proposal.ai} stale={Boolean(preview)} /> : null}

      {tab === "bills" ? (
        <div className="panel">
          <h4>Client and site</h4>
          <div className="form-grid">
            {text("Client (legal name)", ["client", "name"])}
            {text("ABN", ["client", "abn"])}
            {text("Site — supply address from the bill", ["site", "address"], { span: true })}
            {text("NMI", ["site", "nmi"])}
            <Field label="Network (DNSP)">
              <input list="ep-networks" value={input.site?.network ?? ""} onChange={(e) => set(["site", "network"], e.target.value)} disabled={locked} />
              <datalist id="ep-networks">
                {NETWORKS.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </Field>
            {text("Retailer", ["site", "retailer"])}
            {text("Tariff / plan", ["site", "tariffName"])}
            {num("STC zone", ["site", "stcZone"], { step: 1, hint: "NSW coast = 3" })}
          </div>

          <h4>Bill periods</h4>
          <div className="table-wrap">
            <table className="table compact">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Days</th>
                  <th>Peak kWh</th>
                  <th>Shoulder kWh</th>
                  <th>Off-peak kWh</th>
                  <th>Flat kWh</th>
                  <th>Export kWh</th>
                  <th>Total incl. GST</th>
                  <th title="Comparison rows only: the period's total kWh">Total kWh</th>
                  <th title="The bill's same period last year — shown in the table (marked *), not counted in the usage">Last year*</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {periods.map((p, i) => (
                  <tr key={i}>
                    <td style={{ minWidth: 110 }}>
                      <input value={p.label ?? ""} onChange={(e) => set(["periods", i, "label"], e.target.value)} disabled={locked} placeholder="Jul 2026" />
                    </td>
                    {["days", "peakKwh", "shoulderKwh", "offPeakKwh", "flatKwh", "exportKwh", "totalIncGst", "totalKwh"].map((k) => (
                      <td key={k} style={{ minWidth: 80 }}>
                        <NumberInput value={p[k] ?? ""} onChange={(v) => set(["periods", i, k], v)} step="any" disabled={locked} />
                      </td>
                    ))}
                    <td style={{ textAlign: "center" }}>
                      <input type="checkbox" checked={p.comparison === true} onChange={(e) => set(["periods", i, "comparison"], e.target.checked || null)} disabled={locked} aria-label="Same period last year" />
                    </td>
                    <td>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setInput((prev) => ({ ...prev, periods: prev.periods.filter((_, j) => j !== i) }))} disabled={locked} aria-label="Remove period">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!locked ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setInput((prev) => ({ ...prev, periods: [...(prev.periods ?? []), blankPeriod()] }))}>
              <Plus size={14} /> Period
            </button>
          ) : null}
          <div className="form-grid" style={{ marginTop: 12 }}>
            {num("Annual usage instead of annualising", ["annualKwhOverride"], { suffix: "kWh", hint: "e.g. from a 12-month chart" })}
            {text("Annual usage based on", ["annualKwhBasis"], { placeholder: "the 12-month usage chart on the invoice" })}
            <Field label="Bill note (printed under the bills table)" className="span-2">
              <textarea rows={2} value={input.billNote ?? ""} onChange={(e) => set(["billNote"], e.target.value)} disabled={locked} />
            </Field>
          </div>

          <h4>Tariff (c/kWh as the bill prints it, after discounts)</h4>
          <label className="row-meta" style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 8 }}>
            <input type="checkbox" checked={input.tariff?.ratesExGst === true} onChange={(e) => set(["tariff", "ratesExGst"], e.target.checked || null)} disabled={locked} />
            The rates are ex GST (most business bills) — GST is added to every dollar figure
          </label>
          <div className="form-grid auto">
            {num("Peak", ["tariff", "peakCents"])}
            {num("Shoulder", ["tariff", "shoulderCents"])}
            {num("Off-peak", ["tariff", "offPeakCents"])}
            {num("Single rate", ["tariff", "flatCents"])}
            {num("Supply (c/day)", ["tariff", "supplyCentsPerDay"])}
            {num("Feed-in", ["tariff", "feedInCents"])}
            {text("Peak window", ["tariff", "peakWindow"], { placeholder: "4–8pm weekdays" })}
            {text("Shoulder window", ["tariff", "shoulderWindow"], { placeholder: "10am–2pm" })}
          </div>
          <div className="form-grid" style={{ marginTop: 12 }}>
            {text("Where the rates come from", ["tariff", "ratesNote"], { span: true, placeholder: "AGL Smart Saver rates on the Sep 2026 invoice" })}
            {text("Demand charge (if any)", ["tariff", "demandNote"], { span: true, placeholder: "e.g. EA302 demand $0.35/kVA/day" })}
          </div>
        </div>
      ) : null}

      {tab === "system" ? (
        <div className="panel">
          <h4>Battery</h4>
          <div className="form-grid auto">
            <Field label="Product">
              <select value={sys.battery?.productKey ?? ""} onChange={(e) => (e.target.value === "none" ? set(["system", "battery"], null) : productPick("battery", e.target.value))} disabled={locked}>
                <option value="">{sys.battery ? "Custom" : "— choose —"}</option>
                {products
                  .filter((p) => p.kind === "battery")
                  .map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.name} ({p.nominalKwh} kWh)
                    </option>
                  ))}
                <option value="none">No battery</option>
              </select>
            </Field>
            {sys.battery || !locked ? (
              <>
                {text("Model", ["system", "battery", "name"])}
                {num("Nominal", ["system", "battery", "nominalKwh"], { suffix: "kWh" })}
                {num("Built-in inverter / PCS", ["system", "battery", "inverterKw"], { suffix: "kW" })}
                {num("Quantity", ["system", "battery", "quantity"], { step: 1 })}
                {num("Price ex GST", ["system", "battery", "priceExGst"], { suffix: "$" })}
              </>
            ) : null}
          </div>
          {sys.battery ? (
            <div className="form-grid" style={{ marginTop: 10 }}>
              {text("Specification (brand / model column)", ["system", "battery", "specLabel"], { span: true, placeholder: "StarCharge eBOX 261 kWh all-in-one commercial BESS with energy controller (ECC)" })}
              <Field label="Key equipment card lines" hint="one per line" className="span-2">
                <textarea rows={3} value={linesText(sys.battery.description)} onChange={(e) => set(["system", "battery", "description"], textLines(e.target.value))} disabled={locked} />
              </Field>
            </div>
          ) : null}

          <h4>Solar</h4>
          <div className="form-grid auto">
            <Field label="Product">
              <select value={sys.solar?.productKey ?? ""} onChange={(e) => (e.target.value === "none" ? set(["system", "solar"], null) : productPick("solar", e.target.value))} disabled={locked}>
                <option value="">{sys.solar ? "Custom" : "— choose —"}</option>
                {products
                  .filter((p) => p.kind === "solar")
                  .map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.kw} kW — {p.name}
                    </option>
                  ))}
                <option value="none">No solar</option>
              </select>
            </Field>
            {text("Panel model", ["system", "solar", "name"])}
            {num("Array", ["system", "solar", "kw"], { suffix: "kW" })}
            {num("Panel", ["system", "solar", "panelWatts"], { suffix: "W" })}
            {num("Panels", ["system", "solar", "panelCount"], { step: 1 })}
            {num("Price ex GST", ["system", "solar", "priceExGst"], { suffix: "$" })}
            {text("Mounting", ["system", "solar", "mounting"], { placeholder: "rooftop / canopy" })}
          </div>
          {sys.solar ? (
            <div className="form-grid" style={{ marginTop: 10 }}>
              {text("Specification (brand / model column)", ["system", "solar", "specLabel"], { span: true, placeholder: "Trina Solar Vertex S+ TSM-NEG9RH.28 475 W" })}
            </div>
          ) : null}

          <h4>Inverter (when it is not the battery's own)</h4>
          <div className="form-grid auto">
            {text("Model", ["system", "inverter", "name"], { placeholder: "GoodWe C&I String Inverter, 110 kW" })}
            <Field label="Type">
              <select value={sys.inverter?.type ?? ""} onChange={(e) => set(["system", "inverter", "type"], e.target.value)} disabled={locked}>
                <option value="">—</option>
                <option value="string">String</option>
                <option value="hybrid">Hybrid</option>
              </select>
            </Field>
            {num("Rated output", ["system", "inverter", "kw"], { suffix: "kW" })}
            {num("Quantity", ["system", "inverter", "quantity"], { step: 1 })}
            {num("Price ex GST", ["system", "inverter", "priceExGst"], { suffix: "$", hint: "0 = in the solar price" })}
            {!locked && sys.inverter ? (
              <Field label=" ">
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => set(["system", "inverter"], null)}>
                  Remove inverter
                </button>
              </Field>
            ) : null}
          </div>
          {sys.inverter ? (
            <div className="form-grid" style={{ marginTop: 10 }}>
              {text("Specification (brand / model column)", ["system", "inverter", "specLabel"], { span: true, placeholder: "GoodWe GW110K-GT three-phase string inverter, AS/NZS 4777.2:2020" })}
              <Field label="Key equipment card lines" hint="one per line" className="span-2">
                <textarea rows={2} value={linesText(sys.inverter.description)} onChange={(e) => set(["system", "inverter", "description"], textLines(e.target.value))} disabled={locked} placeholder={"Three-phase string inverter\nSolar AC-coupled with the battery"} />
              </Field>
            </div>
          ) : null}

          <h4>EV charging</h4>
          <div className="form-grid auto">
            <Field label="Product">
              <select value={sys.ev?.productKey ?? ""} onChange={(e) => (e.target.value === "none" ? set(["system", "ev"], null) : productPick("ev", e.target.value))} disabled={locked}>
                <option value="">{sys.ev ? "Custom" : "— none —"}</option>
                {products
                  .filter((p) => p.kind === "ev")
                  .map((p) => (
                    <option key={p.key} value={p.key}>
                      {p.name}
                    </option>
                  ))}
                <option value="none">No EV chargers</option>
              </select>
            </Field>
            {num("Chargers", ["system", "ev", "chargers"], { step: 1 })}
            {num("Each", ["system", "ev", "kwEach"], { suffix: "kW" })}
            {num("Price each ex GST", ["system", "ev", "priceEachExGst"], { suffix: "$" })}
          </div>
          {sys.ev ? (
            <label className="row-meta" style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 8 }}>
              <input type="checkbox" checked={sys.ev.future === true} onChange={(e) => set(["system", "ev", "future"], e.target.checked || null)} disabled={locked} />
              EV-ready only — chargers are a future add-on: not in the price or the savings, shown as “Future” and listed in the exclusions
            </label>
          ) : null}

          <h4>Other lines</h4>
          {(sys.extras ?? []).map((x, i) => (
            <div key={i} className="skill-inline-row">
              <input value={x.label ?? ""} onChange={(e) => set(["system", "extras", i, "label"], e.target.value)} disabled={locked} placeholder="Switchboard upgrade, Supply and Install" />
              <NumberInput value={x.priceExGst ?? ""} onChange={(v) => set(["system", "extras", i, "priceExGst"], v)} step="any" disabled={locked} />
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => set(["system", "extras"], sys.extras.filter((_, j) => j !== i))} disabled={locked} aria-label="Remove line">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
          {!locked ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => set(["system", "extras"], [...(sys.extras ?? []), { label: "", priceExGst: 0 }])}>
              <Plus size={14} /> Line (ex GST)
            </button>
          ) : null}

          <h4>Assumptions for this proposal</h4>
          <p className="row-meta">Blank uses the skill&apos;s setting.</p>
          <div className="form-grid auto">
            {num("Solar-window load", ["params", "solarWindowSharePct"], { suffix: "%", hint: `skill: ${options?.settings?.savings?.solarWindowSharePct ?? 30}%` })}
            <Field label="Finance">
              <select value={input.params?.financeMode ?? ""} onChange={(e) => set(["params", "financeMode"], e.target.value)} disabled={locked}>
                <option value="">Skill setting ({options?.settings?.finance?.mode ?? "separate_on_net"})</option>
                <option value="separate_on_net">Separate on net</option>
                <option value="uplift">Uplift</option>
              </select>
            </Field>
            <Field label="Battery discharge">
              <select value={input.params?.dischargeOrder ?? ""} onChange={(e) => set(["params", "dischargeOrder"], e.target.value)} disabled={locked}>
                <option value="">Skill setting</option>
                <option value="peak_first">Peak first</option>
                <option value="pro_rata">Spread across the evening</option>
              </select>
            </Field>
            <Field label="Battery model">
              <select value={input.params?.batteryModel ?? ""} onChange={(e) => set(["params", "batteryModel"], e.target.value)} disabled={locked}>
                <option value="">Skill setting ({options?.settings?.savings?.batteryModel === "solar_first" ? "stored solar + peak shifting" : "daily cycle"})</option>
                <option value="daily_cycle">Daily cycle — grid top-up as a minus line</option>
                <option value="solar_first">Stored solar + peak shifting</option>
              </select>
            </Field>
            {num("Solar yield", ["params", "yieldKwhPerKwp"], { suffix: "kWh/kWp/yr", hint: "blank = the skill's profile" })}
            {text("Yield profile name", ["params", "yieldProfileName"], { placeholder: "seasonal Western Sydney profile" })}
            {num("DSC override", ["params", "dscKwOverride"], { suffix: "kW", hint: "PRC demand-shifting kW" })}
            {num("Battery STCs override", ["params", "batteryStcOverride"], { step: 1 })}
          </div>
          <div className="form-grid" style={{ marginTop: 12 }}>
            <Field label="One word for the site" hint="used in the wording">
              <input value={narrative.siteNoun ?? input.narrativeHints?.siteNoun ?? ""} onChange={(e) => setNarrative({ ...narrative, siteNoun: e.target.value })} disabled={locked} placeholder="kitchen, motel, service station" />
            </Field>
          </div>
        </div>
      ) : null}

      {tab === "words" ? (
        <WordsTab proposal={proposal} narrative={narrative} setNarrative={setNarrative} locked={locked} aiConfigured={options?.aiConfigured} aiText={aiText} setAiText={setAiText} busy={busy} dirty={dirty} onRewrite={() => run("ai", () => dispatch(rewriteEnergyProposalText({ oppId: opp.id, id: proposal.id, body: { instructions: aiText } })).unwrap(), "The AI rewrote the words — review them")} />
      ) : null}

      {tab === "details" ? (
        <div className="panel">
          <div className="form-grid">
            <Field label="Title (the list only)">
              <input value={meta.title} onChange={(e) => setMeta({ ...meta, title: e.target.value })} disabled={locked} />
            </Field>
            <Field label="Quote number">
              <input value={meta.number} onChange={(e) => setMeta({ ...meta, number: e.target.value })} disabled={locked} />
            </Field>
            <Field label="Prepared">
              <input type="date" value={meta.preparedOn} onChange={(e) => setMeta({ ...meta, preparedOn: e.target.value })} disabled={locked} />
            </Field>
            <Field label="Valid until">
              <input type="date" value={meta.validUntil} onChange={(e) => setMeta({ ...meta, validUntil: e.target.value })} disabled={locked} />
            </Field>
          </div>
          <p className="row-meta" style={{ marginTop: 12 }}>
            Prepared by {proposal.document.preparedBy || "—"} · {proposal.document.company.name}, ABN {proposal.document.company.abn} — set on Admin → AI skills → Calculator settings.
          </p>
        </div>
      ) : null}

      {pdfUrl ? (
        <Modal title={energyProposalFileName(proposal)} className="document" confirmClose={false} onClose={() => {
          URL.revokeObjectURL(pdfUrl);
          setPdfUrl(null);
        }}>
          <iframe title="Proposal PDF" src={pdfUrl} className="ep-pdf-frame" />
        </Modal>
      ) : null}

      {confirm === "final" ? (
        <Modal
          title="Mark this proposal final?"
          confirmClose={false}
          body="A final proposal is locked: its figures and words stay as they are, even if the skill's settings change later. It is also saved as the next version of the job's quote — the version sales sends the customer at the proposal stage (in this template). Check the open items on the workout first. To change it afterwards, make a new revision."
          onClose={() => setConfirm(null)}
          actions={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={() =>
                  run(
                    "final",
                    async () => {
                      const saved = await dispatch(finaliseEnergyProposal({ oppId: opp.id, id: proposal.id })).unwrap();
                      // The new quote version shows on the hand-over and the proposal stage straight away.
                      dispatch(fetchQuoteVersions(opp.id));
                      return saved;
                    },
                    "Proposal marked final and saved as a quote version",
                  ).finally(() => setConfirm(null))
                }>
                Mark final
              </button>
            </>
          }
        />
      ) : null}
      {confirm === "delete" ? (
        <Modal
          title="Delete this draft?"
          confirmClose={false}
          body={`${proposal.number} and its edits will be removed. A PDF already saved to the job's documents stays there.`}
          onClose={() => setConfirm(null)}
          actions={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirm(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={() =>
                  run("delete", async () => {
                    await dispatch(deleteEnergyProposal({ oppId: opp.id, id: proposal.id })).unwrap();
                    onClose();
                  }, "Draft deleted").finally(() => setConfirm(null))
                }
              >
                Delete
              </button>
            </>
          }
        />
      ) : null}
      {confirm === "redraft" ? (
        <RedraftModal
          options={options}
          busy={busy === "redraft"}
          onClose={() => setConfirm(null)}
          onSubmit={(body) => run("redraft", () => dispatch(draftEnergyProposalWithAi({ oppId: opp.id, body: { ...body, proposalId: proposal.id } })).unwrap(), "Redrafted with AI — review the workout").finally(() => setConfirm(null))}
        />
      ) : null}
    </div>
  );
}

/** Keys the user cleared since the last save are sent as "" so the API drops them (back to the default wording). */
function narrativeKeysCleared(saved = {}, current = {}) {
  return Object.fromEntries(Object.keys(saved ?? {}).filter((k) => !(k in current)).map((k) => [k, ""]));
}

function WordsTab({ proposal, narrative, setNarrative, locked, aiConfigured, aiText, setAiText, busy, dirty, onRewrite }) {
  const d = proposal.defaults;
  const field = (key, label, rows = 1) => (
    <Field label={label} hint={narrative[key] ? "edited" : "default"}>
      {rows > 1 ? (
        <textarea rows={rows} value={narrative[key] ?? ""} placeholder={d[key]} onChange={(e) => setNarrative(withValue(narrative, key, e.target.value))} disabled={locked} />
      ) : (
        <input value={narrative[key] ?? ""} placeholder={d[key]} onChange={(e) => setNarrative(withValue(narrative, key, e.target.value))} disabled={locked} />
      )}
    </Field>
  );
  const list = (key, title, first, { grow = false } = {}) => {
    const items = narrative[key]?.length ? narrative[key] : null;
    const shown = items ?? d[key] ?? proposal.text[key] ?? [];
    return (
      <>
        <h4 style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
          <span>
            {title} <span className="row-meta">· {items ? "edited" : "default"}</span>
          </span>
          {!locked && items ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNarrative(withValue(narrative, key, ""))}>
              Back to default
            </button>
          ) : null}
        </h4>
        {shown.map((item, i) => (
          <div key={i} className="ep-word-card">
            <span className="ep-word-num">{first ? String(first + i).padStart(2, "0") : "·"}</span>
            <div>
              <input value={item.title} onChange={(e) => setNarrative({ ...narrative, [key]: shown.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)) })} disabled={locked} />
              <textarea rows={2} value={item.body} onChange={(e) => setNarrative({ ...narrative, [key]: shown.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)) })} disabled={locked} />
            </div>
            {grow && !locked ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNarrative({ ...narrative, [key]: shown.filter((_, j) => j !== i) })} aria-label="Remove row">
                <Trash2 size={14} />
              </button>
            ) : null}
          </div>
        ))}
        {grow && !locked && shown.length < 8 ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setNarrative({ ...narrative, [key]: [...shown, { title: "", body: "" }] })}>
            <Plus size={14} /> Row
          </button>
        ) : null}
      </>
    );
  };
  return (
    <div className="panel">
      {!locked && aiConfigured ? (
        <div className="ai-quote-summary" style={{ marginBottom: 16 }}>
          <Field label="Rewrite the words with AI" hint="it follows the skill; the figures never change">
            <input value={aiText} onChange={(e) => setAiText(e.target.value)} placeholder="e.g. stress the 24-hour trading and EV revenue; keep it short" />
          </Field>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onRewrite} disabled={busy !== null || dirty} title={dirty ? "Save first" : undefined}>
            <Sparkles size={14} /> {busy === "ai" ? "Writing…" : "Rewrite with AI"}
          </button>
        </div>
      ) : null}
      <p className="row-meta" style={{ marginBottom: 12 }}>
        A blank field prints the default (shown greyed), written from the figures. The conditions, savings basis and payment wording are always written from the figures.
      </p>
      <div className="form-grid">
        {field("headline", "Headline (proposal page)")}
        {field("deliveredBy", "Delivered by this proposal")}
        <div className="span-2">{field("whySubtitle", "Why page subtitle")}</div>
        <div className="span-2">{field("intro", "Energy page subtitle")}</div>
        <div className="span-2">{field("energyNote", "Note under the bills table", 3)}</div>
        <div className="span-2">{field("moneyNote", "Note under where the money goes", 3)}</div>
        <div className="span-2">{field("valueHeadline", "Value adds headline (page 7)")}</div>
        <div className="span-2">{field("equipmentNote", "Site-specific equipment note (added to the Equipment condition)", 2)}</div>
        <div className="span-2">{field("sources", "Sources (printed under the value adds)", 2)}</div>
      </div>
      {list("advantages", "Advantages (page 2)", 1)}
      {list("valueAdds", "Value adds (page 7)", 7)}
      {list("exclusions", "Exclusions (page 6)", 0, { grow: true })}
      <details style={{ marginTop: 14 }}>
        <summary className="row-meta" style={{ cursor: "pointer" }}>
          Conditions as they will print
        </summary>
        {proposal.text.conditions.map((c) => (
          <p key={c.title} className="row-meta">
            <strong>{c.title}:</strong> {c.body}
          </p>
        ))}
      </details>
    </div>
  );
}

/** narrative with key set — "" removes it (back to the default). */
function withValue(narrative, key, value) {
  const next = { ...narrative };
  if (value === "" || value === null) delete next[key];
  else next[key] = value;
  return next;
}

function RedraftModal({ options, busy, onClose, onSubmit }) {
  const readable = (options?.bills ?? []).filter((b) => b.readable);
  const [chosen, setChosen] = useState(() => new Set(readable.slice(0, 4).map((b) => b.id)));
  const [instructions, setInstructions] = useState("");
  return (
    <Modal
      title="Redraft with AI"
      body="The AI reads the bills again and refills this draft to the skill. Your edits to this draft are replaced."
      confirmClose={false}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={() => onSubmit({ instructions, documentIds: [...chosen] })} disabled={busy}>
            <Sparkles size={14} /> {busy ? "Drafting…" : "Redraft"}
          </button>
        </>
      }
    >
      {busy ? <LoadingState label="Reading the bills and working out the proposal — this can take a minute…" /> : null}
      <BillChoice bills={readable} chosen={chosen} setChosen={setChosen} />
      <Field label="Instructions">
        <textarea rows={3} value={instructions} onChange={(e) => setInstructions(e.target.value)} placeholder="e.g. 100 kW panels with 100 kW hybrid inverter ($75k + GST) and 266 kWh StarCharge battery ($89,500 + GST)" />
      </Field>
    </Modal>
  );
}

export function BillChoice({ bills, chosen, setChosen }) {
  if (!bills.length) return <p className="row-meta">No readable bills on the job yet (PDF or photo).</p>;
  return (
    <div className="ep-bills">
      {bills.map((b) => (
        <label key={b.id}>
          <input
            type="checkbox"
            checked={chosen.has(b.id)}
            onChange={(e) =>
              setChosen((prev) => {
                const next = new Set(prev);
                if (e.target.checked) next.add(b.id);
                else next.delete(b.id);
                return next;
              })
            }
          />
          {b.name}
          <span className="row-meta"> · {new Date(b.createdAt).toLocaleDateString("en-AU")}</span>
        </label>
      ))}
    </div>
  );
}
