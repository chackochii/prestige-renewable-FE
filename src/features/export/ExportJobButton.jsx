// "Export to Excel" on a job's page (admin.export): everything on the job —
// the record, its history, quotes, proposals, approvals, procurement, requests
// and links to its files — as one workbook, a sheet each.

import { useState } from "react";
import { FileSpreadsheet } from "lucide-react";
import { exportJob } from "@/services/api/exportsApi";
import { saveBlob } from "@/helpers/saveFile";
import { useNotifications } from "@/hooks/useNotifications";

export default function ExportJobButton({ opportunityId }) {
  const { notify } = useNotifications();
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const { blob, filename } = await exportJob(opportunityId);
      saveBlob(blob, filename);
      notify(`Downloaded ${filename}`);
    } catch (err) {
      notify(err?.message || "Could not export this job.", "danger");
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      className="btn btn-ghost"
      onClick={run}
      disabled={busy}
      title="Download everything on this job as an Excel file"
    >
      <FileSpreadsheet size={16} /> {busy ? "Exporting…" : "Export to Excel"}
    </button>
  );
}
