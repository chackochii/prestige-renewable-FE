// Sending the job back to the estimator for a re-quote. The customer's
// answer — if they gave one, online or recorded after a call — is shown as
// their message and goes with the request word for word; otherwise sales
// writes down what the customer asked for. Sales adds comments for the
// estimator (required) and confirms, or changes, who gets it. On save the
// job moves back to Estimation, the estimator is notified, and the
// customer's link stops accepting answers.

import { useState } from "react";
import { Undo2 } from "lucide-react";
import Alert from "@/components/Alert";
import Field from "@/components/Field";
import Modal from "@/components/Modal";
import { useUnitUsers } from "@/hooks/useUnitUsers";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { isOpen, wantsChanges } from "@/helpers/proposals";
import { getErrorMessage } from "@/services/api/client";
import { requestRequote } from "@/services/api/proposalsApi";

export default function RequoteRequestModal({ opportunity, proposal, onClose, onRequested }) {
  const { estimators, ready } = useUnitUsers();
  const currentEstimatorId = opportunity.estimatorId ?? opportunity.estimator?.id ?? null;
  const [estimatorId, setEstimatorId] = useState(currentEstimatorId ? String(currentEstimatorId) : "");
  const [comments, setComments] = useState("");
  const [customerMessage, setCustomerMessage] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [errors, setErrors] = useState({});
  const [failure, setFailure] = useState("");
  const [busy, setBusy] = useState(false);

  // The customer's recorded answer is theirs: shown, not edited.
  const answered = wantsChanges(proposal) && proposal.responseNote;
  const linkOpen = isOpen(proposal);
  // The current estimator may not be in the pick list (another unit, deactivated): keep them selectable.
  const options = estimators.some((u) => String(u.id) === String(currentEstimatorId)) || !currentEstimatorId
    ? estimators
    : [{ id: currentEstimatorId, name: opportunity.estimator?.name || `User #${currentEstimatorId}` }, ...estimators];
  const chosen = options.find((u) => String(u.id) === estimatorId) ?? null;

  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!comments.trim()) next.comments = "Tell the estimator what to change.";
    if (!estimatorId) next.estimatorId = "Pick the estimator to assign this to.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setFailure("");
    try {
      const result = await requestRequote(opportunity.id, {
        comments: comments.trim(),
        estimatorId: Number(estimatorId),
        ...(answered ? {} : { customerMessage: customerMessage.trim() || undefined, customerName: customerName.trim() || undefined }),
      });
      onRequested?.(result);
    } catch (err) {
      setFailure(getErrorMessage(err, "The re-quote could not be requested."));
      setBusy(false);
    }
  };

  return (
    <Modal
      title={`Send to the estimator for a re-quote — ${opportunity.number}`}
      onClose={busy ? undefined : onClose}
      actions={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" form="requote-form" className="btn btn-primary" disabled={busy || !ready}>
            <Undo2 size={15} /> {busy ? "Sending…" : "Send for re-quote"}
          </button>
        </>
      }
    >
      <p className="lede" style={{ marginTop: 0, marginBottom: 16 }}>
        The job goes back to Estimation. {chosen?.name || "The estimator"} is notified with the customer's message and your comments, and sends the
        revised quote back here to be sent to the customer.
        {linkOpen ? " The customer's current link stops accepting answers." : ""}
      </p>

      <form id="requote-form" onSubmit={submit} noValidate>
        <div className="form-grid">
          {answered ? (
            <div className="span-2">
              <div className="requote-label">The customer's message</div>
              <blockquote className="requote-quote">{proposal.responseNote}</blockquote>
              <div className="row-meta" style={{ whiteSpace: "normal" }}>
                — {proposal.responseName || "The customer"}
                {proposal.responseChannel === "staff" ? `, as recorded by ${proposal.recordedBy?.name || "sales"}` : ", through the proposal link"}
                {proposal.respondedAt ? ` on ${formatDate(proposal.respondedAt, { withTime: true })}` : ""} · goes to the estimator as written
              </div>
            </div>
          ) : (
            <>
              <Field className="span-2" label="What the customer asked for" hint="optional — their words, from the call or email" htmlFor="rq-customer">
                <textarea
                  id="rq-customer"
                  rows={3}
                  maxLength={2000}
                  value={customerMessage}
                  placeholder="e.g. Asked whether the battery could be left out to bring the price down"
                  onChange={(e) => setCustomerMessage(e.target.value)}
                />
              </Field>
              <Field className="span-2" label="Who you spoke to" hint="optional" htmlFor="rq-customer-name">
                <input id="rq-customer-name" value={customerName} maxLength={120} onChange={(e) => setCustomerName(e.target.value)} />
              </Field>
            </>
          )}
          <Field className="span-2" label="Comments for the estimator" hint="required — what to change, and anything the customer said that matters" error={errors.comments} htmlFor="rq-comments">
            <textarea
              id="rq-comments"
              rows={4}
              maxLength={2000}
              value={comments}
              placeholder="e.g. Re-price with 440W panels and a 10 kWh battery. Customer's budget is around $18k — keep the inverter as quoted."
              onChange={(e) => {
                setComments(e.target.value);
                if (errors.comments) setErrors((current) => ({ ...current, comments: undefined }));
              }}
            />
          </Field>
          <Field className="span-2" label="Assign to" hint="the job's estimator, unless someone else should take it" error={errors.estimatorId} htmlFor="rq-estimator">
            <select
              id="rq-estimator"
              value={estimatorId}
              onChange={(e) => {
                setEstimatorId(e.target.value);
                if (errors.estimatorId) setErrors((current) => ({ ...current, estimatorId: undefined }));
              }}
              disabled={!ready}
            >
              <option value="">{ready ? "Pick an estimator" : "Loading people…"}</option>
              {options.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name}
                  {String(user.id) === String(currentEstimatorId) ? " (current estimator)" : ""}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {failure ? (
          <Alert tone="danger" style={{ marginTop: 12 }}>
            {failure}
          </Alert>
        ) : null}
      </form>
    </Modal>
  );
}
