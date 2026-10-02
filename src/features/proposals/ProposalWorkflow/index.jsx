// One job's proposal: the "Customer accepted the proposal?" gate, sending the
// proposal from the rep's own email, resending with a new link, recording an
// answer given by phone, sending the job back to the estimator for a re-quote
// when the customer wants changes (and sending the revised proposal when it
// comes back), and every proposal and re-quote round so far.
//
// Nothing is emailed by the server. Sending creates the customer's link, opens
// the email app signed in on the device (or Gmail) with the email written, and
// downloads the quote PDF to attach — an email link cannot carry a file.
//
// `opportunity` is a record or a board row's opportunity: { id, number, stage,
// lifecycle, customerEmail, customerFirstName, estimatorId, estimator, ... }.
// `onChanged(result)` runs after anything is sent or recorded, so the page can
// refresh its list — and the opportunity, when an acceptance moved it on or a
// re-quote moved it back.
//
// `embedded` drops the card chrome for use inside another card — the
// opportunity page's stage-3 panel already has a heading of its own.

import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Download, Mail, PhoneCall, RefreshCw, Send, Undo2 } from "lucide-react";
import Alert from "@/components/Alert";
import ApprovalGate from "@/components/ApprovalGate";
import Badge from "@/components/Badge";
import Card from "@/components/Card";
import CopyLinkButton from "@/components/CopyLinkButton";
import LoadingState from "@/components/LoadingState";
import SectionHead from "@/components/SectionHead";
import ProposalHistory from "@/features/proposals/ProposalHistory";
import RecordOutcomeModal from "@/features/proposals/RecordOutcomeModal";
import RequoteRequestModal from "@/features/proposals/RequoteRequestModal";
import RequoteSummary from "@/features/proposals/RequoteSummary";
import SendProposalForm from "@/features/proposals/SendProposalForm";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { downloadInvoice, invoiceFileName } from "@/helpers/invoice";
import {
  DEFAULT_MESSAGE,
  PROPOSAL_STAGE_ID,
  REVISED_MESSAGE,
  gmailComposeUrl,
  isLive,
  isOpen,
  isRequoteOpen,
  mailtoUrl,
  navigateTab,
  openMailApp,
  proposalEmailBody,
  proposalStatus,
  wantsChanges,
} from "@/helpers/proposals";
import { getErrorMessage } from "@/services/api/client";
import { listQuoteVersions } from "@/services/api/leadsApi";
import { listProposals, listRequotes, resendProposal } from "@/services/api/proposalsApi";

const GATE_OUTCOME = { accepted: "approved", rejected: "rejected" };

/** What the gate says while it waits. */
function waitingText(latest, requote) {
  if (isRequoteOpen(requote))
    return `With ${requote.estimator?.name || "the estimator"} for a re-quote since ${formatDate(requote.requestedAt)} (round ${requote.round}) — the revised quote comes back here.`;
  if (latest?.status === "re-estimated")
    return requote?.status === "completed"
      ? `Revised quote back from ${requote.completedBy?.name || "the estimator"} on ${formatDate(requote.completedAt)} — send it to the customer below.`
      : "Sent back for a re-quote.";
  if (!latest || latest.status === "withdrawn") return "No proposal with the customer yet — send one below.";
  if (latest.status === "negotiation") return "The customer asked for changes — send the job to the estimator for a re-quote.";
  if (latest.expired) return `The link expired ${formatDate(latest.expiresAt)} — resend it or send a revised proposal.`;
  if (latest.status === "presented")
    return `Opened ${formatDate(latest.viewedAt, { withTime: true })} (${latest.viewCount} view${latest.viewCount === 1 ? "" : "s"}) — waiting for the customer's answer.`;
  return `Prepared for ${latest.sentTo} on ${formatDate(latest.sentAt)} — not opened yet.`;
}

// Longer mail links can be cut short by the email app; the copy button is the way round.
const LONG_MAIL_LINK = 2000;

/**
 * After the email was opened: what is left for the sender to do (attach the
 * PDF, press Send), both ways to open the email again, and the link and email
 * text in case nothing opened. Shown once — only the link's hash is kept.
 */
