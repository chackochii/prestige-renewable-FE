// Raise a request or an assignment from the stage you are working on.
//
// An information request carries the exact fields you want answered — the
// other department's response form is built from them, so they see only what
// you asked for and you get it back in a shape you can read.

import { useState } from "react";
import { ArrowLeft, ArrowRight, ClipboardCheck, ClipboardList, Plus, X } from "lucide-react";
import Alert from "@/components/Alert";
import Field from "@/components/Field";
import Modal from "@/components/Modal";
import Tabs from "@/components/Tabs";
import InspectionChecklist from "./InspectionChecklist";
import { SELECTABLE_FIELDS } from "@/constants/inspectionReport";
import {
  ASSIGNMENT_TEMPLATES,
  DEPARTMENTS,
  DOCUMENT_TYPES,
  INFORMATION_TEMPLATES,
  REQUEST_KINDS,
  prioritiesFor,
} from "@/constants/collaboration";
import { stageById } from "@/constants/stages";
import { isBlank } from "@/utils/validators";

const errText = (err, fallback) => (typeof err === "string" ? err : err?.message || fallback);

/** An information request starts with one empty line to name what is needed. */
const blankField = () => ({ key: "", label: "", type: "text" });

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
  // Which template the modal opens on, by key. Raising a pre-site inspection
  // from a stage panel opens on that one, so its title and description are
  // filled in and the inspection checklist is there from the start.
  template,
  // Prefilled by whoever raised it — the lead-input rows an estimator ticked,
  // for instance. It opens on the custom template so nothing overwrites it,
  // and every field stays editable.
  initial = null,
  onClose,
  onSubmit,
}) {
  const isAssignment = kind === "assignment";
  const templates = isAssignment ? ASSIGNMENT_TEMPLATES : INFORMATION_TEMPLATES;
  const priorities = prioritiesFor(kind);
  const start = initial
    ? templates.find((t) => t.key === "custom") || templates[0]
    : templates.find((t) => t.key === template) || templates[0];
  const [templateKey, setTemplateKey] = useState(start.key);
  const [form, setForm] = useState(() => ({
    department: initialDepartment || (isAssignment ? "operations" : "sales"),
    assigneeId: "",
    title: initial?.title ?? start.title ?? "",
    description: initial?.description ?? start.description ?? "",
    priority: priorities[0].key,
    dueAt: "",
    dueTime: "",
    fields: initial?.fields?.length ? initial.fields.map((f) => ({ ...f })) : isAssignment ? [] : [blankField()],
    documents: [],
  }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // A pre-site inspection carries a second screen: everything a visit could
  // bring back, with the requester ticking what this job needs. What is ticked
  // reaches the coordinator, and becomes a field on the site member's form.
  const [screen, setScreen] = useState("request");
  const [checklist, setChecklist] = useState([]);

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const isInspection = isAssignment && templateKey === "pre_site_inspection";


  const applyTemplate = (key) => {
    const template = templates.find((t) => t.key === key) || templates[0];
    setTemplateKey(key);
    if (key !== "pre_site_inspection") setScreen("request");
    // Only the subject changes — whatever the requester has typed as the
            // items they need stays put.
    setForm((f) => ({
      ...f,
      title: template.title || "",
      description: template.description || f.description,
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
  const addField = () => set("fields", [...form.fields, blankField()]);
  const removeField = (index) => set("fields", form.fields.filter((_, i) => i !== index));

  const submit = async () => {
    if (isBlank(form.title)) return setError("Give the request a title.");
    if (!form.assigneeId) return setError("Choose who this goes to.");
    if (!isAssignment && !form.fields.length)
      return setError("Add at least one piece of information you need back.");
    if (!isAssignment && form.fields.some((f) => isBlank(f.label)))
      return setError("Name every item you need — that is what the other team sees.");

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
        // Date alone stays a date; with a time it becomes a local datetime.
        dueAt: form.dueAt ? (form.dueTime ? `${form.dueAt}T${form.dueTime}` : form.dueAt) : null,
        // What the visit has to confirm. The coordinator hands these to
        // whoever attends, one field each.
        inspectionChecklist: isInspection ? checklist : null,
        requestedFields: isAssignment
          ? null
          : form.fields.map((f, i) => ({
              key: f.key?.trim() || slug(f.label, i),
              label: f.label.trim(),
              type: "text",
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
          {isInspection && screen === "inspection" ? (
            <button type="button" className="btn btn-ghost" onClick={() => setScreen("request")} disabled={saving}>
              <ArrowLeft size={14} /> Back
            </button>
          ) : null}
          {isInspection && screen === "request" ? (
            <button type="button" className="btn btn-ghost" onClick={() => setScreen("inspection")} disabled={saving}>
              Inspection checklist <ArrowRight size={14} />
            </button>
          ) : null}
          <button type="button" className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Sending…" : isAssignment ? "Send assignment" : "Send request"}
          </button>
        </>
      }
    >
      {isInspection ? (
        <Tabs
          value={screen}
          onChange={setScreen}
          items={[
            { key: "request", label: "Request details", icon: <ClipboardList size={14} /> },
            {
              key: "inspection",
              label: "Inspection checklist",
              icon: <ClipboardCheck size={14} />,
              count: `${checklist.length}/${SELECTABLE_FIELDS.length}`,
            },
          ]}
        />
      ) : null}

      {isInspection && screen === "inspection" ? (
        <div className="section" style={{ marginBottom: 0 }}>
          <p className="lede" style={{ marginBottom: 0 }}>
            Tick what this visit has to bring back. Each one becomes a field the person attending fills in, so ask for
            what you need and leave the rest — everything here is optional.
          </p>
          <InspectionChecklist selected={checklist} onChange={setChecklist} disabled={saving} />
        </div>
      ) : (
        <>
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
            {priorities.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Needed by">
          <input type="date" value={form.dueAt} onChange={(e) => set("dueAt", e.target.value)} />
        </Field>
        <Field label="Needed by (time)" hint={form.dueAt ? "optional" : "pick a date first"}>
          <input
            type="time"
            value={form.dueTime}
            disabled={!form.dueAt}
            onChange={(e) => set("dueTime", e.target.value)}
          />
        </Field>
      </div>

      {!isAssignment ? (
        <div className="section" style={{ marginTop: 20, marginBottom: 0 }}>
          <h3>Information you need back</h3>
          <p className="lede" style={{ marginBottom: 12 }}>
            One line per thing you need. They get an input for each, and answer those and nothing else.
          </p>
          {form.fields.map((field, i) => (
            <div key={i} className="row-grid" style={{ "--row-cols": "1fr auto" }}>
              <Field label={`Item ${i + 1}`}>
                <input
                  value={field.label}
                  placeholder="e.g. Annual usage (kWh)"
                  onChange={(e) => setField(i, "label", e.target.value)}
                />
              </Field>
              <div>
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeField(i)} aria-label="Remove item">
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
          <button type="button" className="btn btn-ghost btn-sm" onClick={addField}>
            <Plus size={14} /> Add another item
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

        </>
      )}

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
