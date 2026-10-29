// Documents and notes added to an approval once the job has been sent to
// Procurement (UAT exit logic AP-02, Oct 2026): the approval's status stays as
// it is, and every addition is logged in the history.
//
// `item` - the approval (its additions are item.checklist.addenda);
// `onAdd({ note, files })` saves one; `upload(files)` files documents on the
// job and resolves [{ id, filename, url }].

import { useState } from "react";
import { ExternalLink, Paperclip, Plus } from "lucide-react";
import Alert from "@/components/Alert";
import { FilePicker } from "@/components/ChecklistForm";
import { formatDate } from "@/helpers/dateTimeHelpers";

export default function ApprovalAddenda({ item, canAdd = false, onAdd, upload = null }) {
  const addenda = Array.isArray(item.checklist?.addenda) ? item.checklist.addenda : [];
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [files, setFiles] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  if (!addenda.length && !canAdd) return null;

  const close = () => {
    setOpen(false);
    setNote("");
    setFiles([]);
    setError("");
  };
  const save = async () => {
    setBusy(true);
    setError("");
    try {
      await onAdd?.({ note: note.trim() || undefined, files });
      close();
    } catch (err) {
      setError(typeof err === "string" ? err : err?.message || "The document or note could not be added.");
    } finally {
      setBusy(false);
    }
  };
  const id = `addendum-${item.key}`;

  return (
    <div className="approval-addenda">
      {addenda.map((entry, index) => (
        <div key={`${entry.at}-${index}`} className="approval-addendum">
          <div className="row-meta">
            Added {formatDate(entry.at, { withTime: true })}
            {entry.by ? ` · ${entry.by}` : ""}
          </div>
          {entry.note ? <div className="approval-track-note">{entry.note}</div> : null}
          {(entry.files ?? []).map((file) =>
            file.url ? (
              <a key={file.id ?? file.filename} className="row-title cl-filename" href={file.url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <Paperclip size={13} /> {file.filename} <ExternalLink size={12} />
              </a>
            ) : (
              <span key={file.id ?? file.filename} className="row-title cl-filename" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                <Paperclip size={13} /> {file.filename}
              </span>
            ),
          )}
        </div>
      ))}
      {canAdd ? (
        open ? (
          <div className="approval-item-form">
            <div className="approval-item-fields">
              <label htmlFor={`${id}-note`} className="row-title">
                Note
              </label>
              <textarea id={`${id}-note`} rows={3} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} placeholder="What has been added, and why" disabled={busy} />
              <span className="row-title">Documents</span>
              <FilePicker id={`${id}-files`} files={files} onChange={setFiles} upload={upload} disabled={busy} />
              <p className="row-meta" style={{ whiteSpace: "normal", margin: 0 }}>
                The approval&apos;s status does not change. To change it, reopen the approvals.
              </p>
            </div>
            {error ? (
              <Alert tone="danger" style={{ marginTop: 10 }}>
                {error}
              </Alert>
            ) : null}
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={busy || (!note.trim() && !files.length)}>
                {busy ? "Adding…" : "Add"}
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={close} disabled={busy}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(true)}>
              <Plus size={14} /> Add document or note
            </button>
          </div>
        )
      ) : null}
    </div>
  );
}
