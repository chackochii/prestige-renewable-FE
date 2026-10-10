// BOQ / BOS verification against the site, and the decision it feeds: do the
// proposal's quantities match what the site actually needs? Where they do,
// the BOQ is confirmed (CL-11) and quotes are sought on it. Where they don't,
// the BOQ is revised to the site figures — a new round — and matched again;
// each revision is kept so the path from the accepted proposal to what was
// ordered stays visible.
//
// The lines come from the accepted quote. The coordinator records against
// each what the site needs and whether we already hold it in our inventory —
// `onSave(body)` sends the changes (see procurementApi.saveBoq); `revise`
// closes the round. Lines found on site beyond the quote are added here too
// (PRC-02), each straight into its own table — BOQ for materials, BOS for
// services. Suppliers, availability and prices are not known yet: they are
// entered on the supplier-quote tab (BoqPricing) once the quotes are compared.

import { useState } from "react";
import { ClipboardCheck, History, Plus, Save, Undo2, Wrench } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Field from "@/components/Field";
import SectionHead from "@/components/SectionHead";
import BoqLineTable from "@/features/procurement/components/BoqLineTable";
import { useBoqDrafts } from "@/features/procurement/components/useBoqDrafts";
import { LINE_KINDS } from "@/constants/procurement";
import { boqMatches, currentRound, materialLines, mismatchedLines, originalLines, revisionsOf, serviceLines } from "@/helpers/procurement";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { formatNumber } from "@/utils/formatCurrency";

const qty = (value) => Number(value) || 0;
const blankLine = (kind = "material") => ({ item: "", brand: "", unit: "ea", kind, siteQty: "1", inInventory: false });

