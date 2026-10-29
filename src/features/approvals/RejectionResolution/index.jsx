// Resolving a rejected approval (UAT exit logic RJ-01..05, Oct 2026): one of
// five options, each with a reason - resubmit it, send the job back to
// Estimation or to Sales, change approach (close it and add another), or
// close the job as lost.
//
// `item` - the rejected approval; `job` - the approvals record (its catalogue
// offers the approvals to change to); `onResolve(body)` - body is
// { option, reason, newKey?, newLabel?, lostReason?, changes? }, resolving
// false when it could not be done; `onClose` closes the dialog.
//
// Returning to Estimation asks what the redesign will change, and shows which
// approvals will restart from Not Started before it is confirmed (RS-01..04).

import { useState } from "react";
import Alert from "@/components/Alert";
import Field from "@/components/Field";
import Modal from "@/components/Modal";
import { APPROVAL_RESETS, LOST_REASONS, REJECTION_OPTIONS } from "@/constants/approvals";
import { rejectionReasonOf, resetsFor } from "@/helpers/approvals";
import { catalogueOf } from "@/helpers/requiredApprovals";

// The "Change Approach" choice that names a new approval instead of picking one.
const CUSTOM = "__custom";
// RS-04: the redesign changes nothing the approvals rest on.
const NO_CHANGE = "none";

export default function RejectionResolution({ item, job, onResolve, onClose }) {
  const [option, setOption] = useState("");
  const [reason, setReason] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newLabel, setNewLabel] = useState("");
  const [lostReason, setLostReason] = useState("");
  const [changes, setChanges] = useState([]); // APPROVAL_RESETS values, or [NO_CHANGE]
  const [busy, setBusy] = useState(false);

  const chosen = REJECTION_OPTIONS.find((entry) => entry.value === option) ?? null;
  const onJob = (Array.isArray(job.requiredApprovals) ? job.requiredApprovals : []).filter((key) => key !== item.key);
  // The same kind again (another finance provider) or a different one (CDC instead of a DA).
  const choices = catalogueOf({ approvalTypes: job.catalogue }).filter((type) => !onJob.includes(type.key));
  const ready =
    chosen &&
    reason.trim() &&
    (option !== "change_approach" || (newKey && (newKey !== CUSTOM || newLabel.trim()))) &&
    (option !== "close_lost" || lostReason) &&
    (option !== "return_estimation" || changes.length > 0);
  const relevant = changes.filter((change) => change !== NO_CHANGE);
  const resets = resetsFor(job, relevant, item.key);
  const toggleChange = (value) =>
    setChanges((current) =>
      value === NO_CHANGE
        ? current.includes(NO_CHANGE)
          ? []
          : [NO_CHANGE]
        : current.includes(value)
          ? current.filter((change) => change !== value)
          : [...current.filter((change) => change !== NO_CHANGE), value],
    );

  const resolve = async () => {
    setBusy(true);
    try {
      const body = { option, reason: reason.trim() };
      if (option === "change_approach") Object.assign(body, newKey === CUSTOM ? { newLabel: newLabel.trim() } : { newKey });
      if (option === "close_lost") body.lostReason = lostReason;
      if (option === "return_estimation") body.changes = relevant;
      if ((await onResolve(body)) !== false) onClose();
    } finally {
      setBusy(false);
    }
  };
  const rejected = rejectionReasonOf(item);

  return (
    <Modal
      title={`Resolve Rejection: ${item.label}`}
      confirmClose={false}
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className={`btn ${option === "close_lost" ? "btn-danger" : "btn-primary"}`} onClick={resolve} disabled={busy || !ready}>
            {busy ? "Saving…" : (chosen?.action ?? "Confirm")}
          </button>
        </>
      }
    >
      {rejected ? (
        <Alert tone="danger" style={{ marginBottom: 12 }}>
          <strong>Rejected:</strong> {rejected}
        </Alert>
      ) : null}
      <div className="list-stack" role="radiogroup" aria-label="How to resolve the rejection" style={{ marginBottom: 12 }}>
        {REJECTION_OPTIONS.map((entry) => (
          <label key={entry.value} className="check cl-check" style={{ alignItems: "flex-start" }}>
            <input type="radio" name="rejection-option" value={entry.value} checked={option === entry.value} onChange={() => setOption(entry.value)} />
            <span>
              <span className="row-title">{entry.label}</span>
              <span className="row-meta" style={{ display: "block", whiteSpace: "normal" }}>
                {entry.when}
              </span>
            </span>
          </label>
        ))}
      </div>

      {chosen ? (
        <>
          <Alert tone="info" style={{ marginBottom: 12 }}>
            {chosen.effect}
          </Alert>
          <div className="approval-item-fields">
            {option === "change_approach" ? (
              <Field label="New approval" htmlFor="rejection-new" required>
                <select id="rejection-new" value={newKey} onChange={(e) => setNewKey(e.target.value)} disabled={busy}>
                  <option value="">Select…</option>
                  {choices.map((type) => (
                    <option key={type.key} value={type.key}>
                      {type.key === item.key ? `${type.label} (new application)` : type.label}
                    </option>
                  ))}
                  <option value={CUSTOM}>Other (custom approval)…</option>
                </select>
                {newKey === CUSTOM ? (
                  <input
                    type="text"
                    value={newLabel}
                    maxLength={120}
                    placeholder="Name the approval, e.g. Complying Development Certificate (CDC)"
                    aria-label="New approval name"
                    onChange={(e) => setNewLabel(e.target.value)}
                    style={{ marginTop: 8 }}
                    disabled={busy}
                  />
                ) : null}
              </Field>
            ) : null}
            {option === "return_estimation" ? (
              <Field label="What will change in the new quote?" required>
                <div className="list-stack">
                  {APPROVAL_RESETS.map((entry) => (
                    <label key={entry.value} className="check cl-check">
                      <input type="checkbox" checked={changes.includes(entry.value)} onChange={() => toggleChange(entry.value)} disabled={busy} />
                      <span>{entry.label}</span>
                    </label>
                  ))}
                  <label className="check cl-check">
                    <input type="checkbox" checked={changes.includes(NO_CHANGE)} onChange={() => toggleChange(NO_CHANGE)} disabled={busy} />
                    <span>No relevant change</span>
                  </label>
                </div>
                {changes.length ? (
                  <Alert tone={resets.length > 1 ? "warning" : "info"} style={{ marginTop: 10 }}>
                    <strong>Will reset to Not Started:</strong>{" "}
                    {resets.length > 1 || relevant.length
                      ? resets.map((entry) => entry.label).join(", ")
                      : `None - existing approvals are kept (except ${item.label}, which restarts)`}
                    . Any other approval whose trigger shows up in the revised quote is reset too when the job comes back.
                  </Alert>
                ) : null}
              </Field>
            ) : null}
            {option === "close_lost" ? (
              <Field label="Lost reason" htmlFor="rejection-lost" required>
                <select id="rejection-lost" value={lostReason} onChange={(e) => setLostReason(e.target.value)} disabled={busy}>
                  <option value="">Select…</option>
                  {LOST_REASONS.map((entry) => (
                    <option key={entry.value} value={entry.value}>
                      {entry.label}
                    </option>
                  ))}
                </select>
              </Field>
            ) : null}
            <Field label="Reason" htmlFor="rejection-reason" required>
              <textarea
                id="rejection-reason"
                rows={3}
                maxLength={2000}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={chosen.placeholder}
                disabled={busy}
              />
            </Field>
          </div>
        </>
      ) : null}
    </Modal>
  );
}
