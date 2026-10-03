// Raise a request or an assignment from the stage you are working on.
//
// An information request carries the exact fields you want answered — the
// other department's response form is built from them, so they see only what
// you asked for and you get it back in a shape you can read.

import { useState } from "react";
import { ArrowLeft, ArrowRight, ClipboardCheck, ClipboardList, ListChecks, Plus, X } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Field from "@/components/Field";
import Modal from "@/components/Modal";
import TimeSelect from "@/components/TimeSelect";
import Tabs from "@/components/Tabs";
import InspectionChecklist from "./InspectionChecklist";
import {
  ASSIGNMENT_TEMPLATES,
  DEPARTMENTS,
  departmentLabel,
  documentTypeLabel,
  INFORMATION_TEMPLATES,
  peopleInDepartment,
  PRIORITIES,
  REQUEST_KINDS,
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
  // Everyone in the unit. The form narrows the "assign to" list to whichever
  // department is chosen, and widens it again when the department changes.
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
  const start =
    templates.find((t) => t.key === template) ||
    (initial ? templates.find((t) => t.key === "custom") : null) ||
    templates[0];
  const [templateKey, setTemplateKey] = useState(start.key);
  const [form, setForm] = useState(() => ({
    department: initialDepartment || (isAssignment ? "operations" : "sales"),
    assigneeId: "",
    title: initial?.title ?? start.title ?? "",
    description: initial?.description ?? start.description ?? "",
    priority: PRIORITIES[0].key,
    dueAt: "",
    dueTime: "",
    fields: initial?.fields?.length ? initial.fields.map((f) => ({ ...f })) : isAssignment ? [] : [blankField()],
  }));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  // A pre-site inspection carries a second screen: everything a visit could
  // bring back, with the requester ticking what this job needs. What is ticked
  // reaches the coordinator, and becomes a field on the site member's form.
  const [screen, setScreen] = useState("request");
  const [checklist, setChecklist] = useState([]);
  // Anything the checklist does not cover, written by the requester.
  const [custom, setCustom] = useState([]);
  const [documents, setDocuments] = useState(() =>
    Array.isArray(initial?.documents) ? initial.documents.map((d) => ({ ...d })) : [],
  );
  const removeDocument = (i) => setDocuments(documents.filter((_, n) => n !== i));

  const set = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  // The people on the team chosen — or everyone, when the unit has nobody on
  // that team yet, in which case the field says so.
  const { people: candidates, exact: teamHasPeople } = peopleInDepartment(people, form.department);
  const changeDepartment = (department) => {
    const { people: next } = peopleInDepartment(people, department);
    setForm((f) => ({
      ...f,
      department,
      // A person picked from the old team is not on the new one.
      assigneeId: next.some((p) => String(p.id) === String(f.assigneeId)) ? f.assigneeId : "",
    }));
  };
  const isInspection = isAssignment && templateKey === "pre_site_inspection";
  // The note can run to a line per item asked for; three rows would hide
  // most of it, so the box grows with what is in it, up to a point.
  const descriptionRows = Math.min(16, Math.max(3, String(form.description || "").split(/\r?\n/).length + 1));
  const namedCustom = custom.filter((x) => !isBlank(x.label));
  const askedCount = checklist.length + namedCustom.length;
  const setCustomItem = (i, value) => setCustom(custom.map((x, n) => (n === i ? { ...x, label: value } : x)));
  const addCustom = () => setCustom([...custom, { label: "" }]);
  const removeCustom = (i) => setCustom(custom.filter((_, n) => n !== i));


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
    if (!isAssignment && !form.fields.length && !documents.length)
      return setError("Add at least one piece of information you need back.");
    if (!isAssignment && form.fields.some((f) => isBlank(f.label)))
      return setError("Name every item you need — that is what the other team sees.");

    setSaving(true);
    setError("");
    try {
      await onSubmit({
        kind,
        stage,
        requestedDocuments: documents.map((d, i) => ({
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
        requestedFields: isInspection
          ? namedCustom.map((f, i) => ({ key: slug(f.label, i), label: f.label.trim(), kind: "text" }))
          : isAssignment
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
              count: `${askedCount}`,
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

          <div className="section" style={{ marginTop: 18, marginBottom: 0 }}>
            <h3>Anything else to confirm</h3>
            <p className="lede" style={{ marginBottom: 12 }}>
              Not on the list? Write it here — one line each, and the person attending gets a field for it.
            </p>
            {custom.map((item, i) => (
              <div key={i} className="row-grid" style={{ "--row-cols": "1fr auto" }}>
                <Field>
                  <input
                    value={item.label}
                    placeholder="e.g. Confirm the neighbour's eave clearance"
                    onChange={(e) => setCustomItem(i, e.target.value)}
                  />
                </Field>
                <div>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => removeCustom(i)} aria-label="Remove">
                    <X size={14} />
                  </button>
                </div>
              </div>
            ))}
            <button type="button" className="btn btn-ghost btn-sm" onClick={addCustom}>
              <Plus size={14} /> Add an item
            </button>
          </div>
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
          <select value={form.department} onChange={(e) => changeDepartment(e.target.value)}>
            {DEPARTMENTS.map((d) => (
              <option key={d.key} value={d.key}>
                {d.label}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Assign to"
          required
          hint={teamHasPeople ? undefined : `nobody in ${departmentLabel(form.department)} yet — showing everyone`}
        >
          <select value={form.assigneeId} onChange={(e) => set("assigneeId", e.target.value)}>
            <option value="">{candidates.length ? "Choose a person" : "Nobody in this unit yet"}</option>
            {candidates.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.title ? ` · ${p.title}` : ""}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Title" className="span-2" required>
          <input value={form.title} onChange={(e) => set("title", e.target.value)} placeholder="Short summary" />
        </Field>
        {/* An inspection's brief is its checklist, and a request raised with
            its items already filled in says the same thing twice. Only a
            request typed from scratch needs a paragraph of context. */}
        {isInspection ? (
          <div className="span-2">
            <button
              type="button"
              className="btn btn-ghost btn-sm site-visit-details"
              onClick={() => setScreen("inspection")}
            >
              <ListChecks size={14} />
              Inspection checklist — {askedCount} item{askedCount === 1 ? "" : "s"} requested
            </button>
          </div>
        ) : initial ? null : (
          <Field
            label={isAssignment ? "What needs doing" : "Why you need it"}
            className="span-2"
            hint={isAssignment ? "the coordinator sees this" : "context for whoever answers"}
          >
            <textarea
              rows={descriptionRows}
              value={form.description}
              onChange={(e) => set("description", e.target.value)}
            />
          </Field>
        )}

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
        <Field label="Needed by (time)" hint={form.dueAt ? "optional" : "pick a date first"}>
          <TimeSelect value={form.dueTime} disabled={!form.dueAt} onChange={(v) => set("dueTime", v)} />
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
              <Field>
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

        </>
      )}

      {documents.length ? (
        <div className="section" style={{ marginTop: 20, marginBottom: 0 }}>
          <h3>Photos or documents required</h3>
          <p className="lede" style={{ marginBottom: 12 }}>
            Each one becomes its own upload slot on their response.
          </p>
          <div className="list-stack">
            {documents.map((doc, i) => (
              <div className="list-row" key={doc.key}>
                <span className="row-title">{doc.label}</span>
                <span style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Badge tone="neutral">{documentTypeLabel(doc.type)}</Badge>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => removeDocument(i)}
                    aria-label={`Remove ${doc.label}`}
                  >
                    <X size={14} />
                  </button>
                </span>
              </div>
            ))}
          </div>
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
