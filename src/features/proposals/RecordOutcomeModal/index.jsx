// When the customer answers by phone or in person instead of through their
// link, sales records it here. It has the same effect as the customer
// answering online: accepted moves the job on to Approvals.

import { useState } from "react";
import Alert from "@/components/Alert";
import Field from "@/components/Field";
import Modal from "@/components/Modal";
import { getErrorMessage } from "@/services/api/client";
import { recordProposalOutcome } from "@/services/api/proposalsApi";

const OUTCOMES = [
  { key: "accepted", label: "Accepted", hint: "The job moves on to Approvals." },
  { key: "renegotiate", label: "Wants changes", hint: "Next: send the job to the estimator for a re-quote, with what they said." },
  { key: "rejected", label: "Declined", hint: "The job stays here — re-quote, send a revised proposal, or mark it lost." },
];

export default function RecordOutcomeModal({ opportunity, proposal, onClose, onRecorded }) {
  const [outcome, setOutcome] = useState("accepted");
  const [customerName, setCustomerName] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async () => {
    if (outcome === "renegotiate" && !note.trim()) {
      setError("Note what the customer wants changed.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const result = await recordProposalOutcome(opportunity.id, proposal.id, {
        outcome,
        customerName: customerName.trim() || undefined,
        note: note.trim() || undefined,
      });
      onRecorded?.(result);
    } catch (err) {
      setError(getErrorMessage(err, "The answer could not be recorded."));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Record the customer's answer — ${proposal.number}`}
      onClose={busy ? undefined : onClose}
      actions={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={`btn ${outcome === "rejected" ? "btn-danger" : "btn-primary"}`} onClick={save} disabled={busy}>
            {busy ? "Saving…" : "Record answer"}
          </button>
        </>
      }
    >
      <p className="lede" style={{ marginTop: 0 }}>
        For an answer given by phone or in person. It is recorded against your name and the customer's link stops accepting answers.
      </p>
      <div className="choice-grid" role="radiogroup" aria-label="Customer's answer">
        {OUTCOMES.map((option) => (
          <label key={option.key} className="choice">
            <input type="radio" name="proposal-outcome" checked={outcome === option.key} onChange={() => setOutcome(option.key)} />
            <span>
              <span className="row-title">{option.label}</span>
              <br />
              <span className="row-meta" style={{ whiteSpace: "normal" }}>
                {option.hint}
              </span>
            </span>
          </label>
        ))}
      </div>
      <div className="form-grid" style={{ marginTop: 14 }}>
        <Field className="span-2" label="Who you spoke to" hint="optional" htmlFor="ro-name">
          <input id="ro-name" value={customerName} maxLength={120} onChange={(e) => setCustomerName(e.target.value)} />
        </Field>
        <Field className="span-2" label={outcome === "renegotiate" ? "What they want changed" : "Note"} hint={outcome === "renegotiate" ? "required" : "optional"} htmlFor="ro-note">
          <textarea id="ro-note" rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
      {error ? (
        <Alert tone="danger" style={{ marginTop: 12 }}>
          {error}
        </Alert>
      ) : null}
    </Modal>
  );
}
