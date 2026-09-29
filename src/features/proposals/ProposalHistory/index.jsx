// Every proposal sent on a job, newest first: which quote went, to whom, when
// the customer opened it, and what they answered.

import { Send } from "lucide-react";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { proposalStatus, responseSummary } from "@/helpers/proposals";
import { formatCurrency } from "@/utils/formatCurrency";

export default function ProposalHistory({ proposals }) {
  if (!proposals.length)
    return <EmptyState icon={<Send size={26} strokeWidth={1.5} />} title="No proposal sent yet" body="Send the customer their proposal to get their answer." />;

  return (
    <div className="list-stack">
      {proposals.map((proposal) => {
        const status = proposalStatus(proposal);
        const answer = responseSummary(proposal);
        return (
          <div className="list-row" key={proposal.id} style={{ alignItems: "flex-start" }}>
            <div style={{ minWidth: 0 }}>
              <div className="row-title">
                {proposal.number}
                {proposal.quoteVersion ? ` · quote v${proposal.quoteVersion.version}` : ""}
                {proposal.grandTotal !== null ? ` · ${formatCurrency(proposal.grandTotal, { withCents: true })}` : ""}
              </div>
              <div className="row-meta" style={{ whiteSpace: "normal" }}>
                Prepared for {proposal.sentTo}
                {proposal.sentBy ? ` by ${proposal.sentBy.name}` : ""} on {formatDate(proposal.sentAt, { withTime: true })}
                {proposal.viewedAt ? ` · opened ${formatDate(proposal.viewedAt, { withTime: true })} (${proposal.viewCount} view${proposal.viewCount === 1 ? "" : "s"})` : " · not opened yet"}
              </div>
              {answer ? (
                <div className="row-meta" style={{ whiteSpace: "normal", marginTop: 4 }}>
                  {answer} on {formatDate(proposal.respondedAt, { withTime: true })}
                  {proposal.responseNote ? <> — “{proposal.responseNote}”</> : null}
                </div>
              ) : null}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4, alignItems: "flex-end", flexShrink: 0 }}>
              <Badge tone={status.tone}>{status.label}</Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}
