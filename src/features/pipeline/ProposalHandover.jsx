// The last step of estimation: send the priced quote on to the proposal stage.
//
// It lists what the hand-over needs (estimation complete, a priced quote, the
// quote generated), shows what will go — quote number, version and total —
// and takes an optional note to sales. "Send to Proposal" generates the quote
// first when it is still a draft (locking it as the next version, or back
// onto the version it came from when nothing changed), then moves the job
// on; the salesperson is notified that the quote is ready to send to the
// customer (prestige-be estimationHandover.js).
//
// What goes can be the manual quote or a final Solar + BESS proposal (the
// AI-drafted commercial proposal — saved as a quote version when it was
// marked final). When the job has one, the estimator picks which: the newest
// of the two is preselected. Sales then sends that version, in its own
// template, from the proposal stage.
//
// On a re-quote (`requote` — the open round sales sent back from proposal)
// the same step returns the revised quote: it warns when the quote is still
// the version the customer saw, and the note — what changed — is required,
// because sales explains it to the customer.

import { useEffect, useState } from "react";
import { ArrowRight, Check, CircleAlert, Send } from "lucide-react";
import Alert from "@/components/Alert";
import Field from "@/components/Field";
import SectionHead from "@/components/SectionHead";
import { nextStageFor, stageById } from "@/constants/stages";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { invoiceSnapshot, invoiceTotals, isEnergyProposalVersion, matchesSnapshot, versionOf } from "@/helpers/invoice";
import { advanceDeniedReason } from "@/helpers/stageAccess";
import { estimationGateItems, quoteGateItems } from "@/helpers/stageTransition";
import { fetchQuoteVersions, handOverToProposal, saveQuoteVersion } from "@/slices/leadsSlice";
import { useAppDispatch, useAppSelector } from "@/store";
import { formatCurrency } from "@/utils/formatCurrency";

const ESTIMATION_STAGE = 2;
const errText = (err, fallback) => (typeof err === "string" ? err : err?.message || fallback);