function EmailNotice({ prepared, onDownload, onDismiss }) {
  const { proposal, link, mailUrl, gmailUrl, body, fileName, via, opened } = prepared;
  const where = via === "gmail" ? "Gmail" : "your email app";
  const mailButton = (
    <a key="mail" className={`btn btn-sm ${via === "mail" ? "btn-primary" : "btn-ghost"}`} href={mailUrl} rel="noreferrer">
      <Mail size={14} /> {via === "mail" ? "Open email app again" : "Open in email app"}
    </a>
  );
  const gmailButton = (
    <a key="gmail" className={`btn btn-sm ${via === "gmail" ? "btn-primary" : "btn-ghost"}`} href={gmailUrl} target="_blank" rel="noreferrer">
      <Mail size={14} /> {via !== "gmail" ? "Open in Gmail" : opened ? "Open Gmail again" : "Open Gmail"}
    </a>
  );
  return (
    <Alert tone={opened ? "success" : "warning"} style={{ marginBottom: 14 }}>
      {opened ? (
        <>
          <strong>
            {via === "gmail" ? "Gmail is open" : "Your email app is opening"} with the proposal for {proposal.sentTo}.
          </strong>{" "}
        </>
      ) : (
        // The browser's pop-up blocker stopped the tab. The email is ready; a
        // click on the link below always opens, because it is a plain link.
        <div style={{ marginBottom: 8 }}>
          <strong>Your browser blocked the Gmail tab, so it did not open.</strong> The email to {proposal.sentTo} is ready — click{" "}
          <strong>Open Gmail</strong> below. To have it open by itself next time, allow pop-ups for this site: click the blocked pop-up icon at the
          right end of the address bar and choose “Always allow”.
        </div>
      )}
      Attach the PDF that just downloaded{fileName ? ` (${fileName})` : ""} — email links cannot attach files — then press Send in {where}. You will be
      notified when the customer opens it and when they answer.
      {via === "mail" ? " Nothing opened? Use Open in Gmail, or copy the email text into any email." : ""}
      {mailUrl.length > LONG_MAIL_LINK ? " The message is long, so some email apps cut it short — check it all arrived, or paste the copied email text." : ""}
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
        {via === "gmail" ? [gmailButton, mailButton] : [mailButton, gmailButton]}
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDownload}>
          <Download size={14} /> Download PDF again
        </button>
        <CopyLinkButton value={body} label="Copy email text" />
        <button type="button" className="btn btn-ghost btn-sm" onClick={onDismiss}>
          Done
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>
        <code className="proposal-link" title={link}>
          {link}
        </code>
        <CopyLinkButton value={link} />
      </div>
      <div className="row-meta" style={{ marginTop: 6, whiteSpace: "normal" }}>
        This link is only shown now. To get a new one later, use “Resend with a new link”.
      </div>
    </Alert>
  );
}

