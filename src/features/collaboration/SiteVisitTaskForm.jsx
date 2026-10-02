// The coordinator's response to a pre-site inspection, over two screens.
//
//   Visit    — who is going, when, and the link to hand them. The few things
//              a coordinator does every time, with nothing else in the way.
//   Details  — what the visit has to bring back: the items the requester
//              ticked, shown as theirs, plus anything the coordinator wants
//              on top, plus the photos to take.
//
// Keeping the detail on its own screen is the point: assigning a crew member
// and sending a link is a ten-second job, and it should not mean scrolling
// past twenty checklist rows to reach the button.
//
// Saving mints the link; the person attending fills it in at
// /site-visit/:token with no sign-in. The task stays pending until that form
// comes back, and what comes back is shown here, where the coordinator works.

import { useState } from "react";
import { ArrowLeft, ExternalLink, Eye, Link2, ListChecks, Paperclip, Plus, Trash2, X } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import CopyLinkButton from "@/components/CopyLinkButton";
import Field from "@/components/Field";
import { documentTypeLabel, siteVisitStatusMeta, siteVisitTask } from "@/constants/collaboration";
import { SITE_PHOTOS_KEY, requesterItems } from "@/constants/inspectionReport";
import InspectionReportView from "@/features/collaboration/InspectionReportView";
import { siteVisitLink } from "@/features/collaboration/siteVisitLink";
import { formatDate, toDateInput } from "@/helpers/dateTimeHelpers";
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

/** The clock time out of a stored date, for the time input. */
const timeOf = (value) => {
  if (typeof value !== "string") return "";
  const time = value.split("T")[1];
  return time ? time.slice(0, 5) : "";
};