export default function BoqVerification({ job, canEdit = false, onSave }) {
  const differ = mismatchedLines(job);
  const round = currentRound(job);
  const revisions = revisionsOf(job);
  const latest = revisions[revisions.length - 1] ?? null;

  const { edit, valueOf, changed, forget, submit, sent, save, busy, error } = useBoqDrafts(job, onSave);
  const [revising, setRevising] = useState(false);
  const [reason, setReason] = useState("");
  // Which table a new line is going into — "material" (BOQ) or "service" (BOS) — or null.
  const [adding, setAdding] = useState(null);
  const [added, setAdded] = useState(blankLine());
  const startAdding = (kind) => {
    setAdded(blankLine(kind));
    setAdding(kind);
  };

  // After the edits, which lines would still differ — the revision asks about those.
  const afterEdits = (Array.isArray(job?.boq) ? job.boq : []).map((line) => ({ ...line, siteQty: valueOf(line, "siteQty") }));
  const wouldDiffer = afterEdits.filter((line) => qty(line.proposalQty) !== qty(line.siteQty));

  const revise = () =>
    submit({ lines: changed, revise: true, reason: reason.trim() }, () => {
      sent();
      setRevising(false);
      setReason("");
    });
  const addLine = () =>
    submit({ lines: changed, add: [{ ...added, siteQty: Number(added.siteQty) || 0 }] }, () => {
      sent();
      setAdding(null);
      setAdded(blankLine());
    });
  // Only that line goes; anything typed on the others stays, still to be saved.
  const removeLine = (key) => submit({ remove: [key] }, () => forget(key));
  const fromQuote = new Set(originalLines(job).filter((line) => qty(line.proposalQty) > 0).map((line) => line.key));
  const table = { mode: "site", canEdit, valueOf, onEdit: edit, onRemove: removeLine, removable: (line) => !fromQuote.has(line.key), busy };

  return (
    <>
      {boqMatches(job) ? (
        <Alert tone="success">
          Proposal BOQ and the actual site requirement match{round > 1 ? ` (round ${round})` : ""}. Once the checklist below is
          signed, get quotes on the lines not in our inventory and price them on the supplier-quote tab.
        </Alert>
      ) : (Array.isArray(job?.boq) ? job.boq : []).length === 0 ? (
        <Alert tone="warning">
          No BOQ lines on this job — the accepted quote had no items, or none was accepted. Add the lines the site needs below.
        </Alert>
      ) : (
        <Alert tone="warning">
          {differ.length} line{differ.length === 1 ? "" : "s"} differ{differ.length === 1 ? "s" : ""} from the proposal (
          {differ.map((line) => line.item).join(", ")}). Revise the BOQ to the site figures as a new round and match
          again; the difference goes through the price-variation check.
        </Alert>
      )}

      {latest ? (
        <div style={{ marginTop: 20 }}>
          <SectionHead icon={<History size={13} />} title={`Round ${round} of ${round} — revised ${formatDate(latest.at)} by ${latest.by}`} />
          <p className="lede" style={{ fontSize: 14, marginBottom: 10 }}>
            {latest.reason}
          </p>
          <RevisionDiff before={latest.lines} after={job.boq} round={latest.round} />
        </div>
      ) : null}

      <BoqLineTable {...table} icon={<ClipboardCheck size={13} />} title={LINE_KINDS.material.label} lines={materialLines(job)} empty="No materials on this BOQ." />
      <BoqLineTable {...table} icon={<Wrench size={13} />} title={LINE_KINDS.service.label} lines={serviceLines(job)} empty="No services on this BOS." />

      {canEdit ? (
        <div style={{ marginTop: 16 }}>
          {error ? (
            <Alert tone="danger" style={{ marginBottom: 10 }}>
              {error}
            </Alert>
          ) : null}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy || !changed.length}>
              <Save size={14} /> {busy ? "Saving…" : changed.length ? `Save ${changed.length} line${changed.length === 1 ? "" : "s"}` : "No changes to save"}
            </button>
            {wouldDiffer.length && !revising ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRevising(true)} disabled={busy}>
                <Undo2 size={14} /> Revise BOQ to the site figures (round {round + 1})
              </button>
            ) : null}
            {!adding ? (
              <>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => startAdding("material")} disabled={busy}>
                  <Plus size={14} /> Add BOQ item
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => startAdding("service")} disabled={busy}>
                  <Plus size={14} /> Add BOS item
                </button>
              </>
            ) : null}
          </div>

          {revising ? (
            <div className="decision-card" style={{ marginTop: 12 }}>
              <Field label="Why the BOQ is being revised" hint="the site figures become the new proposal quantities; the price variation is still measured from the accepted quote" required>
                <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Site measure found a longer cable run and extra rail than the drawings showed" />
              </Field>
              <div className="decision-actions" style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={revise} disabled={busy || !reason.trim()}>
                  Revise — {wouldDiffer.map((line) => `${line.item} ${formatNumber(line.proposalQty)} → ${formatNumber(line.siteQty)}`).join(", ")}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRevising(false)} disabled={busy}>
                  Cancel
                </button>
              </div>
            </div>
          ) : null}

          {adding ? (
            <div className="decision-card" style={{ marginTop: 12 }}>
              <SectionHead
                icon={adding === "service" ? <Wrench size={13} /> : <ClipboardCheck size={13} />}
                title={adding === "service" ? "New BOS item — a service found on site" : "New BOQ item — a material found on site"}
              />
              <div className="form-grid">
                <Field label={adding === "service" ? "Service" : "Item"} required>
                  <input
                    value={added.item}
                    onChange={(e) => setAdded({ ...added, item: e.target.value })}
                    placeholder={adding === "service" ? "e.g. Scaffolding hire" : "e.g. Isolator enclosure"}
                  />
                </Field>
                <Field label="Brand">
                  <input value={added.brand} onChange={(e) => setAdded({ ...added, brand: e.target.value })} />
                </Field>
                <Field label="Unit">
                  <input value={added.unit} onChange={(e) => setAdded({ ...added, unit: e.target.value })} style={{ maxWidth: 120 }} />
                </Field>
                <Field label="Site quantity" required>
                  <input type="number" min={0} value={added.siteQty} onChange={(e) => setAdded({ ...added, siteQty: e.target.value })} />
                </Field>
                <Field label="Inventory">
                  <label className="check">
                    <input type="checkbox" checked={added.inInventory === true} onChange={(e) => setAdded({ ...added, inInventory: e.target.checked })} />
                    <span>In our inventory</span>
                  </label>
                </Field>
              </div>
              <div className="decision-actions" style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={addLine} disabled={busy || !added.item.trim()}>
                  <Plus size={14} /> Add {adding === "service" ? "BOS" : "BOQ"} item
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(null)} disabled={busy}>
                  Cancel
                </button>
              </div>
              <p className="row-meta" style={{ marginTop: 8, whiteSpace: "normal" }}>
                Nothing was proposed for a line found on site, so its whole quoted cost counts towards the price variation. Its supplier
                and price are entered on the supplier-quote tab.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

/** What the revision changed, line by line — only lines whose proposal quantity moved. */
function RevisionDiff({ before = [], after = [], round }) {
  const previous = new Map(before.map((line) => [line.key, line]));
  const changed = after.filter((line) => {
    const was = previous.get(line.key);
    return was && qty(was.proposalQty) !== qty(line.proposalQty);
  });
  if (changed.length === 0) return <p className="row-meta">No quantities changed in this revision.</p>;
  return (
    <div className="list-stack">
      {changed.map((line) => {
        const was = previous.get(line.key);
        return (
          <div className="list-row" key={line.key}>
            <div>
              <div className="row-title">{line.item}</div>
              <div className="row-meta">
                Round {round}: {formatNumber(was.proposalQty)} {line.unit} proposed, {formatNumber(was.siteQty)} {line.unit} needed on site
              </div>
            </div>
            <Badge tone="info">
              {formatNumber(was.proposalQty)} → {formatNumber(line.proposalQty)} {line.unit}
            </Badge>
          </div>
        );
      })}
    </div>
  );
}
