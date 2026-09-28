// The coordinator's half of a site visit, inside the assignment they are
// working on.
//
// They say who is going — someone in the directory, or a name typed in for a
// contractor's electrician who has no account here — and exactly what has to
// come back: one line per piece of information, one slot per photo. Saving
// mints a link they hand over; the person attending fills it in at
// /site-visit/:token with no sign-in.
//
// The task is pending from the moment the link exists until that form is
// submitted. What comes back — answers and photos — is shown here, which is
// where the coordinator is already working.

import { useState } from "react";
import { Eye, Link2, Paperclip, Plus, Trash2, X } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import CopyLinkButton from "@/components/CopyLinkButton";
import Field from "@/components/Field";
import { DOCUMENT_TYPES, documentTypeLabel, siteVisitStatusMeta, siteVisitTask } from "@/constants/collaboration";
import { inspectionChecklistFrom, inspectionFieldsFor } from "@/constants/inspectionReport";
import { siteVisitLink } from "@/features/collaboration/siteVisitLink";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { isBlank } from "@/utils/validators";

const errText = (err, fallback) => (typeof err === "string" ? err : err?.message || fallback);
const asList = (value) => (Array.isArray(value) ? value : []);

const slug = (label, index) =>
  String(label || `item_${index + 1}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "") || `item_${index + 1}`;

const blankItem = () => ({ label: "", kind: "text" });

/** What the person attending will actually be given for this item. */
const KIND_HINT = {
  textarea: "long answer",
  number: "number",
  date: "date",
  checkbox: "tick box",
  signature: "signature",
};
const blankDoc = () => ({ label: "", type: "image", comment: "" });

export default function SiteVisitTaskForm({ request, people = [], onSave, onDeletePhoto, timeZone }) {
  const task = siteVisitTask(request);
  const status = siteVisitStatusMeta(task);
  const submitted = Boolean(task?.submittedAt || task?.status === "submitted");
  const response = task?.response || null;
  const photos = asList(task?.photos);

  // "" means nobody yet; "__other" means a name typed in rather than picked.
  const [assigneeId, setAssigneeId] = useState(() => {
    if (task?.assigneeId) return String(task.assigneeId);
    if (task?.assigneeName) return "__other";
    return request.assigneeId ? String(request.assigneeId) : "";
  });
  const [assigneeName, setAssigneeName] = useState(task?.assigneeName || "");
  const [assigneeEmail, setAssigneeEmail] = useState(task?.assigneeEmail || "");
  const [assigneePhone, setAssigneePhone] = useState(task?.assigneePhone || "");
  // What the requester ticked on the pre-site inspection checklist. Until the
  // coordinator has saved a form of their own, that list is the starting point
  // — they can add to it or drop anything that does not apply.
  const asked = inspectionFieldsFor(inspectionChecklistFrom(request));
  const [items, setItems] = useState(() => {
    const saved = asList(task?.requestedFields);
    if (saved.length) return saved.map((f) => ({ ...f }));
    if (asked.length) return asked.map((f) => ({ ...f }));
    return [blankItem()];
  });
  const [documents, setDocuments] = useState(() => asList(task?.requestedDocuments).map((d) => ({ ...d })));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(null);

  /** Deleting a photo is not undoable, so it asks once. */
  const remove = async (file) => {
    if (!window.confirm(`Delete ${file.filename}? The site member's upload is removed for good.`)) return;
    setRemoving(file.id);
    setError("");
    try {
      await onDeletePhoto(file.id);
    } catch (err) {
      setError(errText(err, "Could not delete that photo."));
    } finally {
      setRemoving(null);
    }
  };

  const typedName = assigneeId === "__other";
  const link = siteVisitLink(task?.token);

  const setItem = (i, value) => setItems(items.map((x, n) => (n === i ? { ...x, label: value } : x)));
  const addItem = () => setItems([...items, blankItem()]);
  const removeItem = (i) => setItems(items.filter((_, n) => n !== i));

  const setDoc = (i, key, value) => setDocuments(documents.map((d, n) => (n === i ? { ...d, [key]: value } : d)));
  const addDoc = () => setDocuments([...documents, blankDoc()]);
  const removeDoc = (i) => setDocuments(documents.filter((_, n) => n !== i));

  const save = async () => {
    if (!assigneeId) return setError("Say who is attending.");
    if (typedName && isBlank(assigneeName)) return setError("Enter the name of the person attending.");
    const named = items.filter((x) => !isBlank(x.label));
    if (!named.length && !documents.some((d) => !isBlank(d.label)))
      return setError("Ask for at least one piece of information or one photo.");

    setSaving(true);
    setError("");
    try {
      await onSave({
        assigneeId: typedName ? null : Number(assigneeId),
        assigneeName: typedName ? assigneeName.trim() : "",
        assigneeEmail: typedName ? assigneeEmail.trim() : "",
        assigneePhone: typedName ? assigneePhone.trim() : "",
        // `kind` rides along so the site member gets the right control — a
        // signature pad rather than a text box, and so on.
        requestedFields: named.map((x, i) => ({
          key: x.key || slug(x.label, i),
          label: x.label.trim(),
          kind: x.kind || "text",
        })),
        requestedDocuments: documents
          .filter((d) => !isBlank(d.label))
          .map((d, i) => ({
            key: d.key || slug(d.label, i),
            label: d.label.trim(),
            type: d.type || "image",
            comment: (d.comment || "").trim(),
          })),
      });
    } catch (err) {
      setError(errText(err, "Could not save the site-visit form."));
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  return (
    <div className="section" style={{ marginBottom: 0 }}>
      <div className="estimation-item-head">
        <h3>Site visit form</h3>
        {task ? <Badge tone={status.tone}>{status.label}</Badge> : null}
      </div>
      <p className="lede" style={{ marginBottom: 12 }}>
        {submitted
          ? "The person attending has sent their report. What came back is below."
          : "Say who is going and what has to come back, then hand them the link. They need no sign-in, and see nothing else about the job."}
      </p>

      <div className="form-grid">
        <Field label="Who is attending" className="span-2">
          <select value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)}>
            <option value="">Choose a person</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
                {person.title ? ` · ${person.title}` : ""}
              </option>
            ))}
            <option value="__other">Someone else — type their name</option>
          </select>
        </Field>
        {typedName ? (
          <>
            <Field label="Name" className="span-2" hint="electrician, site member or contractor">
              <input value={assigneeName} onChange={(e) => setAssigneeName(e.target.value)} />
            </Field>
            <Field label="Email" hint="optional — where to send the link">
              <input type="email" value={assigneeEmail} onChange={(e) => setAssigneeEmail(e.target.value)} />
            </Field>
            <Field label="Phone" hint="optional">
              <input type="tel" value={assigneePhone} onChange={(e) => setAssigneePhone(e.target.value)} />
            </Field>
          </>
        ) : null}
      </div>

      <div className="section" style={{ marginTop: 16, marginBottom: 0 }}>
        <h3>Information to bring back</h3>
        <p className="lede" style={{ marginBottom: 12 }}>
          {asked.length && !task
            ? `Started from the ${asked.length} item${asked.length === 1 ? "" : "s"} the requester marked required on the pre-site inspection checklist. Add or remove whatever you need — the person attending gets an input for each.`
            : "One line per thing you need. They get an input for each."}
        </p>
        {items.map((item, i) => (
          <div key={i} className="row-grid" style={{ "--row-cols": "1fr auto" }}>
            <Field label={`Item ${i + 1}`} hint={KIND_HINT[item.kind]}>
              <input
                value={item.label}
                placeholder="e.g. Switchboard make and model"
                onChange={(e) => setItem(i, e.target.value)}
              />
            </Field>
            <div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeItem(i)} aria-label="Remove item">
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-ghost btn-sm" onClick={addItem}>
          <Plus size={14} /> Add another item
        </button>
      </div>

      <div className="section" style={{ marginTop: 16, marginBottom: 0 }}>
        <h3>Photos to take</h3>
        <p className="lede" style={{ marginBottom: 12 }}>
          Name each shot — &ldquo;switchboard with the cover off&rdquo; — and it becomes its own upload slot on their form,
          with your comment as the instruction.
        </p>
        {documents.map((doc, i) => (
          <div key={i} className="row-grid" style={{ "--row-cols": "1fr 150px 1fr auto" }}>
            <Field label="What to photograph">
              <input
                value={doc.label}
                placeholder="e.g. Switchboard with the cover off"
                onChange={(e) => setDoc(i, "label", e.target.value)}
              />
            </Field>
            <Field label="Type">
              <select value={doc.type} onChange={(e) => setDoc(i, "type", e.target.value)}>
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Comment" hint="what it has to show">
              <input value={doc.comment} onChange={(e) => setDoc(i, "comment", e.target.value)} />
            </Field>
            <div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeDoc(i)} aria-label="Remove">
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-ghost btn-sm" onClick={addDoc}>
          <Plus size={14} /> Add a photo
        </button>
      </div>

      {error ? (
        <Alert tone="danger" style={{ marginTop: 14, marginBottom: 0 }}>
          {error}
        </Alert>
      ) : null}

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", marginTop: 16 }}>
        <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
          <Link2 size={14} /> {saving ? "Saving…" : task ? "Update the form" : "Create the form link"}
        </button>
        {link ? (
          <CopyLinkButton
            value={link}
            label="Copy the site-visit link"
            copiedLabel="Link copied"
            toast="Site-visit link copied — send it to whoever is attending"
          />
        ) : null}
      </div>

      {link ? (
        <p className="row-meta" style={{ marginTop: 8, overflowWrap: "anywhere" }}>
          {link}
        </p>
      ) : null}

      {submitted ? (
        <div className="section" style={{ marginTop: 18, marginBottom: 0 }}>
          <h3>What came back</h3>
          <div className="list-stack">
            <div className="list-row">
              <span className="row-title">Submitted by</span>
              <span className="row-meta">
                {[response?.name, response?.email, response?.phone].filter(Boolean).join(" · ") || "—"}
              </span>
            </div>
            {task?.submittedAt ? (
              <div className="list-row">
                <span className="row-title">Submitted</span>
                <span className="row-meta">{formatDate(task.submittedAt, { withTime: true, timeZone })}</span>
              </div>
            ) : null}
            {asList(task?.requestedFields).map((field) => (
              <div key={field.key} className="list-row">
                <span className="row-title">{field.label}</span>
                <span className="row-meta">{response?.fields?.[field.key] || "Not answered"}</span>
              </div>
            ))}
          </div>

        </div>
      ) : task ? (
        <Alert tone="info" style={{ marginTop: 14, marginBottom: 0 }}>
          This visit stays pending until {task.assigneeName || "the person attending"} submits the form.
        </Alert>
      ) : null}

      {/* Photos land here as the site member uploads them, before they submit
          as well as after — a coordinator watching a visit go out wants to see
          them arrive, not wait for the form to be sent. */}
      {task ? (
        <div className="section" style={{ marginTop: 18, marginBottom: 0 }}>
          <div className="estimation-item-head">
            <h3>Photos &amp; documents from site</h3>
            {photos.length ? <Badge tone="success">{photos.length}</Badge> : null}
          </div>
          {photos.length ? (
            <div className="site-photo-grid">
              {photos.map((file) => {
                const slot = asList(task?.requestedDocuments).find((d) => d.key === file.documentKey);
                const isImage = /\.(png|jpe?g|gif|webp|heic|avif)$/i.test(file.filename || "") || slot?.type === "image";
                return (
                  <figure key={file.id} className="site-photo">
                    <a
                      href={file.url}
                      target="_blank"
                      rel="noreferrer"
                      title={`Open ${file.filename}${slot ? ` — asked for as ${documentTypeLabel(slot.type)}` : ""}`}
                    >
                      {isImage && file.url ? (
                        <img src={file.url} alt={slot?.label || file.filename} loading="lazy" />
                      ) : (
                        <span className="site-photo-file">
                          <Paperclip size={18} />
                        </span>
                      )}
                    </a>
                    <figcaption>
                      <span className="row-title" title={file.filename}>
                        {slot ? slot.label : "Extra"}
                      </span>
                      <span className="row-meta">{file.filename}</span>
                      <span className="site-photo-actions">
                        <a className="btn btn-ghost btn-sm" href={file.url} target="_blank" rel="noreferrer">
                          <Eye size={13} /> View
                        </a>
                        {onDeletePhoto ? (
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={removing === file.id}
                            onClick={() => remove(file)}
                          >
                            <Trash2 size={13} /> {removing === file.id ? "Removing…" : "Delete"}
                          </button>
                        ) : null}
                      </span>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          ) : (
            <p className="dropzone-empty" style={{ margin: 0 }}>
              {submitted ? "No photos were uploaded." : "Nothing uploaded yet — photos appear here as they are taken."}
            </p>
          )}
        </div>
      ) : null}
    </div>
  );
}
