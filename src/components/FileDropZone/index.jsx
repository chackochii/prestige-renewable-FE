// Drop zone plus the grid of files already attached. Files are uploaded by
// the parent (onAdd receives File[]); this component only handles picking,
// drag-and-drop, the size check and rendering the list.

import { useRef, useState } from "react";
import { CloudUpload } from "lucide-react";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { documentFileUrl } from "@/services/api/leadsApi";

const DEFAULT_ACCEPT = "image/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.dwg,.dxf,.msg,.eml";
const MAX_BYTES = 10 * 1024 * 1024;

function isImageDocument(doc) {
  const mime = doc?.mime || "";
  return mime.startsWith("image/") || /\.(jpe?g|png|gif|webp|heic|bmp)$/i.test(doc?.name || "");
}

export default function FileDropZone({
  files = [],
  onAdd,
  onRemove,
  accept = DEFAULT_ACCEPT,
  title,
  hint = "Images, PDF and office files up to 10 MB each.",
  canEdit = true,
  compact = false,
  timeZone,
}) {
  const inputRef = useRef(null);
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const list = Array.isArray(files) ? files : [];

  const handleFiles = async (picked) => {
    const chosen = Array.from(picked || []);
    if (!chosen.length || !onAdd || !canEdit) return;
    const tooBig = chosen.filter((f) => f.size > MAX_BYTES).map((f) => f.name);
    const ok = chosen.filter((f) => f.size <= MAX_BYTES);
    setError(tooBig.length ? `${tooBig.join(", ")} ${tooBig.length === 1 ? "is" : "are"} larger than 10 MB.` : "");
    if (ok.length) {
      setBusy(true);
      try {
        await onAdd(ok);
      } catch (err) {
        setError(typeof err === "string" ? err : err?.message || "Upload failed.");
      } finally {
        setBusy(false);
      }
    }
    if (inputRef.current) inputRef.current.value = "";
  };

  const remove = async (doc) => {
    if (!onRemove) return;
    setError("");
    try {
      await onRemove(doc);
    } catch (err) {
      setError(typeof err === "string" ? err : err?.message || "Could not remove the file.");
    }
  };

  return (
    <div className={`uploader ${compact ? "compact" : ""}`.trim()}>
      {!compact && title ? <h3>{title}</h3> : null}
      {!compact && hint ? <p className="sub">{hint}</p> : null}

      {canEdit ? (
        <label
          className={`dropzone ${over ? "over" : ""} ${busy ? "busy" : ""}`.trim()}
          onDragOver={(e) => {
            e.preventDefault();
            setOver(true);
          }}
          onDragLeave={() => setOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setOver(false);
            handleFiles(e.dataTransfer.files);
          }}
        >
          <input ref={inputRef} type="file" multiple accept={accept} disabled={busy} onChange={(e) => handleFiles(e.target.files)} />
          {compact ? null : <CloudUpload className="drop-icon" size={22} strokeWidth={1.5} />}
          <span>{busy ? "Uploading…" : compact ? "Upload photos or files" : "Drop files here or click to upload photos and documents"}</span>
        </label>
      ) : null}

      {error ? (
        <div className="alert danger" style={{ marginTop: 8, marginBottom: 0 }}>
          {error}
        </div>
      ) : null}

      {list.length ? (
        <div className="file-grid">
          {list.map((doc) => {
            const url = documentFileUrl(doc);
            const ext = (doc.name || "FILE").split(".").pop()?.toUpperCase();
            return (
              <div key={doc.id} className="file-card">
                {isImageDocument(doc) && url ? (
                  <a href={url} target="_blank" rel="noreferrer" className="file-thumb">
                    <img src={url} alt={doc.name} loading="lazy" />
                  </a>
                ) : (
                  <a href={url || undefined} target="_blank" rel="noreferrer" className="file-thumb file-doc">
                    {ext}
                  </a>
                )}
                <div className="file-meta">
                  {url ? (
                    <a href={documentFileUrl(doc, { download: true })} title={doc.name}>
                      {doc.name}
                    </a>
                  ) : (
                    <span>{doc.name}</span>
                  )}
                  <small>
                    {doc.size || "—"} · {formatDate(doc.createdAt, { withTime: true, timeZone })}
                    {doc.uploader?.name ? ` · ${doc.uploader.name}` : ""}
                  </small>
                </div>
                {canEdit && onRemove ? (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => remove(doc)}>
                    Remove
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : compact ? null : (
        <p className="lede" style={{ marginTop: 8 }}>
          No files attached yet.
        </p>
      )}
    </div>
  );
}
