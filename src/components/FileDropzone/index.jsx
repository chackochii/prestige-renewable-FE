// Drag-and-drop / click-to-browse file picker, with a flat list of what's attached.

import { useRef, useState } from "react";
import { CloudUpload, Paperclip } from "lucide-react";

export default function FileDropzone({ files = [], onSelect, disabled = false, uploading = false }) {
  const inputRef = useRef(null);
  const [dragging, setDragging] = useState(false);

  const openPicker = () => {
    if (!disabled) inputRef.current?.click();
  };

  const handleFiles = (fileList) => {
    const list = Array.from(fileList || []);
    if (list.length) onSelect?.(list);
  };

  return (
    <div>
      <div
        className={`dropzone ${dragging ? "dragging" : ""}`.trim()}
        role="button"
        tabIndex={0}
        onClick={openPicker}
        onKeyDown={(e) => {
          if (e.key === "Enter") openPicker();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled) handleFiles(e.dataTransfer.files);
        }}
      >
        <CloudUpload size={20} />
        <div>{uploading ? "Uploading…" : "Drop files here or click to upload photos and documents"}</div>
        <input
          ref={inputRef}
          type="file"
          multiple
          disabled={disabled}
          onChange={(e) => {
            handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {files.length ? (
        <div className="dropzone-list list-stack">
          {files.map((f) =>
            f.url ? (
              <a key={f.id} href={f.url} target="_blank" rel="noreferrer" className="list-row">
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <Paperclip size={14} />
                  <span className="row-title">{f.filename}</span>
                </div>
              </a>
            ) : (
              <div key={f.id} className="list-row">
                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <Paperclip size={14} />
                  <span className="row-title">{f.filename}</span>
                </div>
                <span className="row-meta">Ready to upload</span>
              </div>
            ),
          )}
        </div>
      ) : (
        <p className="dropzone-empty">No files attached yet.</p>
      )}
    </div>
  );
}