function CheckRow({ done, title, detail, warn = false }) {
  return (
    <div className="list-row" style={{ alignItems: "flex-start" }}>
      <div style={{ display: "flex", gap: 10, minWidth: 0 }}>
        <span style={{ color: done ? "var(--success)" : warn ? "var(--warning)" : "var(--danger)", marginTop: 2 }}>
          {done ? <Check size={16} /> : <CircleAlert size={16} />}
        </span>
        <div style={{ minWidth: 0 }}>
          <div className="row-title">{title}</div>
          {detail ? (
            <div className="row-meta" style={{ whiteSpace: "normal" }}>
              {detail}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/**
 * `inspectionMissing` comes from EstimationPanel, which holds the job's
 * requests: what the pre-site inspection still needs before the API lets the
 * job leave estimation (empty when none is needed or its findings are approved).
 */
export default function ProposalHandover({ opp, unit, requote = null, onSent, inspectionMissing = [] }) {
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const { notify } = useNotifications();
  const quote = useAppSelector((s) => s.leads.quote);
  const versions = useAppSelector((s) => s.leads.versions);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState(null); // "quote" | a proposal version's id — null until the estimator chooses

  // Every version on the job — a job quoted only with a Solar + BESS proposal has versions before the quote builder loads.
  useEffect(() => {
    dispatch(fetchQuoteVersions(opp.id));
  }, [dispatch, opp.id, quote?.id]);

  const stage = Number(opp.stage);
  const next = nextStageFor(ESTIMATION_STAGE, unit);
  const nextLabel = next ? stageById(next).label : "the next stage";

  // Already handed over: say so rather than offering the button again.
  if (stage !== ESTIMATION_STAGE) {
    return (
      <div className="section" style={{ marginTop: 20 }}>
        <SectionHead icon={<Send size={13} />} title="Send to proposal" />
        <Alert tone="success">This quote has been sent on - the job is now at {stageById(stage).label}.</Alert>
      </div>
    );
  }

  const estimationMissing = estimationGateItems(opp);
  const denied = advanceDeniedReason(user, ESTIMATION_STAGE);
  // Final Solar + BESS proposals, newest first, and the newest version made in the quote builder.
  const proposalVersions = versions.filter(isEnergyProposalVersion).sort((a, b) => (versionOf(b) ?? 0) - (versionOf(a) ?? 0));
  const newestManual = versions.filter((v) => !isEnergyProposalVersion(v)).reduce((max, v) => Math.max(max, versionOf(v) ?? 0), 0);
  // The newest of the two goes unless the estimator picks the other.
  const defaultPick = proposalVersions.length && (!quote?.items?.length || (versionOf(proposalVersions[0]) ?? 0) > newestManual) ? proposalVersions[0].id : "quote";
  const pick = picked ?? defaultPick;
  const sendingProposal = pick !== "quote" ? (proposalVersions.find((v) => v.id === pick) ?? null) : null;

  const quoteMissing = sendingProposal ? [] : quoteGateItems(quote);
  // Generated: locked to a version, and that is what goes. A draft is
  // generated on send — as the next version, or back onto the newest one
  // when nothing changed (the server decides, same as the builder).
  const locked = quote?.status === "generated";
  const generated = locked ? (quote.generatedVersion ?? versions.find((v) => v.id === quote.generatedVersion?.id) ?? null) : null;
  const matching = quote && !locked ? versions.find((version) => matchesSnapshot({ opp, quote }, version)) : null;
  const latestNumber = versions.reduce((max, v) => Math.max(max, versionOf(v) ?? 0), 0);
  const totals = quote?.items?.length ? invoiceTotals(quote) : null;
  // On a re-quote the note says what changed, and sales needs it.
  const noteMissing = Boolean(requote) && !note.trim();
  const ready = !estimationMissing.length && !inspectionMissing.length && !quoteMissing.length && !denied && opp.lifecycle === "Active";
  // What goes is the very version the customer asked to change.
  const goingVersion = sendingProposal ?? generated ?? matching;
  const unchanged = Boolean(requote?.quoteVersion && goingVersion && goingVersion.id === requote.quoteVersion.id);

  const send = async () => {
    setBusy(true);
    setError("");
    try {
      // The proposal stage sends a generated version: the chosen Solar + BESS
      // proposal as it was saved, or the quote — generated now if it is still a draft.
      let version = sendingProposal ?? generated;
      if (!version) {
        const snapshot = invoiceSnapshot({ opp, quote });
        version = await dispatch(
          saveQuoteVersion({ id: opp.id, body: { quoteNumber: quote.quoteNumber, version: latestNumber + 1, grandTotal: snapshot.grandTotal, snapshot } }),
        ).unwrap();
      }
      const moved = await dispatch(handOverToProposal({ id: opp.id, body: { quoteVersionId: version.id, note: note.trim() || undefined } })).unwrap();
      notify(`${requote ? "Revised quote sent" : "Sent"} to ${stageById(moved.stage).label}${opp.salesperson?.name ? ` - ${opp.salesperson.name} has been notified` : ""}`);
      onSent?.(moved);
    } catch (err) {
      setError(errText(err, "The quote could not be sent to proposal."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="section" style={{ marginTop: 20 }}>
      <SectionHead icon={<Send size={13} />} title={requote ? "Send the revised quote to proposal" : "Send to proposal"} />
      <p className="lede" style={{ marginBottom: 12 }}>
        {requote
          ? `The customer asked for changes (re-quote round ${requote.round}). When the revised quote is final, send it back to ${nextLabel} with a note on what changed - sales sends the new proposal.`
          : `Once the quote is final, send it to the ${nextLabel} stage. Sales will then send the proposal to the customer to accept online.`}
      </p>

      {proposalVersions.length ? (
        <div className="handover-pick" role="radiogroup" aria-label="What goes to the customer" style={{ display: "grid", gap: 8, marginBottom: 14 }}>
          <div className="row-meta">What goes to the customer</div>
          {proposalVersions.map((version) => (
            <label key={version.id} className="list-row" style={{ alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
              <input type="radio" name="handover-pick" checked={pick === version.id} onChange={() => setPicked(version.id)} />
              <span style={{ minWidth: 0 }}>
                <span className="row-title">
                  Solar + BESS proposal {version.quoteNumber} - version {versionOf(version)}
                </span>
                <span className="row-meta" style={{ display: "block", whiteSpace: "normal" }}>
                  {[version.snapshot?.energyProposal?.title, version.grandTotal !== null && version.grandTotal !== undefined ? `${formatCurrency(version.grandTotal, { withCents: true })} net incl. GST` : null, "the commercial proposal PDF, marked final"].filter(Boolean).join(" · ")}
                </span>
              </span>
            </label>
          ))}
          <label className="list-row" style={{ alignItems: "flex-start", gap: 10, cursor: "pointer" }}>
            <input type="radio" name="handover-pick" checked={pick === "quote"} onChange={() => setPicked("quote")} />
            <span style={{ minWidth: 0 }}>
              <span className="row-title">Manual quote {quote?.quoteNumber ?? ""}</span>
              <span className="row-meta" style={{ display: "block", whiteSpace: "normal" }}>
                {totals ? `${quote.items.length} item${quote.items.length === 1 ? "" : "s"} · ${formatCurrency(totals.gst.grandTotal, { withCents: true })} · the quote PDF` : "No items on the quote yet"}
              </span>
            </span>
          </label>
        </div>
      ) : null}

      <div className="list-stack">
        {requote ? (
          <CheckRow
            done={!unchanged}
            warn
            title={
              unchanged
                ? `Unchanged from what the customer saw (v${requote.quoteVersion.version})`
                : requote.quoteVersion
                  ? `Revised since the customer saw v${requote.quoteVersion.version}`
                  : "Revised for the customer"
            }
            detail={
              unchanged
                ? "The quote is still the version the customer asked to change. Revise it - or say in the note why it stays as quoted."
                : requote.customerMessage
                  ? `They asked: “${requote.customerMessage}”`
                  : null
            }
          />
        ) : null}
        <CheckRow
          done={!estimationMissing.length}
          title="Estimation complete"
          detail={estimationMissing.length ? estimationMissing.join(" · ") : "Requirements confirmed and client input answered."}
        />
        <CheckRow
          done={!inspectionMissing.length}
          title="Pre-site inspection"
          detail={inspectionMissing.length ? inspectionMissing.join(" · ") : "Not needed, or its findings are approved."}
        />
        {sendingProposal ? (
          <CheckRow
            done
            title={`Solar + BESS proposal final - version ${versionOf(sendingProposal)}`}
            detail="Marked final and saved as a quote version: this proposal PDF is what sales will send the customer."
          />
        ) : null}
        {!sendingProposal ? (
          <CheckRow
            done={!quoteMissing.length}
            title="Quote priced"
            detail={
              totals
                ? `${quote.quoteNumber} · ${quote.items.length} item${quote.items.length === 1 ? "" : "s"} · ${formatCurrency(totals.gst.grandTotal, { withCents: true })}`
                : "Add at least one item to the quote, or mark a Solar + BESS proposal final (Proposal PDF tab)."
            }
          />
        ) : null}
        {!sendingProposal ? (
        <CheckRow
          done={Boolean(generated)}
          warn
          title={
            generated
              ? `Generated as version ${versionOf(generated)} - locked`
              : matching
                ? `New quote, unchanged from version ${versionOf(matching)}`
                : versions.length
                  ? "New quote not generated yet"
                  : "Quote not generated yet"
          }
          detail={
            generated
              ? "This version is what sales will send to the customer."
              : quoteMissing.length
                ? null
                : matching
                  ? `Sending locks the quote back onto version ${versionOf(matching)} and sends that.`
                  : `It will be generated as version ${latestNumber + 1} and locked when you send it.`
          }
        />
        ) : null}
      </div>

      <div className="form-grid" style={{ marginTop: 16 }}>
        <Field
          className="span-2"
          label={requote ? "What changed - Additional Notes" : "Additional Notes"}
          hint={requote ? "required - sales explains it to the customer" : "optional - goes with the notification and into the history"}
          htmlFor="handover-note"
        >
          <textarea
            id="handover-note"
            rows={3}
            maxLength={2000}
            value={note}
            placeholder={
              requote
                ? "e.g. Panels changed to 440W and a 10 kWh battery added; total up by $11,170. Inverter unchanged."
                : "e.g. Battery option priced separately; roof access needs scaffolding"
            }
            onChange={(e) => setNote(e.target.value)}
            disabled={!ready}
          />
        </Field>
      </div>

      {error ? (
        <Alert tone="danger" style={{ marginTop: 12 }}>
          {error}
        </Alert>
      ) : null}
      {opp.lifecycle !== "Active" ? (
        <Alert tone="warning" style={{ marginTop: 12 }}>
          This job is marked <strong>{opp.lifecycle}</strong>, and only active jobs can move to the next stage. Use “Change status” at the top of
          the page to set it back to Active, then send it.
        </Alert>
      ) : null}
      {denied ? (
        <Alert tone="info" style={{ marginTop: 12 }}>
          {denied}.
        </Alert>
      ) : null}

      <button
        type="button"
        className="btn btn-primary"
        style={{ marginTop: 14 }}
        onClick={send}
        disabled={!ready || noteMissing || busy}
        title={noteMissing ? "Say what changed first" : undefined}
      >
        <Send size={15} /> {busy ? "Sending…" : `Send ${requote ? "revised quote " : ""}to ${next ? stageById(next).short : "next stage"}`} <ArrowRight size={15} />
      </button>
      {opp.salesperson?.name ? (
        <p className="row-meta" style={{ marginTop: 8 }}>
          {opp.salesperson.name} (sales) will be notified.
        </p>
      ) : (
        <p className="row-meta" style={{ marginTop: 8 }}>
          No salesperson is assigned yet - everyone on the job will be notified.
        </p>
      )}
    </div>
  );
}
