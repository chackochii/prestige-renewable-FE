// The customer's proposal at /proposal/:token — the link in the email sales
// sent. No sign-in: the token names this one proposal and nothing else.
//
// The PDF is built here in the browser from the saved quote version's
// snapshot (helpers/invoice.js), so it is exactly the quote that was sent.
// The customer then answers it: accept (the job moves on to Approvals), ask
// for changes (sales has it re-quoted and sends a new version), or decline.

import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, Download, ExternalLink, FileText, MessageSquareText, ThumbsDown, ThumbsUp } from "lucide-react";
import Alert from "@/components/Alert";
import Field from "@/components/Field";
import LoadingState from "@/components/LoadingState";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { downloadInvoice, invoicePreviewUrl } from "@/helpers/invoice";
import { getErrorMessage } from "@/services/api/client";
import { getPublicProposal, respondToProposal } from "@/services/api/proposalsApi";
import { formatCurrency } from "@/utils/formatCurrency";

const CHOICES = [
  { key: "accept", label: "Accept proposal", icon: ThumbsUp, tone: "primary", blurb: "Go ahead with this proposal as quoted." },
  { key: "renegotiate", label: "Request changes", icon: MessageSquareText, tone: "ghost", blurb: "Tell us what you would like revised." },
  { key: "reject", label: "Decline", icon: ThumbsDown, tone: "ghost", blurb: "Let us know you will not be going ahead." },
];

/** What the page says once the proposal can no longer be answered. */
function ClosedNotice({ proposal }) {
  const { state, response, contact } = proposal;
  const reach = contact ? ` Contact ${contact.name}${contact.email ? ` at ${contact.email}` : ""}${contact.phone ? ` or ${contact.phone}` : ""}.` : "";
  const when = response?.at ? formatDate(response.at, { withTime: true }) : "";
  if (state === "accepted")
    return (
      <Alert tone="success">
        <strong>Accepted{response?.name ? ` by ${response.name}` : ""}</strong> {when ? `on ${when}` : ""}. Thank you — we will be in touch about the next steps.
      </Alert>
    );
  if (state === "negotiation" || (state === "re-estimated" && response?.decision === "renegotiate"))
    return (
      <Alert tone="info">
        <strong>Changes requested</strong> {when ? `on ${when}` : ""}. We are revising your proposal and will send you an updated one.{reach}
        {response?.note ? <div style={{ marginTop: 8, whiteSpace: "pre-wrap" }}>“{response.note}”</div> : null}
      </Alert>
    );
  // Sent back for a re-quote after a call, or before an answer came through the link.
  if (state === "re-estimated")
    return (
      <Alert tone="info">
        <strong>Being revised.</strong> This proposal is being updated and we will send you a new one shortly.{reach}
      </Alert>
    );
  if (state === "rejected")
    return (
      <Alert tone="warning">
        <strong>Declined</strong> {when ? `on ${when}` : ""}. Thank you for letting us know.{reach}
      </Alert>
    );
  if (state === "withdrawn")
    return <Alert tone="info">This proposal has been replaced by a newer one. Please use the link in our most recent email.{reach}</Alert>;
  if (state === "expired")
    return <Alert tone="warning">This proposal expired on {formatDate(proposal.expiresAt)}. Please contact us for an updated one.{reach}</Alert>;
  return null;
}

