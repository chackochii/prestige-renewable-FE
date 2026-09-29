// The last step of estimation: send the priced quote on to the proposal stage.
//
// It lists what the hand-over needs (estimation complete, a priced quote, the
// quote saved as a version), shows what will go — quote number, version and
// total — and takes an optional note to sales. "Send to Proposal" saves the
// quote as a new version first when it has changed since the last one, then
// moves the job on; the salesperson is notified that the quote is ready to
// send to the customer (prestige-be estimationHandover.js).

import { useEffect, useState } from "react";
import { ArrowRight, Check, CircleAlert, Send } from "lucide-react";
import Alert from "@/components/Alert";
import Field from "@/components/Field";
import SectionHead from "@/components/SectionHead";
import { nextStageFor, stageById } from "@/constants/stages";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { invoiceSnapshot, invoiceTotals, matchesSnapshot, versionOf } from "@/helpers/invoice";
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

export default function ProposalHandover({ opp, unit, onReviewVariations, onSent }) {
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const { notify } = useNotifications();
  const quote = useAppSelector((s) => s.leads.quote);
  const versions = useAppSelector((s) => s.leads.versions);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (quote?.id) dispatch(fetchQuoteVersions(opp.id));
  }, [dispatch, opp.id, quote?.id]);

  const stage = Number(opp.stage);
  const next = nextStageFor(ESTIMATION_STAGE, unit);
  const nextLabel = next ? stageById(next).label : "the next stage";

  // Already handed over: say so rather than offering the button again.
  if (stage !== ESTIMATION_STAGE) {
    return (
      <div className="section" style={{ marginTop: 20 }}>
        <SectionHead icon={<Send size={13} />} title="Send to proposal" />
        <Alert tone="success">This quote has been sent on — the job is now at {stageById(stage).label}.</Alert>
      </div>
    );
  }

  const estimationMissing = estimationGateItems(opp);
  const quoteMissing = quoteGateItems(quote);
  const denied = advanceDeniedReason(user, ESTIMATION_STAGE);
  const matching = quote ? versions.find((version) => matchesSnapshot({ opp, quote }, version)) : null;
  const latestNumber = versions.reduce((max, v) => Math.max(max, versionOf(v) ?? 0), 0);
  const totals = quote?.items?.length ? invoiceTotals(quote) : null;
  const ready = !estimationMissing.length && !quoteMissing.length && !denied && opp.lifecycle === "Active";

  const send = async () => {
    setBusy(true);
    setError("");
    try {
      // The proposal stage sends a saved version; save one now if the quote
      // has changed since the last.
      let version = matching;
      if (!version) {
        const snapshot = invoiceSnapshot({ opp, quote });
        version = await dispatch(
          saveQuoteVersion({ id: opp.id, body: { quoteNumber: quote.quoteNumber, version: latestNumber + 1, grandTotal: snapshot.grandTotal, snapshot } }),
        ).unwrap();
      }
      const moved = await dispatch(handOverToProposal({ id: opp.id, body: { quoteVersionId: version.id, note: note.trim() || undefined } })).unwrap();
      notify(`Sent to ${stageById(moved.stage).label}${opp.salesperson?.name ? ` — ${opp.salesperson.name} has been notified` : ""}`);
      onSent?.(moved);
    } catch (err) {
      setError(errText(err, "The quote could not be sent to proposal."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="section" style={{ marginTop: 20 }}>
      <SectionHead icon={<Send size={13} />} title="Send to proposal" />
      <p className="lede" style={{ marginBottom: 12 }}>
        When the quote is final, send it to {nextLabel}. Sales then sends the proposal to the customer, who accepts it online.
      </p>

      <div className="list-stack">
        <CheckRow
          done={!estimationMissing.length}
          title="Estimation complete"
          detail={estimationMissing.length ? estimationMissing.join(" · ") : "Requirements confirmed and client input answered."}
        />
        <CheckRow
          done={!quoteMissing.length}
          title="Quote priced"
          detail={
            totals
              ? `${quote.quoteNumber} · ${quote.items.length} item${quote.items.length === 1 ? "" : "s"} · ${formatCurrency(totals.gst.grandTotal, { withCents: true })}`
              : "Add at least one item to the quote."
          }
        />
        <CheckRow
          done={Boolean(matching)}
          warn
          title={matching ? `Saved as version ${versionOf(matching)}` : "Quote changed since the last saved version"}
          detail={
            matching
              ? "This version is what sales will send to the customer."
              : quoteMissing.length
                ? null
                : `It will be saved as version ${latestNumber + 1} when you send it.`
          }
        />
        <CheckRow
          done
          title="Variation check"
          detail={
            <>
              Optional — compares the quote with the price list and records the result in the history.{" "}
              {onReviewVariations ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={onReviewVariations} style={{ marginLeft: 4 }}>
                  Review variations
                </button>
              ) : null}
            </>
          }
        />
      </div>

      <div className="form-grid" style={{ marginTop: 16 }}>
        <Field className="span-2" label="Note to sales" hint="optional — goes with the notification and into the history" htmlFor="handover-note">
          <textarea
            id="handover-note"
            rows={3}
            maxLength={2000}
            value={note}
            placeholder="e.g. Battery option priced separately; roof access needs scaffolding"
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

      <button type="button" className="btn btn-primary" style={{ marginTop: 14 }} onClick={send} disabled={!ready || busy}>
        <Send size={15} /> {busy ? "Sending…" : `Send to ${next ? stageById(next).short : "next stage"}`} <ArrowRight size={15} />
      </button>
      {opp.salesperson?.name ? (
        <p className="row-meta" style={{ marginTop: 8 }}>
          {opp.salesperson.name} (sales) will be notified.
        </p>
      ) : (
        <p className="row-meta" style={{ marginTop: 8 }}>
          No salesperson is assigned yet — everyone on the job will be notified.
        </p>
      )}
    </div>
  );
}
