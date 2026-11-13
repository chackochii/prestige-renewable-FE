// Excel exports of job data (admin.export). The API answers with the .xlsx
// itself, so these return { blob, filename } for helpers/saveFile — not the
// usual { success, data } envelope. A refusal still arrives as a JSON error
// (client.js reads it out of the blob), with the API's message.

import { apiClient, unwrap } from "./client";

// A whole unit's workbook reads every table the jobs touch and is built
// before it is sent, against a database far away: more than the usual 30 s.
const EXPORT_TIMEOUT = 180000;

/** The name the API gave the file (Content-Disposition), else the fallback. */
const fileNameOf = (response, fallback) => {
  const header = response.headers?.["content-disposition"] || "";
  const match = /filename="?([^";]+)"?/i.exec(header);
  return match ? match[1] : fallback;
};

/** One job, every stage's records → { blob, filename } */
export async function exportJob(id) {
  const response = await apiClient.get(`/opportunities/${id}/export`, {
    responseType: "blob",
    timeout: EXPORT_TIMEOUT,
  });
  return { blob: response.data, filename: fileNameOf(response, `job-${id}.xlsx`) };
}

/**
 * Every job in a business unit, every stage (admin.export is the backup
 * permission). With no stage, lifecycle "all" and no dates it is a full
 * backup, which resets the 7-day reminder.
 * params: { businessUnitId, stage?, lifecycle? (Active | Won | Lost | Closed | all), from?, to? (YYYY-MM-DD, day created) }
 */
export async function exportJobs(params) {
  const response = await apiClient.get("/opportunities/export", {
    params,
    responseType: "blob",
    timeout: EXPORT_TIMEOUT,
  });
  return { blob: response.data, filename: fileNameOf(response, "jobs.xlsx") };
}

/** The caller's units and their last full backup → { reminderDays, units: [{ id, code, name, timezone, jobCount, lastBackup: { at, byName } | null, daysSince, due }] } */
export async function getBackupStatus() {
  return unwrap(await apiClient.get("/opportunities/export/backups"));
}
