// Control Centre → Data backup (admin.export: the superadmin, Business Owner
// and SysAdmin by default). Each business unit the person works in, when its
// last full Excel backup was downloaded and by whom, and a button that
// downloads one now. A full backup is every job in the unit — no stage,
// lifecycle or date filter. If nobody takes one for 7 days (the API's
// reminderDays), everyone who can is reminded; the reminder opens this page.

import { useCallback, useEffect, useState } from "react";
import { DatabaseBackup, Download } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import AdminNav from "@/components/AdminNav";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import { formatDate, timeAgo } from "@/helpers/dateTimeHelpers";
import { saveBlob } from "@/helpers/saveFile";
import { useNotifications } from "@/hooks/useNotifications";
import { getErrorMessage } from "@/services/api/client";
import { exportJobs, getBackupStatus } from "@/services/api/exportsApi";

const MUTED = { color: "var(--muted)" };
const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

/** Where one unit stands → { label, tone }. */
function standing(unit, reminderDays) {
  if (!unit.jobCount) return { label: "No jobs to back up", tone: "neutral" };
  if (!unit.lastBackup) return { label: "Never backed up", tone: "danger" };
  if (unit.due) return { label: `Overdue · ${plural(unit.daysSince, "day")}`, tone: "danger" };
  if (!reminderDays) return { label: "Backed up", tone: "success" };
  const left = Math.max(reminderDays - unit.daysSince, 0);
  return { label: left ? `Up to date · next due in ${plural(left, "day")}` : "Due today", tone: left ? "success" : "warning" };
}

export default function BackupPage() {
  const { notify } = useNotifications();
  const [status, setStatus] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      setStatus(await getBackupStatus());
    } catch (err) {
      setError(getErrorMessage(err, "Could not load the backup status."));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const download = async (unit) => {
    setBusyId(unit.id);
    setError("");
    try {
      // No stage, every lifecycle, no dates: the full backup that resets the reminder.
      const { blob, filename } = await exportJobs({ businessUnitId: unit.id, lifecycle: "all" });
      saveBlob(blob, filename);
      notify(`Downloaded ${filename}`);
      await load();
    } catch (err) {
      setError(getErrorMessage(err, "Could not download the backup."));
    } finally {
      setBusyId(null);
    }
  };

  const reminderDays = status?.reminderDays ?? 0;
  const units = status?.units ?? null;

  return (
    <>
      <PageHeader
        title="Data backup"
        description={
          reminderDays
            ? `Download every job in a business unit as one Excel file. If nobody downloads one for ${plural(reminderDays, "day")}, everyone who can take a backup is reminded.`
            : "Download every job in a business unit as one Excel file."
        }
      />
      <AdminNav />

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <div className="card card-pad">
        <p className="sub">
          A full backup holds every job in the unit — all stages and lifecycles — with its history, quotes, proposals,
          approvals, procurement, requests and site visits, one sheet each. Uploaded files are linked from the Documents
          sheet, not copied in. The file contains customers&apos; names, phone numbers and addresses: keep it somewhere
          safe.
        </p>
        {units === null ? (
          error ? null : <LoadingState label="Loading backups…" />
        ) : units.length === 0 ? (
          <EmptyState
            icon={<DatabaseBackup size={28} strokeWidth={1.5} />}
            title="No business units"
            body="You are not assigned to a business unit yet, so there is nothing to back up."
          />
        ) : (
          <div className="table-wrap">
            <table className="table stack">
              <thead>
                <tr>
                  <th>Business unit</th>
                  <th>Jobs</th>
                  <th>Last full backup</th>
                  <th>Status</th>
                  <th aria-label="Download" />
                </tr>
              </thead>
              <tbody>
                {units.map((unit) => {
                  const state = standing(unit, reminderDays);
                  const busy = busyId === unit.id;
                  return (
                    <tr key={unit.id}>
                      <td data-label="Business unit">
                        <strong>{unit.name}</strong> <span style={MUTED}>{unit.code}</span>
                      </td>
                      <td data-label="Jobs">{unit.jobCount}</td>
                      <td data-label="Last full backup">
                        {unit.lastBackup ? (
                          // One block, so a phone's stacked row keeps the date and who took it together.
                          <div>
                            {formatDate(unit.lastBackup.at, { withTime: true, timeZone: unit.timezone })}
                            <div style={{ ...MUTED, fontSize: "calc(12px * var(--text-scale))" }}>
                              {timeAgo(unit.lastBackup.at)}
                              {unit.lastBackup.byName ? ` · by ${unit.lastBackup.byName}` : ""}
                            </div>
                          </div>
                        ) : (
                          <span style={MUTED}>Never</span>
                        )}
                      </td>
                      <td data-label="Status">
                        <Badge tone={state.tone}>{state.label}</Badge>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <button
                          type="button"
                          className="btn btn-primary"
                          onClick={() => download(unit)}
                          disabled={busyId !== null || !unit.jobCount}
                        >
                          <Download size={16} /> {busy ? "Preparing the file…" : "Download backup"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
