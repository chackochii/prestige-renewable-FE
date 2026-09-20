// Raise a request or an assignment from the stage you are working on.
//
// An information request carries the exact fields you want answered — the
// other department's response form is built from them, so they see only what
// you asked for and you get it back in a shape you can read.

import { useState } from "react";
import { Plus, X } from "lucide-react";
import Alert from "@/components/Alert";
import Field from "@/components/Field";
import Modal from "@/components/Modal";
import {
  ASSIGNMENT_TEMPLATES,
  DEPARTMENTS,
  DOCUMENT_TYPES,
  FIELD_TYPES,
  INFORMATION_TEMPLATES,
  PRIORITIES,
  REQUEST_KINDS,
} from "@/constants/collaboration";
import { stageById } from "@/constants/stages";
import { isBlank } from "@/utils/validators";

const errText = (err, fallback) => (typeof err === "string" ? err : err?.message || fallback);

const slug = (label, index) =>
  String(label || `field_${index + 1}`)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "") || `field_${index + 1}`;

export default function RequestFormModal({
  opportunity,
  stage,
  kind = "information",
  department: initialDepartment,
  people = [],
  // Prefilled by whoever raised it — the lead-input rows an estimator ticked,
  // for instance. It opens on the custom template so nothing overwrites it,
  // and every field stays editable.
  initial = null,
  onClose,
  onSubmit,
}) {
  const isAssignment = kind === "assignment";
  const templates = isAssignment ? ASSIGNMENT_TEMPLATES : INFORMATION_TEMPLATES;
  const start = initial ? templates.find((t) => t.key === "custom") || templates[0] : templates[0];
  const [templateKey, setTemplateKey] = useState(start.key);
  const [form, setForm] = useState(() => ({
    department: initialDepartment || (isAssignment ? "operations" : "sales"),
    assigneeId: "",
    title: initial?.title ?? start.title ?? "",
    description: initial?.description ?? start.description ?? "",
    priority: "medium",
    dueAt: "",
    fields: (initial?.fields ?? start.fields ?? []).map((f) => ({ ...f })),
    documents: [],
  }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const applyTemplate = (key) => {
    const template = templates.find((t) => t.key === key) || templates[0];
    setTemplateKey(key);
    setForm((f) => ({
      ...f,
      title: template.title || "",
      description: template.description || f.description,
      fields: (template.fields || []).map((x) => ({ ...x })),
    }));
  };

  const setDocument = (index, key, value) =>
    set(
      "documents",
      form.documents.map((d, i) => (i === index ? { ...d, [key]: value } : d)),
    );
  const addDocument = () => set("documents", [...form.documents, { label: "", type: "image", comment: "" }]);
  const removeDocument = (index) => set("documents", form.documents.filter((_, i) => i !== index));

  const setField = (index, key, value) =>
    set(
      "fields",
      form.fields.map((f, i) => (i === index ? { ...f, [key]: value } : f)),
    );
  const addField = () => set("fields", [...form.fields, { key: "", label: "", type: "text" }]);
  const removeField = (index) => set("fields", form.fields.filter((_, i) => i !== index));

  const submit = async () => {
    if (isBlank(form.title)) return setError("Give the request a title.");
    if (!form.assigneeId) return setError("Choose who this goes to.");
    if (!isAssignment && !form.fields.length)
      return setError("Add at least one piece of information you need back.");
    if (!isAssignment && form.fields.some((f) => isBlank(f.label)))
      return setError("Every field needs a label — that is what the other team sees.");

    setSaving(true);
    setError("");
    try {
      await onSubmit({
        kind,
        stage,
        requestedDocuments: form.documents
          .filter((d) => !isBlank(d.label))
          .map((d, i) => ({
            key: d.key || slug(d.label, i),
            label: d.label.trim(),
            type: d.type || "image",
            comment: (d.comment || "").trim(),
          })),
        department: form.department,
        assigneeId: Number(form.assigneeId),
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        dueAt: form.dueAt || null,
        requestedFields: isAssignment
          ? null
          : form.fields.map((f, i) => ({
              key: f.key?.trim() || slug(f.label, i),
              label: f.label.trim(),
              type: f.type || "text",
            })),
      });
      onClose();
    } catch (err) {
      setError(errText(err, "Could not raise the request."));
    } finally {
      setSaving(false);
    }
    return undefined;
  };

  return (
    <Modal
      title={isAssignment ? "Assign to another team" : "Request information"}
      body={`${opportunity?.number ? `${opportunity.number} · ` : ""}${stageById(stage).label}`}
      className="wide"
      onClose={onClose}
      actions={
        <>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={saving}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Sending…" : isAssignment ? "Send assignment" : "Send request"}
          </button>
        </>
      }
    >
      <div className="form-grid">
        <Field label="What do you need?" className="span-2">
          <select value={templateKey} onChange={(e) => applyTemplate(e.target.value)}>
            {templates.map((t) => (
              <option key={t.key} value={t.key}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Department">
          <select value={form.department} onChange={(e) => set("department", e.target.value)}>
            {DEPARTMENTS.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Assign to" hint="they see it in their assigned list">
          <select value={form.assigneeId} onChange={(e) => set("assigneeId", e.target.value)}>
            <option value="">Choose a person</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.title ? ` · ${p.title}` : ""}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Title" className="span-2">
          <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Short summary" />
        </Field>
        <Field
          label={isAssignment ? "What needs doing" : "Why you need it"}
          className="span-2"
          hint={isAssignment ? "the coordinator sees this" : "context for whoever answers"}
        >
          <textarea rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} />
        </Field>

        <Field label="Priority">
          <select value={form.priority} onChange={(e) => set("priority", e.target.value)}>
            {PRIORITIES.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Needed by">
          <input type="date" value={form.dueAt} onChange={(e) => set("dueAt", e.target.value)} />
        </Field>
      </div>

      {!isAssignment ? (
        <div className="section" style={{ marginTop: 20, marginBottom: 0 }}>
          <h3>Information you need back</h3>
          <p className="lede" style={{ marginBottom: 12 }}>
            The response form is built from this list — they answer these and nothing else.
          </p>
          {form.fields.map((field, i) => (
            <div key={i} className="row-grid" style={{ "--row-cols": "1fr 160px auto" }}>
              <Field label="Label">
                <input
                  value={field.label}
                  placeholder="e.g. Annual usage (kWh)"
                  onChange={(e) => setField(i, "label", e.target.value)}
                />
              </Field>
              <Field label="Answer type">
                <select value={field.type} onChange={(e) => setField(i, "type", e.target.value)}>
                  {FIELD_TYPES.map((t) => (
                    <option key={t.key} value={t.key}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </Field>
              <div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeField(i)} aria-label="Remove field">
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={addField}>
            <Plus size={14} /> Add a field
          </button>
        </div>
      ) : null}

      <div className="section" style={{ marginTop: 20, marginBottom: 0 }}>
        <h3>Photos &amp; documents needed</h3>
        <p className="lede" style={{ marginBottom: 12 }}>
          Name each one — &ldquo;sketch of the switchboard run&rdquo; — and it becomes its own upload slot on their
          response, with your comment as the instruction.
        </p>
        {form.documents.map((doc, i) => (
          <div key={i} className="row-grid" style={{ "--row-cols": "1fr 150px 1fr auto" }}>
            <Field label="What is needed">
              <input
                value={doc.label}
                placeholder="e.g. Sketch of the switchboard run"
                onChange={(e) => setDocument(i, "label", e.target.value)}
              />
            </Field>
            <Field label="Type">
              <select value={doc.type} onChange={(e) => setDocument(i, "type", e.target.value)}>
                {DOCUMENT_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Comment" hint="what it has to show">
              <input
                value={doc.comment}
                placeholder="e.g. include the meter number"
                onChange={(e) => setDocument(i, "comment", e.target.value)}
              />
            </Field>
            <div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeDocument(i)} aria-label="Remove">
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
        <button type="button" className="btn btn-ghost btn-sm" onClick={addDocument}>
          <Plus size={14} /> Add a photo or document
        </button>
      </div>

      {error ? (
        <Alert tone="danger" style={{ marginTop: 16, marginBottom: 0 }}>
          {error}
        </Alert>
      ) : null}

      <p className="lede" style={{ marginTop: 16, marginBottom: 0 }}>
        {REQUEST_KINDS[kind].label} · they are notified as soon as you send it.
      </p>
    </Modal>
  );
}
