// BOQ / BOS availability & verification, and the decision it feeds: do the
// proposal's quantities match what the site actually needs? Where they do,
// procurement starts getting quotes. Where they don't, the BOQ is revised to
// the site figures — a new round — and matched again; each revision is kept
// so the path from the accepted proposal to what was ordered stays visible.
//
// The lines come from the accepted quote. The coordinator records against
// each what the site needs, who supplies it, whether it can be had, and the
// price quoted — `onSave(body)` sends the changes (see procurementApi.saveBoq);
// `revise` closes the round. Lines found on site beyond the quote are added
// here too (PRC-02).

import { useEffect, useState } from "react";
import { ClipboardCheck, FileText, History, Plus, Save, Undo2, Wrench, X } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Field from "@/components/Field";
import SectionHead from "@/components/SectionHead";
import { AVAILABILITY, LINE_KINDS } from "@/constants/procurement";
import {
  availabilityOf,
  boqMatches,
  currentRound,
  longestLeadTimeDays,
  materialLines,
  mismatchedLines,
  originalLines,
  revisionsOf,
  serviceLines,
  unavailableLines,
} from "@/helpers/procurement";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { formatCurrency, formatNumber } from "@/utils/formatCurrency";

const qty = (value) => Number(value) || 0;
const errText = (err, fallback) => (typeof err === "string" ? err : err?.message || fallback);
const blankLine = () => ({ item: "", brand: "", unit: "ea", kind: "material", siteQty: "1", quotedUnitCost: "", supplier: "" });

