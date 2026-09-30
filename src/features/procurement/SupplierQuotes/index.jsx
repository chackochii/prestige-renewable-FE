// The supplier quotes received on a job, as the record has them — shown above
// the supplier-quote checklist (CL-12) so the coordinator confirms against
// what actually came in.

import { FileText } from "lucide-react";
import Alert from "@/components/Alert";
import SectionHead from "@/components/SectionHead";
import { boqLines, quotedLineCount, quotesReceived } from "@/helpers/procurement";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { formatCurrency } from "@/utils/formatCurrency";

export default function SupplierQuotes({ job }) {
  const quotes = Array.isArray(job?.quotes) ? job.quotes : [];
  const lines = boqLines(job).length;
  const quoted = quotedLineCount(job);

  return (
    <div style={{ marginBottom: 20 }}>
      {quotesReceived(job) ? (
        <Alert tone="success">Every line is quoted — {quotes.length} supplier quote{quotes.length === 1 ? "" : "s"} on record.</Alert>
      ) : (
        <Alert tone="info">
          {quoted} of {lines} lines quoted so far. Quotes are recorded here as they come in; the checklist below is worked once the ones being compared are in.
        </Alert>
      )}
      <SectionHead icon={<FileText size={13} />} title="Quotes received" />
      {quotes.length === 0 ? (
        <p className="lede" style={{ fontSize: 14 }}>
          None yet.
        </p>
      ) : (
        <div className="list-stack">
          {quotes.map((quote) => (
            <div className="list-row" key={quote.supplier}>
              <div>
                <div className="row-title">{quote.supplier}</div>
                <div className="row-meta">
                  Received {formatDate(quote.receivedAt)}
                  {quote.validUntil ? ` · valid until ${formatDate(quote.validUntil)}` : ""}
                </div>
              </div>
              <div className="row-title" style={{ textAlign: "right" }}>
                {formatCurrency(quote.total)}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
