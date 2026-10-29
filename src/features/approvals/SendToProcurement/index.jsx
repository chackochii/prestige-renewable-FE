// Send to Procurement: the way out of approvals, by hand (UAT exit logic,
// Oct 2026 - nothing moves the job on by itself any more). Shown on every
// approvals screen; disabled until the job is ready, with what is still
// outstanding on hover. Sending asks for confirmation - and, when any
// approval came with conditions, for them to be reviewed first - then moves
// the job to procurement; the approvals become read-only.
//
// `job` - the approvals record (useApprovalJob); `onSend({ conditionsReviewed })`
// moves the job on and resolves false when it could not; `canSend` - the
// person may move jobs out of approvals (RBAC).

import { useState } from "react";
import { Send } from "lucide-react";
import Alert from "@/components/Alert";
import Modal from "@/components/Modal";
import { approvalConditions, sendBlockers } from "@/helpers/approvalChecklist";

export default function SendToProcurement({ job, onSend, canSend = false }) {
  const [open, setOpen] = useState(false);
  const [reviewed, setReviewed] = useState(false);
  const [sending, setSending] = useState(false);
  if (!job || !onSend || Number(job.stage) > 5) return null;

  const blockers = [...sendBlockers(job), ...(canSend ? [] : ["Only roles that may move jobs out of Approvals can send it"])];
  const conditions = approvalConditions(job);

  const send = async () => {
    setSending(true);
    try {
      const sent = await onSend({ conditionsReviewed: conditions.length > 0 && reviewed });
      if (sent !== false) setOpen(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <span title={blockers.length ? blockers.join("\n") : "Send this job to Procurement"}>
        <button
          type="button"
          className="btn btn-primary btn-sm"
          disabled={blockers.length > 0}
          onClick={() => {
            setReviewed(false);
            setOpen(true);
          }}
        >
          <Send size={14} /> Send to Procurement
        </button>
      </span>
      {open ? (
        <Modal
          title="Send to Procurement"
          confirmClose={false}
          onClose={() => setOpen(false)}
          actions={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={sending}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={send} disabled={sending || (conditions.length > 0 && !reviewed)}>
                {sending ? "Sending…" : "Confirm"}
              </button>
            </>
          }
        >
          {conditions.length ? (
            <>
              <p style={{ marginTop: 0 }}>These approvals were given with conditions. They will be shown on the Procurement and Installation screens.</p>
              <div className="list-stack" style={{ marginBottom: 12 }}>
                {conditions.map((entry) => (
                  <div className="list-row" key={entry.key} style={{ alignItems: "flex-start" }}>
                    <span className="row-title">{entry.label}</span>
                    <span style={{ whiteSpace: "pre-wrap", textAlign: "right" }}>{entry.conditions}</span>
                  </div>
                ))}
              </div>
              <label className="check" style={{ marginBottom: 12 }}>
                <input type="checkbox" checked={reviewed} onChange={(e) => setReviewed(e.target.checked)} />
                <span>I&apos;ve reviewed these conditions</span>
              </label>
            </>
          ) : null}
          <Alert tone="info">Send this job to Procurement? Approvals will become read-only.</Alert>
        </Modal>
      ) : null}
    </>
  );
}
