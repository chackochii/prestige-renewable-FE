// "Export to Excel" on Leads and the Jobs Board (admin.export): every job in
// the current business unit that matches the stage, lifecycle and creation
// dates picked here, as one workbook — a Jobs sheet with a row per job, then a
// sheet per kind of record (history, quotes, proposals, approvals,
// procurement, requests, documents). The dialog starts from the list's own
// filters. admin.export is the backup permission, so every stage the unit
// runs is offered, whatever this person reads day to day. All stages, all
// lifecycles and no dates make it a full backup, which resets the 7-day
// reminder (also one click on Control Centre → Data backup).

import { useMemo, useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import Modal from "@/components/Modal";
import Field from "@/components/Field";
import Alert from "@/components/Alert";
import { enabledStagesFor } from "@/constants/stages";
import { saveBlob } from "@/helpers/saveFile";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { useNotifications } from "@/hooks/useNotifications";
import { exportJobs } from "@/services/api/exportsApi";

const LIFECYCLE_OPTIONS = [
  { value: "all", label: "All lifecycles" },
  { value: "Active", label: "Active" },
  { value: "Won", label: "Won" },
  { value: "Lost", label: "Lost" },
  { value: "Closed", label: "Closed" },
];

function ExportJobsModal({ onClose, defaultStage = "", defaultLifecycle = "all" }) {
  const { unit, unitId } = useBusinessUnit();
  const { notify } = useNotifications();
  const stages = useMemo(() => enabledStagesFor(unit), [unit]);
  const [stage, setStage] = useState(stages.some((s) => String(s.id) === String(defaultStage)) ? String(defaultStage) : "");
  const [lifecycle, setLifecycle] = useState(LIFECYCLE_OPTIONS.some((o) => o.value === defaultLifecycle) ? defaultLifecycle : "all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const datesBackwards = Boolean(from && to && from > to);
  const fullBackup = !stage && lifecycle === "all" && !from && !to;
  // A refusal ("No jobs match these filters") is about the filters as they were; changing one clears it.
  const edit = (setter) => (e) => {
    setter(e.target.value);
    setError("");
  };

  const run = async () => {
    if (datesBackwards) return;
    setBusy(true);
    setError("");
    try {
      const { blob, filename } = await exportJobs({
        businessUnitId: unitId,
        ...(stage ? { stage } : {}),
        lifecycle,
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      });
      saveBlob(blob, filename);
      notify(`Downloaded ${filename}`);
      onClose();
    } catch (err) {
      setError(err?.message || "Could not export the jobs.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      title="Export jobs to Excel"
      body={`Every matching job in ${unit?.name || "this business unit"}, with its history, quotes, proposals, approvals, procurement, requests and documents, one sheet each. Uploaded files are linked from the Documents sheet, not copied into the file.`}
      onClose={onClose}
      confirmClose={false}
      actions={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={run} disabled={busy || datesBackwards || !unitId}>
            <FileSpreadsheet size={16} /> {busy ? "Preparing the file…" : "Download Excel"}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="Stage" htmlFor="export-stage">
          <select id="export-stage" value={stage} onChange={edit(setStage)}>
            <option value="">All stages</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Lifecycle" htmlFor="export-lifecycle">
          <select id="export-lifecycle" value={lifecycle} onChange={edit(setLifecycle)}>
            {LIFECYCLE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Created from" hint="optional" htmlFor="export-from">
          <input id="export-from" type="date" value={from} onChange={edit(setFrom)} />
        </Field>
        <Field
          label="Created to"
          hint="optional"
          htmlFor="export-to"
          error={datesBackwards ? "The end date is before the start date." : ""}
        >
          <input id="export-to" type="date" value={to} min={from || undefined} onChange={edit(setTo)} />
        </Field>
      </div>
      <p className="hint" style={{ margin: "12px 0 0", color: "var(--muted)", fontSize: "calc(12.5px * var(--text-scale))" }}>
        {fullBackup
          ? "Full backup: every job in the business unit. This resets the backup reminder."
          : "Filtered export — not a full backup. Choose All stages, All lifecycles and no dates for one."}
      </p>
      {error ? (
        <Alert tone="danger" style={{ marginTop: 12, marginBottom: 0 }}>
          {error}
        </Alert>
      ) : null}
    </Modal>
  );
}

/** The header button and its dialog. defaultStage / defaultLifecycle: the list's current filters. */
export default function ExportJobsButton({ defaultStage, defaultLifecycle }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" className="btn btn-ghost" onClick={() => setOpen(true)} title="Download these jobs as an Excel file">
        <FileSpreadsheet size={16} /> Export to Excel
      </button>
      {open ? (
        <ExportJobsModal onClose={() => setOpen(false)} defaultStage={defaultStage} defaultLifecycle={defaultLifecycle} />
      ) : null}
    </>
  );
}