function PdfPanel({ proposal }) {
  const [url, setUrl] = useState(null);
  const [error, setError] = useState("");
  const version = proposal.quoteVersion;
  const unit = { name: proposal.business?.name };

  useEffect(() => {
    if (!version?.snapshot) return undefined;
    let cancelled = false;
    let created = null;
    invoicePreviewUrl({ unit, version })
      .then((next) => {
        created = next;
        if (cancelled) URL.revokeObjectURL(next);
        else setUrl(next);
      })
      .catch(() => !cancelled && setError("The PDF could not be shown here. Try downloading it instead."));
    return () => {
      cancelled = true;
      if (created) URL.revokeObjectURL(created);
    };
    // Built once per proposal.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [proposal.number]);

  if (!version?.snapshot) return <Alert tone="warning">The quote for this proposal is no longer available. Please contact us.</Alert>;

  return (
    <div>
      <div className="proposal-public-pdf-actions">
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => downloadInvoice({ unit, version })}>
          <Download size={14} /> Download PDF
        </button>
        {url ? (
          <a className="btn btn-ghost btn-sm" href={url} target="_blank" rel="noreferrer">
            <ExternalLink size={14} /> Open in a new tab
          </a>
        ) : null}
      </div>
      {error ? <Alert tone="warning">{error}</Alert> : null}
      {!url && !error ? <LoadingState label="Preparing your proposal…" /> : null}
      {url ? <iframe className="invoice-frame proposal-public-frame" src={url} title={`Proposal ${proposal.number}`} /> : null}
    </div>
  );
}

function ResponseForm({ proposal, token, onAnswered }) {
  const [choice, setChoice] = useState(null);
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [agree, setAgree] = useState(false);
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState("");

  const submit = async (event) => {
    event.preventDefault();
    const next = {};
    if (!name.trim()) next.name = "Enter your full name.";
    if (choice === "accept" && !agree) next.agree = "Tick the box to accept.";
    if (choice === "renegotiate" && !note.trim()) next.note = "Tell us what you would like changed.";
    setErrors(next);
    if (Object.keys(next).length) return;
    setBusy(true);
    setFailure("");
    try {
      onAnswered(await respondToProposal(token, { decision: choice, name: name.trim(), note: note.trim() || undefined, agree: choice === "accept" ? agree : undefined }));
    } catch (err) {
      setFailure(getErrorMessage(err, "Your answer could not be sent. Please try again."));
    } finally {
      setBusy(false);
    }
  };

  const selected = CHOICES.find((c) => c.key === choice);

  return (
    <form onSubmit={submit} noValidate>
      <h2 className="proposal-public-h2">Your decision</h2>
      <div className="proposal-public-choices" role="radiogroup" aria-label="Your decision">
        {CHOICES.map(({ key, label, icon: Icon, blurb }) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={choice === key}
            className={`proposal-public-choice ${key} ${choice === key ? "selected" : ""}`.trim()}
            onClick={() => {
              setChoice(key);
              setErrors({});
              setFailure("");
            }}
          >
            <Icon size={18} />
            <span className="row-title">{label}</span>
            <span className="row-meta">{blurb}</span>
          </button>
        ))}
      </div>

      {selected ? (
        <div className="proposal-public-form">
          <div className="form-grid">
            <Field className="span-2" label="Your full name" error={errors.name} htmlFor="pp-name">
              <input id="pp-name" value={name} maxLength={120} autoComplete="name" onChange={(e) => setName(e.target.value)} />
            </Field>
            <Field
              className="span-2"
              label={choice === "renegotiate" ? "What would you like changed?" : choice === "reject" ? "Reason" : "Anything we should know?"}
              hint={choice === "renegotiate" ? "required" : "optional"}
              error={errors.note}
              htmlFor="pp-note"
            >
              <textarea id="pp-note" rows={4} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
            </Field>
          </div>
          {choice === "accept" ? (
            <label className="proposal-public-agree">
              <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
              <span>
                I accept proposal {proposal.number}
                {proposal.grandTotal !== null ? ` for ${formatCurrency(proposal.grandTotal, { withCents: true })}` : ""}, including the terms and conditions in
                the PDF.
              </span>
            </label>
          ) : null}
          {errors.agree ? <div className="field-error">{errors.agree}</div> : null}
          {failure ? (
            <Alert tone="danger" style={{ marginTop: 12 }}>
              {failure}
            </Alert>
          ) : null}
          <button type="submit" className={`btn ${choice === "accept" ? "btn-primary" : choice === "reject" ? "btn-danger" : "btn-primary"}`} disabled={busy} style={{ marginTop: 14 }}>
            {busy ? "Sending…" : choice === "accept" ? "Accept proposal" : choice === "reject" ? "Decline proposal" : "Send my request"}
          </button>
        </div>
      ) : null}
    </form>
  );
}

export default function ProposalPage() {
  const { token } = useParams();
  const [proposal, setProposal] = useState(null);
  const [error, setError] = useState("");
  const [answered, setAnswered] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getPublicProposal(token)
      .then((data) => !cancelled && setProposal(data))
      .catch((err) => !cancelled && setError(getErrorMessage(err, "This proposal could not be loaded.")));
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    document.title = proposal ? `Proposal ${proposal.number} — ${proposal.business?.name ?? ""}` : "Your proposal";
  }, [proposal]);

  const business = proposal?.business?.name || "Your proposal";

  return (
    <div className="proposal-public">
      <header className="proposal-public-head">
        <div className="proposal-public-inner">
          <span className="proposal-public-brand">{business}</span>
        </div>
      </header>

      <main className="proposal-public-inner proposal-public-main">
        {error ? (
          <Alert tone="danger">{error}</Alert>
        ) : !proposal ? (
          <LoadingState label="Loading your proposal…" />
        ) : (
          <>
            <section className="proposal-public-card">
              <div className="proposal-public-title">
                <FileText size={20} />
                <div>
                  <h1>Your proposal, {proposal.customerName}</h1>
                  <div className="row-meta">
                    {proposal.number} · sent {formatDate(proposal.sentAt)}
                    {proposal.state === "open" ? ` · valid until ${formatDate(proposal.expiresAt)}` : ""}
                  </div>
                </div>
                {proposal.grandTotal !== null ? (
                  <div className="proposal-public-total">
                    <span className="row-meta">Total</span>
                    <strong>{formatCurrency(proposal.grandTotal, { withCents: true })}</strong>
                  </div>
                ) : null}
              </div>
              {proposal.message ? <p className="proposal-public-message">{proposal.message}</p> : null}
              {proposal.contact ? (
                <div className="row-meta">
                  From {proposal.contact.name}
                  {proposal.contact.email ? ` · ${proposal.contact.email}` : ""}
                  {proposal.contact.phone ? ` · ${proposal.contact.phone}` : ""}
                </div>
              ) : null}
            </section>

            {answered && proposal.state !== "open" ? (
              <div className="proposal-public-done">
                <CheckCircle2 size={22} />
                <span>Thank you — your answer has been sent to {proposal.contact?.name || "our team"}.</span>
              </div>
            ) : null}

            {proposal.state !== "open" ? (
              <section className="proposal-public-card">
                <ClosedNotice proposal={proposal} />
              </section>
            ) : null}

            <section className="proposal-public-card">
              <PdfPanel proposal={proposal} />
            </section>

            {proposal.state === "open" ? (
              <section className="proposal-public-card">
                <ResponseForm
                  proposal={proposal}
                  token={token}
                  onAnswered={(next) => {
                    setProposal(next);
                    setAnswered(true);
                    window.scrollTo({ top: 0, behavior: "smooth" });
                  }}
                />
              </section>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