export default function ProposalWorkflow({ opportunity, canEdit = false, onChanged, embedded = false }) {
  const { unit } = useBusinessUnit();
  const { user } = useAuth();
  const [proposals, setProposals] = useState(null);
  const [versions, setVersions] = useState([]);
  const [requotes, setRequotes] = useState([]);
  const [error, setError] = useState("");
  const [composing, setComposing] = useState(false);
  const [prepared, setPrepared] = useState(null); // the last send or resend: { proposal, link, mailUrl, gmailUrl, body, fileName, via, opened }
  const [recording, setRecording] = useState(false);
  const [requoting, setRequoting] = useState(false);
  const [resending, setResending] = useState(false);

  const id = opportunity?.id;

  const load = useCallback(async () => {
    if (!id) return;
    setError("");
    try {
      const [list, saved, rounds] = await Promise.all([listProposals(id), listQuoteVersions(id), listRequotes(id)]);
      setProposals(list ?? []);
      setVersions(saved ?? []);
      setRequotes(rounds ?? []);
    } catch (err) {
      setError(getErrorMessage(err, "Proposals could not be loaded."));
      setProposals([]);
    }
  }, [id]);

  // A different job starts clean: its own proposals, nothing half-composed.
  useEffect(() => {
    setProposals(null);
    setRequotes([]);
    setComposing(false);
    setPrepared(null);
    load();
  }, [load]);

  if (!opportunity) return null;

  const latest = proposals?.[0] ?? null;
  const requote = requotes[0] ?? null;
  const active = (opportunity.lifecycle ?? "Active") === "Active";
  const atStage = Number(opportunity.stage) === PROPOSAL_STAGE_ID && active;
  const canSend = canEdit && atStage;
  // With the estimator: nothing to send until the revised quote is back.
  const requoteOpen = isRequoteOpen(requote);
  // Back from the estimator with a revised quote the customer has not seen.
  const revisedReady = atStage && latest?.status === "re-estimated" && requote?.status === "completed";
  // A re-quote can be raised on anything the customer has not accepted —
  // usually after they asked for changes, but also before anything went out.
  const canRequote = canSend && !requoteOpen && latest?.status !== "accepted";
  // With nothing live the form is the next step; with a proposal out, or the
  // customer wanting changes (a re-quote is the usual answer), sending again
  // is a deliberate choice.
  const formOpen = canSend && (composing || !latest || (!isLive(latest) && latest.status !== "rejected"));
  const status = proposalStatus(latest);
  // Every round but the one the notices above already show in full.
  const shownRound = requoteOpen || revisedReady ? requote?.id : null;
  const earlierRounds = requotes.filter((round) => round.id !== shownRound);

  /** The quote version a proposal was built from, with the snapshot its PDF is drawn from. */
  const versionOf = (proposal) => versions.find((version) => version.id === proposal?.quoteVersion?.id) ?? null;

  const downloadPdf = (proposal) => {
    const version = versionOf(proposal);
    if (version?.snapshot) downloadInvoice({ unit, version }).catch(() => setError("The PDF could not be built."));
  };

  // The server has made the link: write the email, open it in the device's
  // email app (or point the waiting tab at Gmail), and download the PDF for
  // the sender to attach.
  const afterSend = async (result, { via = "mail", tab = null } = {}) => {
    const { proposal, link } = result;
    const body = proposalEmailBody({
      customerFirstName: opportunity.customerFirstName,
      message: proposal.emailMessage,
      link,
      proposal,
      senderName: user?.name,
      businessName: unit?.name,
    });
    const email = { to: proposal.sentTo, subject: proposal.emailSubject, body };
    const mailUrl = mailtoUrl(email);
    const gmailUrl = gmailComposeUrl(email);
    let opened = true;
    if (via === "gmail") opened = navigateTab(tab, gmailUrl);
    else openMailApp(mailUrl);
    const version = versionOf(proposal);
    downloadPdf(proposal);
    setPrepared({ proposal, link, mailUrl, gmailUrl, body, via, opened, fileName: version ? invoiceFileName({ version }) : null });
    setComposing(false);
    await load();
    onChanged?.(result);
  };

  // A resend opens the device's email app; the notice offers Gmail as well.
  const resend = async () => {
    setResending(true);
    try {
      await afterSend(await resendProposal(opportunity.id, latest.id));
    } catch (err) {
      setError(getErrorMessage(err, "The proposal could not be resent."));
    } finally {
      setResending(false);
    }
  };

  const requoteButton = (primary = false) => (
    <button type="button" className={`btn btn-sm ${primary ? "btn-primary" : "btn-ghost"}`} onClick={() => setRequoting(true)}>
      <Undo2 size={14} /> Send to estimator for a re-quote
    </button>
  );

  const body =
    proposals === null ? (
      <LoadingState label="Loading proposals…" />
    ) : (
      <>
        {error ? (
          <Alert tone="danger" style={{ marginBottom: 14 }}>
            {error}
          </Alert>
        ) : null}

        <ApprovalGate
          question="Customer accepted the proposal?"
          outcome={GATE_OUTCOME[latest?.status] ?? "pending"}
          yes={{ title: "Approvals", detail: "The job moves on as soon as the customer accepts" }}
          no={{
            title: latest?.status === "rejected" ? "Declined by the customer" : "Changes wanted or declined",
            detail:
              latest?.status === "rejected"
                ? latest.responseNote || "Send it for a re-quote, send a revised proposal, or mark the job lost"
                : "Back to the estimator for a re-quote, then a revised proposal",
          }}
          waiting={waitingText(latest, requote)}
        />

        {latest?.status === "negotiation" ? (
          <Alert tone="warning" style={{ marginTop: 14 }}>
            <strong>{latest.responseName || "The customer"} asked for changes</strong> on {formatDate(latest.respondedAt, { withTime: true })}
            {latest.responseChannel === "staff" ? ` (recorded by ${latest.recordedBy?.name || "sales"})` : ""}:
            <blockquote className="requote-quote" style={{ marginTop: 8 }}>
              {latest.responseNote}
            </blockquote>
            {canRequote ? (
              <>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 10 }}>{requoteButton(true)}</div>
                <div className="row-meta" style={{ marginTop: 8, whiteSpace: "normal" }}>
                  Their message goes to the estimator with your comments, and the revised quote comes back here to send. If no re-pricing is
                  needed, send a revised proposal below instead.
                </div>
              </>
            ) : null}
          </Alert>
        ) : null}
        {requoteOpen ? (
          <Alert tone="info" style={{ marginTop: 14 }}>
            <strong>With {requote.estimator?.name || "the estimator"} for a re-quote.</strong> The job is back at Estimation; once the revised quote
            is handed back, it is sent to the customer from here.
            <div style={{ marginTop: 10 }}>
              <RequoteSummary requote={requote} timeZone={unit?.timezone} />
            </div>
          </Alert>
        ) : null}
        {revisedReady ? (
          <Alert tone="success" style={{ marginTop: 14 }}>
            <strong>Revised quote ready</strong> — {requote.completedBy?.name || "the estimator"} handed it back on{" "}
            {formatDate(requote.completedAt, { withTime: true })}. Send it to the customer below; the newest version is preselected.
            <div style={{ marginTop: 10 }}>
              <RequoteSummary requote={requote} timeZone={unit?.timezone} />
            </div>
          </Alert>
        ) : null}
        {latest?.status === "accepted" ? (
          <Alert tone="success" style={{ marginTop: 14 }}>
            <strong>Accepted</strong> by {latest.responseName || "the customer"} on {formatDate(latest.respondedAt, { withTime: true })}
            {latest.responseChannel === "staff" ? ` (recorded by ${latest.recordedBy?.name || "sales"})` : " online"}. The job has moved on to Approvals.
          </Alert>
        ) : null}

        <div style={{ marginTop: 18 }}>
          {prepared ? <EmailNotice prepared={prepared} onDownload={() => downloadPdf(prepared.proposal)} onDismiss={() => setPrepared(null)} /> : null}

          {canSend && latest && latest.status !== "accepted" ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
              {isOpen(latest) || (latest.expired && latest.status !== "negotiation") ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={resend} disabled={resending}>
                  <RefreshCw size={14} /> {resending ? "Resending…" : "Resend with a new link"}
                </button>
              ) : null}
              {isLive(latest) ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setRecording(true)}>
                  <PhoneCall size={14} /> Record the customer's answer
                </button>
              ) : null}
              {canRequote && latest.status !== "negotiation" ? requoteButton(false) : null}
              {!formOpen ? (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setComposing(true)}>
                  <Send size={14} /> Send a revised proposal
                </button>
              ) : null}
            </div>
          ) : null}

          {formOpen ? (
            <>
              <SectionHead icon={<Send size={13} />} title={latest && latest.status !== "withdrawn" ? "Send a revised proposal" : "Send the proposal"} />
              {versions.length ? (
                <SendProposalForm
                  key={`${opportunity.id}-${versions[0]?.id}`}
                  opportunity={opportunity}
                  versions={versions}
                  proposals={proposals}
                  unit={unit}
                  defaultMessage={(latest && wantsChanges(latest)) || revisedReady ? REVISED_MESSAGE : DEFAULT_MESSAGE}
                  onSent={afterSend}
                  onCancel={composing ? () => setComposing(false) : undefined}
                />
              ) : (
                <Alert tone="warning">
                  No saved quote version yet. Estimation saves one from the quote builder
                  {opportunity.number ? (
                    <>
                      {" "}
                      on <Link to={`/opportunities/${opportunity.id}`}>{opportunity.number}</Link>
                    </>
                  ) : null}
                  ; it can then be sent from here.
                </Alert>
              )}
              {canRequote && !latest ? (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 12 }}>
                  <span className="row-meta">Quote not right yet?</span>
                  {requoteButton(false)}
                </div>
              ) : null}
            </>
          ) : null}
          {!canEdit && !latest && !requoteOpen ? <p className="row-meta">Sales sends the proposal from here.</p> : null}
        </div>

        {earlierRounds.length ? (
          <div style={{ marginTop: 18 }}>
            <SectionHead icon={<Undo2 size={13} />} title={shownRound ? "Earlier re-quote rounds" : "Re-quote rounds"} />
            <div className="list-stack">
              {earlierRounds.map((round) => (
                <RequoteSummary key={round.id} requote={round} timeZone={unit?.timezone} />
              ))}
            </div>
          </div>
        ) : null}

        <div style={{ marginTop: 18 }}>
          <SectionHead icon={<Send size={13} />} title="Proposals sent" />
          <ProposalHistory proposals={proposals} />
        </div>

        {recording && latest ? (
          <RecordOutcomeModal
            opportunity={opportunity}
            proposal={latest}
            onClose={() => setRecording(false)}
            onRecorded={async (result) => {
              setRecording(false);
              await load();
              onChanged?.(result);
            }}
          />
        ) : null}
        {requoting ? (
          <RequoteRequestModal
            opportunity={opportunity}
            proposal={latest}
            onClose={() => setRequoting(false)}
            onRequested={async (result) => {
              setRequoting(false);
              setComposing(false);
              await load();
              onChanged?.(result);
            }}
          />
        ) : null}
      </>
    );

  if (embedded) return <div>{body}</div>;

  return (
    <Card
      title={`${opportunity.number} · ${opportunity.customer ?? ""}`}
      icon={<Send size={16} />}
      sub={[opportunity.customerEmail, opportunity.salesperson?.name ? `${opportunity.salesperson.name} (sales)` : null].filter(Boolean).join(" · ")}
      actions={<Badge tone={requoteOpen ? "warning" : status.tone}>{requoteOpen ? "With the estimator — re-quote" : status.label}</Badge>}
    >
      {body}
    </Card>
  );
}
