// On Hold (UAT exit logic JS-03 / NF-21, Oct 2026): a job at approvals paused
// by hand, with a reason - the badge shows On Hold and it cannot be sent to
// Procurement until it is resumed.
//
// `job` - the approvals record (job.onHold: { reason, by, at } while paused);
// `onHold(reason)` / `onResume()` resolve false when they could not be done;
// `canHold` - the person works the approvals.

import { useState } from "react";
import { Pause, Play } from "lucide-react";
import Modal from "@/components/Modal";
import { APPROVALS_STAGE } from "@/constants/approvals";

export default function HoldApprovals({ job, onHold, onResume, canHold = false }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  if (!job || !canHold || !onHold || Number(job.stage) !== APPROVALS_STAGE.id || job.lifecycle !== "Active") return null;

  const run = async (call) => {
    setBusy(true);
    try {
      if ((await call()) !== false) setOpen(false);
    } finally {
      setBusy(false);
    }
  };

  if (job.onHold)
    return (
      <button type="button" className="btn btn-ghost btn-sm" onClick={() => run(() => onResume?.())} disabled={busy}>
        <Play size={14} /> {busy ? "Resuming…" : "Resume"}
      </button>
    );

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
        <Pause size={14} /> Put On Hold
      </button>
      {open ? (
        <Modal
          title="Put On Hold"
          confirmClose={false}
          onClose={() => setOpen(false)}
          actions={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="btn btn-primary" onClick={() => run(() => onHold(reason.trim()))} disabled={busy || !reason.trim()}>
                {busy ? "Saving…" : "Put On Hold"}
              </button>
            </>
          }
        >
          <p style={{ marginTop: 0 }}>The job stays at Approvals and can&apos;t be sent to Procurement until it is resumed.</p>
          <label htmlFor="hold-reason" className="row-title" style={{ display: "block", marginBottom: 6 }}>
            Reason <span aria-hidden="true">*</span>
          </label>
          <textarea
            id="hold-reason"
            rows={3}
            maxLength={2000}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. Customer travelling until 20 Nov"
            style={{ width: "100%" }}
            autoFocus
          />
        </Modal>
      ) : null}
    </>
  );
}
