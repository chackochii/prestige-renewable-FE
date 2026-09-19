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
  onClose,
  onSubmit,
}) {
  const isAssignment = kind === "assignment";
  const templates = isAssignment ? ASSIGNMENT_TEMPLATES : INFORMATION_TEMPLATES;
  const [templateKey, setTemplateKey] = useState(templates[0].key);
  const [form, setForm] = useState(() => ({
    department: initialDepartment || (isAssignment ? "operations" : "sales"),
    assigneeId: "",
    title: templates[0].title || "",
    description: templates[0].description || "",
    priority: "medium",
    dueAt: "",
    scheduledFor: "",
    fields: (templates[0].fields || []).map((f) => ({ ...f })),
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
        department: form.department,
        assigneeId: Number(form.assigneeId),
        title: form.title.trim(),
        description: form.description.trim(),
        priority: form.priority,
        dueAt: form.dueAt || null,
        scheduledFor: isAssignment ? form.scheduledFor || null : null,
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
        {isAssignment ? (
          <Field label="Suggested date" className="span-2" hint="the coordinator can reschedule">
            <input type="date" value={form.scheduledFor} onChange={(e) => set("scheduledFor", e.target.value)} />
          </Field>
        ) : null}
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