export default function SiteVisitTaskForm({ request, people = [], onSave, onDeletePhoto, timeZone }) {
  const task = siteVisitTask(request);
  const status = siteVisitStatusMeta(task);
  const submitted = Boolean(task?.submittedAt || task?.status === "submitted");
  const response = task?.response || null;
  const photos = asList(task?.photos);

  // What the requester ticked on the pre-site inspection checklist. It is
  // theirs — the coordinator can see it and add to it, but not quietly drop it.
  const asked = requesterItems(request);
  const askedKeys = new Set(asked.map((f) => f.key));

  const [screen, setScreen] = useState("visit");
  // "" means nobody yet; "__other" means a name typed in rather than picked.
  const [assigneeId, setAssigneeId] = useState(() => {
    if (task?.assigneeId) return String(task.assigneeId);
    if (task?.assigneeName) return "__other";
    return "";
  });
  const [assigneeName, setAssigneeName] = useState(task?.assigneeName || "");
  const [assigneeEmail, setAssigneeEmail] = useState(task?.assigneeEmail || "");
  const [assigneePhone, setAssigneePhone] = useState(task?.assigneePhone || "");
  const [scheduledDate, setScheduledDate] = useState(toDateInput(request.scheduledFor));
  const [scheduledTime, setScheduledTime] = useState(timeOf(request.scheduledFor));
  // Only the coordinator's own additions live in state; the requester's items
  // are read back from the request every render.
  const [extras, setExtras] = useState(() =>
    asList(task?.requestedFields)
      .filter((f) => !askedKeys.has(f.key))
      .map((f) => ({ ...f })),
  );
  // Photo slots a request asked for. The inspection form captures site photos
  // on its own, so these are carried through rather than edited here.
  const documents = asList(task?.requestedDocuments);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(null);

  const answers = task?.response?.fields || {};
  /** What came back for one item, or "" while the form is still out. */
  const answerFor = (field) => {
    const value = answers[field.key];
    if (value === undefined || value === null || value === "") return "";
    if (field.kind === "signature") return "Signed";
    if (field.kind === "checkbox") return value ? "Yes" : "No";
    return String(value);
  };

  const typedName = assigneeId === "__other";
  const link = siteVisitLink(task?.token);
  const namedExtras = extras.filter((x) => !isBlank(x.label));
  const namedDocs = documents.filter((d) => !isBlank(d.label));
  const requestedCount = asked.length + namedExtras.length + namedDocs.length;

  const setExtra = (i, value) => setExtras(extras.map((x, n) => (n === i ? { ...x, label: value } : x)));
  const addExtra = () => setExtras([...extras, blankItem()]);
  const removeExtra = (i) => setExtras(extras.filter((_, n) => n !== i));

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

  const save = async () => {
    if (!assigneeId) return setError("Say who is attending.");
    if (typedName && isBlank(assigneeName)) return setError("Enter the name of the person attending.");
    if (!requestedCount) return setError("Ask for at least one piece of information or one photo — see Details.");

    setSaving(true);
    setError("");
    try {
      await onSave({
        // The site member attending. The request itself stays with the
        // coordinator; this is who they are handing it to.
        assigneeId: typedName ? null : Number(assigneeId),
        assigneeName: typedName ? assigneeName.trim() : "",
        assigneeEmail: typedName ? assigneeEmail.trim() : "",
        assigneePhone: typedName ? assigneePhone.trim() : "",
        scheduledFor: scheduledDate ? (scheduledTime ? `${scheduledDate}T${scheduledTime}` : scheduledDate) : null,
        // `kind` rides along so the site member gets the right control — a
        // signature pad rather than a text box, and so on.
        requestedFields: [...asked, ...namedExtras].map((x, i) => ({
          key: x.key || slug(x.label, i),
          label: x.label.trim(),
          kind: x.kind || "text",
        })),
        requestedDocuments: namedDocs.map((d, i) => ({
          key: d.key || slug(d.label, i),
          label: d.label.trim(),
          type: d.type || "image",
          comment: (d.comment || "").trim(),
        })),
      });
      setScreen("visit");
    } catch (err) {
      setError(errText(err, "Could not save the site-visit form."));
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  // ---- Screen 2: what the visit has to bring back --------------------------
  if (screen === "details") {
    return (
      <div className="section" style={{ marginBottom: 0 }}>
        <div className="estimation-item-head">
          <h3>Details Required</h3>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setScreen("visit")}>
            <ArrowLeft size={14} /> Back
          </button>
        </div>

        {asked.length ? (
          <>
            <p className="lede" style={{ marginBottom: 10 }}>
              This fills in on its own once whoever is attending sends the form back.
            </p>
            <div className="list-stack">
              {asked.map((field) => {
                const answer = answerFor(field);
                return (
                  <div className="list-row" key={field.key}>
                    <span className="row-title">{field.label}</span>
                    <span className={answer ? "row-title answer-filled" : "row-meta"}>
                      {answer || `Waiting — ${KIND_HINT[field.kind] || "short answer"}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <p className="lede">The requester did not tick anything — ask for whatever this visit needs below.</p>
        )}

        <div className="section" style={{ marginTop: 18, marginBottom: 0 }}>
          <h3>Anything else you need</h3>
          <p className="lede" style={{ marginBottom: 12 }}>
            One line per extra thing. They get an input for each, alongside the items above.
          </p>
          {extras.map((item, i) => (
            <div key={i} className="row-grid" style={{ "--row-cols": "1fr auto" }}>
              <Field
                label={`Extra ${i + 1}`}
                hint={answerFor(item) ? `answered: ${answerFor(item)}` : KIND_HINT[item.kind]}
              >
                <input
                  value={item.label}
                  placeholder="e.g. Gate code for the rear lane"
                  onChange={(e) => setExtra(i, e.target.value)}
                />
              </Field>
              <div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeExtra(i)} aria-label="Remove">
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={addExtra}>
            <Plus size={14} /> Add an item
          </button>
        </div>

        {error ? (
          <Alert tone="danger" style={{ marginTop: 14, marginBottom: 0 }}>
            {error}
          </Alert>
        ) : null}

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 16 }}>
          <button type="button" className="btn btn-primary btn-sm" onClick={save} disabled={saving}>
            <Link2 size={14} /> {saving ? "Saving…" : task ? "Update the form" : "Create the form link"}
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setScreen("visit")}>
            Back to the visit
          </button>
        </div>
      </div>
    );
  }

  // ---- Screen 1: the visit itself -----------------------------------------
  return (
    <div className="section" style={{ marginBottom: 0 }}>
      <div className="estimation-item-head">
        <h3>Site visit</h3>
        {task ? <Badge tone={status.tone}>{status.label}</Badge> : null}
      </div>

      {/* The brief, on its own screen. This is the one line about it. */}
      <button
        type="button"
        className="btn btn-ghost btn-sm site-visit-details"
        style={{ marginTop: 0, marginBottom: 14 }}
        onClick={() => setScreen("details")}
      >
        <ListChecks size={14} />
        Details Required — {requestedCount} item{requestedCount === 1 ? "" : "s"}
        {asked.length ? ` (${asked.length} from the requester)` : ""}
      </button>

      <div className="form-grid">
        <Field label="Assign to" className="span-2" required hint="the site member attending">
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
            <Field label="Name" className="span-2" required hint="electrician, site member or contractor">
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
        <Field label="Scheduled date">
          <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} />
        </Field>
        <Field label="Scheduled time" hint={scheduledDate ? "optional" : "pick a date first"}>
          <input
            type="time"
            value={scheduledTime}
            disabled={!scheduledDate}
            onChange={(e) => setScheduledTime(e.target.value)}
          />
        </Field>
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
          <>
            <CopyLinkButton
              value={link}
              label="Copy the link"
              copiedLabel="Link copied"
              toast="Site-visit link copied — send it to whoever is attending"
            />
            {/* An anchor, not a button that routes: the form is a public page
                outside the app, and the coordinator opening it to check must
                not lose the request they are working in. */}
            <a className="btn btn-ghost btn-sm" href={link} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={14} /> Open the form
            </a>
          </>
        ) : null}
      </div>

      {link ? (
        <p className="row-meta site-visit-url" style={{ marginTop: 8 }}>
          <a href={link} target="_blank" rel="noopener noreferrer">
            {link}
          </a>
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
          </div>
          <InspectionReportView
            response={response}
            requestedFields={asList(task?.requestedFields)}
            submittedAt={task?.submittedAt}
            timeZone={timeZone}
          />
        </div>
      ) : task ? (
        <Alert tone="info" style={{ marginTop: 14, marginBottom: 0 }}>
          Pending until {task.assigneeName || "the person attending"} submits the form.
        </Alert>
      ) : null}

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
                        {slot ? slot.label : file.documentKey === SITE_PHOTOS_KEY ? "Site photos" : "Extra"}
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