export default function BoqVerification({ job, canEdit = false, onSave }) {
  const differ = mismatchedLines(job);
  const round = currentRound(job);
  const revisions = revisionsOf(job);
  const latest = revisions[revisions.length - 1] ?? null;
  const quotes = Array.isArray(job?.quotes) ? job.quotes : [];
  const leadTime = longestLeadTimeDays(job);
  const backordered = unavailableLines(job);

  // The coordinator's unsaved edits, by line key, as typed.
  const [drafts, setDrafts] = useState({});
  const [revising, setRevising] = useState(false);
  const [reason, setReason] = useState("");
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState(blankLine());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // A different job: start from what its record says. Not on every copy of the
  // job that comes back — any save returns the whole job (ticking a checklist
  // item below this table included), and resetting then threw away quoted
  // costs typed here but not yet saved. Drafts are cleared when they are sent.
  useEffect(() => {
    setDrafts({});
    setRevising(false);
    setReason("");
    setError("");
  }, [job?.id]);

  const edit = (key, field, value) => setDrafts((d) => ({ ...d, [key]: { ...(d[key] ?? {}), [field]: value } }));
  const valueOf = (line, field) => (drafts[line.key]?.[field] !== undefined ? drafts[line.key][field] : (line[field] ?? ""));
  const changed = Object.entries(drafts).map(([key, fields]) => ({ key, ...fields }));
  // After the edits, which lines would still differ — the revision asks about those.
  const afterEdits = (Array.isArray(job?.boq) ? job.boq : []).map((line) => ({ ...line, siteQty: valueOf(line, "siteQty") }));
  const wouldDiffer = afterEdits.filter((line) => qty(line.proposalQty) !== qty(line.siteQty));

  const submit = async (body, after) => {
    setBusy(true);
    setError("");
    try {
      await onSave?.(body);
      after?.();
    } catch (err) {
      setError(errText(err, "The BOQ could not be saved."));
    } finally {
      setBusy(false);
    }
  };
  // What was typed went with the save, so the table reads the record again.
  const sent = () => setDrafts({});
  const save = () => submit({ lines: changed }, sent);
  const revise = () =>
    submit({ lines: changed, revise: true, reason: reason.trim() }, () => {
      sent();
      setRevising(false);
      setReason("");
    });
  const addLine = () =>
    submit(
      { lines: changed, add: [{ ...added, siteQty: Number(added.siteQty) || 0, quotedUnitCost: added.quotedUnitCost === "" ? null : Number(added.quotedUnitCost) }] },
      () => {
        sent();
        setAdding(false);
        setAdded(blankLine());
      },
    );
  // Only that line goes; anything typed on the others stays, still to be saved.
  const removeLine = (key) =>
    submit({ remove: [key] }, () =>
      setDrafts((d) => {
        const next = { ...d };
        delete next[key];
        return next;
      }),
    );
  const fromQuote = new Set(originalLines(job).filter((line) => qty(line.proposalQty) > 0).map((line) => line.key));

  return (
    <>
      {boqMatches(job) ? (
        <Alert tone="success">
          Proposal BOQ and the actual site requirement match{round > 1 ? ` (round ${round})` : ""}. Procurement can start
          getting quotes — recorded in the history tab.
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

      {backordered.length ? (
        <Alert tone="danger" style={{ marginTop: 10 }}>
          On back-order: {backordered.map((line) => `${line.item}${line.leadTimeDays ? ` (${line.leadTimeDays} days)` : ""}`).join(", ")}. Delivery is
          scheduled around it — see POs & delivery.
        </Alert>
      ) : leadTime ? (
        <p className="row-meta" style={{ marginTop: 10 }}>
          Longest lead time {leadTime} days — the earliest everything can be on site once ordered.
        </p>
      ) : null}

      {latest ? (
        <div style={{ marginTop: 20 }}>
          <SectionHead icon={<History size={13} />} title={`Round ${round} of ${round} — revised ${formatDate(latest.at)} by ${latest.by}`} />
          <p className="lede" style={{ fontSize: 14, marginBottom: 10 }}>
            {latest.reason}
          </p>
          <RevisionDiff before={latest.lines} after={job.boq} round={latest.round} />
        </div>
      ) : null}

      <LineSection
        icon={<ClipboardCheck size={13} />}
        title={LINE_KINDS.material.label}
        lines={materialLines(job)}
        empty="No materials on this BOQ."
        canEdit={canEdit}
        valueOf={valueOf}
        onEdit={edit}
        onRemove={removeLine}
        removable={(line) => !fromQuote.has(line.key)}
        busy={busy}
      />
      <LineSection
        icon={<Wrench size={13} />}
        title={LINE_KINDS.service.label}
        lines={serviceLines(job)}
        empty="No services on this BOS."
        canEdit={canEdit}
        valueOf={valueOf}
        onEdit={edit}
        onRemove={removeLine}
        removable={(line) => !fromQuote.has(line.key)}
        busy={busy}
      />

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
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(true)} disabled={busy}>
                <Plus size={14} /> Add a line found on site
              </button>
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
              <div className="form-grid">
                <Field label="Item" required>
                  <input value={added.item} onChange={(e) => setAdded({ ...added, item: e.target.value })} placeholder="e.g. Isolator enclosure" />
                </Field>
                <Field label="Brand">
                  <input value={added.brand} onChange={(e) => setAdded({ ...added, brand: e.target.value })} />
                </Field>
                <Field label="Kind">
                  <select value={added.kind} onChange={(e) => setAdded({ ...added, kind: e.target.value })}>
                    {Object.values(LINE_KINDS).map((kind) => (
                      <option key={kind.key} value={kind.key}>
                        {kind.label}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Unit">
                  <input value={added.unit} onChange={(e) => setAdded({ ...added, unit: e.target.value })} style={{ maxWidth: 120 }} />
                </Field>
                <Field label="Site quantity" required>
                  <input type="number" min={0} value={added.siteQty} onChange={(e) => setAdded({ ...added, siteQty: e.target.value })} />
                </Field>
                <Field label="Quoted $ / unit" hint="leave blank until quoted">
                  <input type="number" min={0} step="0.01" value={added.quotedUnitCost} onChange={(e) => setAdded({ ...added, quotedUnitCost: e.target.value })} />
                </Field>
                <Field label="Supplier">
                  <input value={added.supplier} onChange={(e) => setAdded({ ...added, supplier: e.target.value })} />
                </Field>
              </div>
              <div className="decision-actions" style={{ marginTop: 12, display: "flex", gap: 8 }}>
                <button type="button" className="btn btn-primary btn-sm" onClick={addLine} disabled={busy || !added.item.trim()}>
                  <Plus size={14} /> Add line
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(false)} disabled={busy}>
                  Cancel
                </button>
              </div>
              <p className="row-meta" style={{ marginTop: 8, whiteSpace: "normal" }}>
                Nothing was proposed for a line found on site, so its whole quoted cost counts towards the price variation.
              </p>
            </div>
          ) : null}
        </div>
      ) : null}

      <div style={{ marginTop: 24 }}>
        <SectionHead icon={<FileText size={13} />} title="Supplier quotes" />
        {quotes.length === 0 ? (
          <p className="lede" style={{ fontSize: 14 }}>
            No quotes yet — they are recorded on the supplier-quote tab as they come in.
          </p>
        ) : (
          <div className="list-stack">
            {quotes.map((quote, index) => (
              <div className="list-row" key={`${quote.supplier}-${quote.receivedAt}-${index}`}>
                <div>
                  <div className="row-title">{quote.supplier}</div>
                  <div className="row-meta">
                    Received {formatDate(quote.receivedAt)}
                    {quote.validUntil ? ` · valid until ${formatDate(quote.validUntil)}` : ""}
                  </div>
                </div>
                <div className="row-title">{formatCurrency(quote.total)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

/**
 * One table per kind: what the proposal said, what the site needs, who
 * supplies it and whether it can be had — entered here when the person may.
 */
function LineSection({ icon, title, lines, empty, canEdit, valueOf, onEdit, onRemove, removable, busy }) {
  return (
    <div style={{ marginTop: 20 }}>
      <SectionHead icon={icon} title={title} />
      {lines.length === 0 ? (
        <p className="lede" style={{ fontSize: 14 }}>
          {empty}
        </p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Proposal</th>
                <th>Site</th>
                <th>Supplier</th>
                <th>Availability</th>
                <th>Quoted $ / unit</th>
                <th>Match</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const site = valueOf(line, "siteQty");
                const matches = qty(line.proposalQty) === qty(site);
                const delta = qty(site) - qty(line.proposalQty);
                const availability = availabilityOf({ ...line, availability: valueOf(line, "availability"), leadTimeDays: valueOf(line, "leadTimeDays") });
                const quoted = valueOf(line, "quotedUnitCost");
                return (
                  <tr key={line.key}>
                    <td>
                      <div className="row-title">{line.item}</div>
                      <div className="row-meta">
                        {line.brand ? `${line.brand} · ` : ""}
                        {formatCurrency(line.proposalUnitCost, { withCents: true })} / {line.unit} proposed
                      </div>
                      {canEdit && removable(line) ? (
                        <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 4 }} onClick={() => onRemove(line.key)} disabled={busy} aria-label={`Remove ${line.item}`}>
                          <X size={12} /> Remove
                        </button>
                      ) : null}
                    </td>
                    <td>
                      {formatNumber(line.proposalQty)} {line.unit}
                    </td>
                    <td style={matches ? undefined : { color: "var(--warning)", fontWeight: 700 }}>
                      {canEdit ? (
                        <input type="number" min={0} value={site} onChange={(e) => onEdit(line.key, "siteQty", e.target.value)} style={{ width: 90 }} aria-label={`Site quantity for ${line.item}`} />
                      ) : (
                        `${formatNumber(site)} ${line.unit}`
                      )}
                    </td>
                    <td>
                      {canEdit ? (
                        <input value={valueOf(line, "supplier") ?? ""} onChange={(e) => onEdit(line.key, "supplier", e.target.value)} style={{ width: 140 }} placeholder="Supplier" aria-label={`Supplier for ${line.item}`} />
                      ) : (
                        line.supplier || <span className="row-meta">—</span>
                      )}
                    </td>
                    <td>
                      {canEdit ? (
                        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                          <select value={valueOf(line, "availability") || "available"} onChange={(e) => onEdit(line.key, "availability", e.target.value)} aria-label={`Availability of ${line.item}`}>
                            {Object.values(AVAILABILITY).map((option) => (
                              <option key={option.key} value={option.key}>
                                {line.kind === "service" ? option.service : option.material}
                              </option>
                            ))}
                          </select>
                          {valueOf(line, "availability") && valueOf(line, "availability") !== "available" ? (
                            <input type="number" min={0} value={valueOf(line, "leadTimeDays") ?? ""} onChange={(e) => onEdit(line.key, "leadTimeDays", e.target.value)} style={{ width: 64 }} placeholder="days" aria-label={`Lead time for ${line.item}`} />
                          ) : null}
                        </div>
                      ) : (
                        <>
                          <Badge tone={availability.tone}>{availability.label}</Badge>
                          {availability.detail ? <div className="row-meta">{availability.detail}</div> : null}
                        </>
                      )}
                    </td>
                    <td>
                      {canEdit ? (
                        <input type="number" min={0} step="0.01" value={quoted ?? ""} onChange={(e) => onEdit(line.key, "quotedUnitCost", e.target.value)} style={{ width: 100 }} placeholder="not quoted" aria-label={`Quoted unit cost for ${line.item}`} />
                      ) : quoted === null || quoted === undefined || quoted === "" ? (
                        <span className="row-meta">awaiting quote</span>
                      ) : (
                        formatCurrency(quoted, { withCents: true })
                      )}
                    </td>
                    <td>
                      <Badge tone={matches ? "success" : "warning"}>{matches ? "Matches" : `${delta > 0 ? "+" : ""}${delta}`}</Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
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
