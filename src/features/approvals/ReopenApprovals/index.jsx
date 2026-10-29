// Reopen Approvals (UAT exit logic AP-04, Oct 2026): once the job has been
// sent to Procurement its approvals are read-only; restricted roles can open
// them again, with a reason. The job goes back to the Approvals stage,
// Procurement is notified and any purchase orders already raised are flagged
// for review. It is sent on again with Send to Procurement.
//
// `job` - the approvals record; `onReopen(reason)` reopens and resolves false
// when it could not; `canReopen` - the person holds approvals.approve.

import { useState } from "react";
import { RotateCcw } from "lucide-react";
import Alert from "@/components/Alert";
import Modal from "@/components/Modal";
import { APPROVALS_STAGE } from "@/constants/approvals";

// Reopening is for jobs in Procurement or Construction (the API's rule too).
const REOPENABLE_STAGES = [6, 7];

export default function ReopenApprovals({ job, onReopen, canReopen = false }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!job || !onReopen || !canReopen || Number(job.stage) <= APPROVALS_STAGE.id) return null;
  if (!REOPENABLE_STAGES.includes(Number(job.stage)) || job.lifecycle !== "Active") return null;

  const reopen = async () => {
    setBusy(true);
    try {
      if ((await onReopen(reason.trim())) !== false) setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        onClick={() => {
          setReason("");
          setOpen(true);
        }}
      >
        <RotateCcw size={14} /> Reopen Approvals
      </button>
      {open ? (
        <Modal
          title="Reopen Approvals"
          confirmClose={false}
          onClose={() => setOpen(false)}
          actions={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={reopen} disabled={busy || !reason.trim()}>
                {busy ? "Reopening…" : "Reopen"}
              </button>
            </>
          }
        >
          <Alert tone="warning" style={{ marginBottom: 12 }}>
            The job returns to the Approvals stage. Procurement is notified, and any purchase orders already raised are flagged for review.
          </Alert>
          <label htmlFor="reopen-reason" className="row-title" style={{ display: "block", marginBottom: 6 }}>
            Reason <span aria-hidden="true">*</span>
          </label>
          <textarea
            id="reopen-reason"
            rows={4}
            maxLength={2000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Why the approvals need to change"
            style={{ width: "100%" }}
            autoFocus
          />
        </Modal>
      ) : null}
    </>
  );
}
