// One round of re-quoting, as both sides read it: what the customer asked
// for (their own words, with where they came from), sales' comments for the
// estimator, the version the customer saw, and — once the estimator has
// handed it back — what changed and the revised version. Shown on the
// proposal stage (sales) and the estimation screen (the estimator).

import Badge from "@/components/Badge";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { customerMessageSource, requoteStatus } from "@/helpers/proposals";
import { formatCurrency } from "@/utils/formatCurrency";

const versionLabel = (version) =>
  version
    ? `${version.quoteNumber || "quote"} v${version.version}${version.grandTotal !== null && version.grandTotal !== undefined ? ` (${formatCurrency(version.grandTotal, { withCents: true })})` : ""}`
    : null;

export default function RequoteSummary({ requote, timeZone, title }) {
  if (!requote) return null;
  const status = requoteStatus(requote);
  const saw = versionLabel(requote.quoteVersion);
  const revised = versionLabel(requote.revisedQuoteVersion);

  return (
    <div className="requote">
      <div className="requote-head">
        <div style={{ minWidth: 0 }}>
          <div className="row-title">{title ?? `Re-quote round ${requote.round}`}</div>
          <div className="row-meta" style={{ whiteSpace: "normal" }}>
            Requested by {requote.requestedBy?.name || "sales"} on {formatDate(requote.requestedAt, { withTime: true, timeZone })} · assigned to{" "}
            {requote.estimator?.name || "the estimator"}
          </div>
        </div>
        <Badge tone={status.tone}>{status.label}</Badge>
      </div>

      <div className="requote-section">
        <div className="requote-label">What the customer asked for</div>
        {requote.customerMessage ? (
          <>
            <blockquote className="requote-quote">{requote.customerMessage}</blockquote>
            <div className="row-meta" style={{ whiteSpace: "normal" }}>
              — {customerMessageSource(requote)}
            </div>
          </>
        ) : (
          <div className="row-meta" style={{ whiteSpace: "normal" }}>
            No message from the customer was recorded — see the comments below.
          </div>
        )}
      </div>

      <div className="requote-section">
        <div className="requote-label">Comments for the estimator</div>
        <div className="requote-text">{requote.comments}</div>
      </div>

      {saw || requote.proposal ? (
        <div className="requote-section">
          <div className="requote-label">What the customer saw</div>
          <div className="row-meta" style={{ whiteSpace: "normal" }}>
            {[requote.proposal ? `Proposal ${requote.proposal.number}` : null, saw].filter(Boolean).join(" · ")}
          </div>
        </div>
      ) : null}

      {requote.status === "completed" ? (
        <div className="requote-section">
          <div className="requote-label">
            What changed
            {requote.completedBy?.name ? ` — ${requote.completedBy.name}` : ""}
            {requote.completedAt ? `, ${formatDate(requote.completedAt, { withTime: true, timeZone })}` : ""}
          </div>
          {requote.estimatorNote ? <div className="requote-text">{requote.estimatorNote}</div> : <div className="row-meta">No note was left.</div>}
          {revised ? (
            <div className="row-meta" style={{ whiteSpace: "normal", marginTop: 4 }}>
              Revised quote: {revised}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
