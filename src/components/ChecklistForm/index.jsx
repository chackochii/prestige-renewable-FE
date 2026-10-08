// One stage checklist on a job — an approvals table (CL-07/08/09) or a
// procurement one (CL-10 to CL-14) — item by item as the checklist numbers
// them, each with the control its "Field Type" calls for. The definition is
// data (constants/*Checklists.js) and the rules are helpers/checklist.js;
// this file only draws them. The stage's wrapper supplies what comes from
// its records: the rows an auto item shows, the conditions, and whether the
// checklist is open yet.
//
// section    — the checklist definition
// answers    — this section's answers; onChange(patch) merges into them
// ctx        — the rules' context (conditions, autoAnswered)
// canEdit    — may complete the checklist; canApprove — may complete the items
//              another owner signs (item.owner); both false = read only
// locked     — a sentence saying why the checklist cannot be worked yet, or null
// autoRows   — (source) => [[label, value, missingText?]] for auto items
// upload     — async (itemKey, files) => [{ id, filename, url }]: where a stage
//              files the documents attached on an item. Without it, files are
//              kept by name with the answers.

import { useRef, useState } from "react";
import { Check, ExternalLink, Leaf, Lock, Paperclip, Send, X } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Field from "@/components/Field";
import NumberInput from "@/components/NumberInput";
import { appliesTo, blank, checklistSummary, isNmi, itemDone, itemNumber, itemRange, sectionApplies, statusBlockers, statusOf } from "@/helpers/checklist";

const ACTION_ICONS = { leaf: Leaf, send: Send };

function AutoRows({ rows }) {
  return (
    <div className="list-stack cl-auto">
      {rows.map(([label, value, missing]) => (
        <div className="list-row" key={label}>
          <span className="row-meta">{label}</span>
          {blank(value) ? (
            <span className="row-meta cl-missing">{missing ?? "Not on the job record"}</span>
          ) : (
            <span className="row-title" style={{ textAlign: "right" }}>
              {value}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

/**
 * Attached documents. With an uploader they go on the job and come back with a
 * link; without one they are kept by name with the checklist.
 */
function FilePicker({ id, files = [], onChange, disabled, upload = null }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const add = async (list) => {
    const chosen = Array.from(list || []);
    if (!chosen.length) return;
    const known = new Set(files.map((file) => file.id));
    if (!upload) {
      const added = chosen.map((file) => ({ id: `${file.name}-${file.size}-${file.lastModified}`, filename: file.name }));
      onChange([...files, ...added.filter((file) => !known.has(file.id))]);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const uploaded = await upload(chosen);
      onChange([...files, ...uploaded.filter((file) => !known.has(file.id))]);
    } catch (err) {
      setError(typeof err === "string" ? err : err?.message || "The file could not be uploaded.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="cl-files">
      {files.length ? (
        <div className="list-stack">
          {files.map((file) => (
            <div className="list-row" key={file.id}>
              <span style={{ display: "flex", gap: 8, alignItems: "center", minWidth: 0 }}>
                <Paperclip size={14} />
                {file.url ? (
                  <a className="row-title cl-filename" href={file.url} target="_blank" rel="noreferrer" style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
                    {file.filename} <ExternalLink size={12} />
                  </a>
                ) : (
                  <span className="row-title cl-filename">{file.filename}</span>
                )}
              </span>
              {!disabled ? (
                <button type="button" className="btn btn-ghost btn-sm" aria-label={`Remove ${file.filename}`} onClick={() => onChange(files.filter((f) => f.id !== file.id))}>
                  <X size={14} />
                </button>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <span className="row-meta">Nothing attached yet.</span>
      )}
      {error ? <span className="row-meta cl-missing">{error}</span> : null}
      {!disabled ? (
        <>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => inputRef.current?.click()} disabled={busy}>
            <Paperclip size={14} /> {busy ? "Uploading…" : `Attach ${files.length ? "another" : "file"}`}
          </button>
          <input
            ref={inputRef}
            id={id}
            type="file"
            multiple
            hidden
            onChange={(e) => {
              add(e.target.files);
              e.target.value = "";
            }}
          />
        </>
      ) : null}
    </div>
  );
}

function Select({ id, value, options, onChange, disabled, placeholder = "Choose…" }) {
  const groups = [...new Set(options.map((option) => option.group).filter(Boolean))];
  const option = (entry) => (
    <option key={entry.value} value={entry.value}>
      {entry.label}
    </option>
  );
  return (
    <select id={id} value={value ?? ""} disabled={disabled} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {groups.length
        ? groups.map((group) => (
            <optgroup key={group} label={group}>
              {options.filter((entry) => entry.group === group).map(option)}
            </optgroup>
          ))
        : options.map(option)}
    </select>
  );
}

const YES_NO = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

export default function ChecklistForm({ section, answers = {}, ctx, canEdit = false, canApprove = canEdit, locked = null, autoRows = () => [], onChange, upload = null }) {
  const summary = checklistSummary(section, answers, ctx, { locked: Boolean(locked) });
  const set = (key, value) => onChange?.({ [key]: value });
  const uploaderFor = (key) => (upload ? (files) => upload(key, files) : null);
  // A locked checklist is shown, not hidden — the coordinator can see what is coming.
  const editable = (item) => !locked && (item?.owner ? canApprove : canEdit);
  const owners = [...new Set(section.items.map((item) => item.owner).filter(Boolean))];

  /** One answer, as the control its field calls for. */
  const control = (field, value, onValue, id, disabled) => {
    switch (field.kind) {
      case "select":
        return <Select id={id} value={value} options={field.options} onChange={onValue} disabled={disabled} />;
      case "yesno":
        return <Select id={id} value={value} options={YES_NO} onChange={onValue} disabled={disabled} placeholder="Yes or no…" />;
      case "number":
        return <NumberInput id={id} value={value ?? ""} min={0} disabled={disabled} onChange={onValue} />;
      case "date":
        return <input id={id} type="date" value={value ?? ""} disabled={disabled} onChange={(e) => onValue(e.target.value)} />;
      case "time":
        return <input id={id} type="time" value={value ?? ""} disabled={disabled} onChange={(e) => onValue(e.target.value)} />;
      case "textarea":
        return <textarea id={id} rows={3} value={value ?? ""} disabled={disabled} maxLength={2000} placeholder={field.placeholder} onChange={(e) => onValue(e.target.value)} />;
      case "checkbox":
        return (
          <label className="check cl-check">
            <input id={id} type="checkbox" checked={value === true} disabled={disabled} onChange={(e) => onValue(e.target.checked)} />
            <span>{field.label}</span>
          </label>
        );
      case "files":
        return <FilePicker id={id} files={value ?? []} onChange={onValue} disabled={disabled} upload={uploaderFor(field.key)} />;
      case "auto":
        return <AutoRows rows={autoRows(field.source)} />;
      default:
        return <input id={id} value={value ?? ""} disabled={disabled} maxLength={500} placeholder={field.placeholder} onChange={(e) => onValue(e.target.value)} />;
    }
  };

  /** A field inside a group or a status record, with its label. */
  const labelled = (field, value, onValue, id, disabled, { span = false } = {}) =>
    field.kind === "checkbox" ? (
      <div key={field.key} className={span ? "span-2" : undefined}>
        {control(field, value, onValue, id, disabled)}
      </div>
    ) : field.kind === "auto" ? (
      // The auto rows carry their own labels.
      <div key={field.key} className="span-2">
        {control(field, value, onValue, id, disabled)}
      </div>
    ) : (
      <Field key={field.key} className={span ? "span-2" : undefined} label={field.label} hint={field.optional ? "optional" : field.hint} htmlFor={id}>
        {control(field, value, onValue, id, disabled)}
      </Field>
    );

  const spans = (field) => field.kind === "files" || field.kind === "textarea" || field.kind === "checkbox" || field.kind === "auto";

  const body = (item) => {
    const id = `cl-${section.key}-${item.key}`;
    const disabled = !editable(item);
    const applies = appliesTo(item, ctx);
    if (applies === false) return <div className="row-meta cl-not-needed">{item.notNeeded ?? "Not needed on this job."}</div>;
    if (applies === null)
      return <div className="row-meta cl-not-needed">{item.waitingOn ? `Answer ${itemRange(section, item.waitingOn)} first.` : "Answer the earlier items first."}</div>;

    switch (item.kind) {
      case "auto":
        return (
          <>
            <AutoRows rows={autoRows(item.source)} />
            <label className="check cl-check">
              <input id={id} type="checkbox" checked={answers[item.key] === true} disabled={disabled} onChange={(e) => set(item.key, e.target.checked)} />
              <span>{item.confirmLabel ?? "Shown correctly — details confirmed"}</span>
            </label>
          </>
        );
      case "checkbox":
        return control(item, answers[item.key], (value) => set(item.key, value), id, disabled);
      case "checkDetails":
        return (
          <>
            <label className="check cl-check">
              <input id={id} type="checkbox" checked={answers[item.key] === true} disabled={disabled} onChange={(e) => set(item.key, e.target.checked)} />
              <span>{item.checkLabel}</span>
            </label>
            <Field label={item.detailsLabel} hint={item.detailsRequired ? undefined : item.detailsHint} htmlFor={`${id}-details`}>
              <input
                id={`${id}-details`}
                value={answers[item.detailsKey] ?? ""}
                disabled={disabled}
                maxLength={500}
                placeholder={item.placeholder}
                onChange={(e) => set(item.detailsKey, e.target.value)}
              />
            </Field>
          </>
        );
      case "group": {
        const Icon = ACTION_ICONS[item.action?.icon] ?? Leaf;
        return (
          <>
            {item.action ? (
              <div className="cl-action">
                <button type="button" className="btn btn-primary btn-sm" disabled title={item.action.title}>
                  <Icon size={14} /> {item.action.label}
                </button>
                <span className="row-meta">{item.action.note}</span>
              </div>
            ) : null}
            <div className="form-grid cl-grid">
              {item.fields
                .filter((field) => appliesTo(field, ctx) === true)
                .map((field) => labelled(field, answers[field.key], (value) => set(field.key, value), `${id}-${field.key}`, disabled, { span: spans(field) }))}
            </div>
          </>
        );
      }
      case "documents": {
        const documents = answers.documents ?? {};
        return (
          <div className="cl-slots">
            {item.slots.map((slot) => (
              <div key={slot.key} className="cl-slot">
                <div className="cl-slot-head">
                  <span className="row-title">{slot.label}</span>
                  {documents[slot.key]?.length ? <Badge tone="success">Attached</Badge> : <Badge tone="neutral">Missing</Badge>}
                </div>
                <FilePicker id={`${id}-${slot.key}`} files={documents[slot.key] ?? []} disabled={disabled} upload={uploaderFor(slot.key)} onChange={(files) => set("documents", { ...documents, [slot.key]: files })} />
              </div>
            ))}
          </div>
        );
      }
      case "files":
        return <FilePicker id={id} files={answers[item.key] ?? []} disabled={disabled} upload={uploaderFor(item.key)} onChange={(files) => set(item.key, files)} />;
      case "status": {
        const current = statusOf(section, answers);
        const stale = statusBlockers(section, answers, ctx, current.value);
        const choices = item.statuses.map((status) => ({ ...status, blockers: statusBlockers(section, answers, ctx, status.value) }));
        // What it takes to move forward — a rejection needs no prompting.
        const next = choices.filter((status) => status.value !== current.value && status.blockers.length && status.track !== "rejected");
        return (
          <>
            <Field label="Status" htmlFor={id}>
              <select id={id} value={current.value} disabled={disabled} onChange={(e) => set("status", e.target.value)}>
                {choices.map((status) => (
                  <option key={status.value} value={status.value} disabled={status.blockers.length > 0 && status.value !== current.value}>
                    {status.label}
                    {status.blockers.length && status.value !== current.value ? " — not yet" : ""}
                  </option>
                ))}
              </select>
            </Field>
            {stale.length ? (
              <Alert tone="warning" style={{ margin: "10px 0 0" }}>
                Marked <strong>{current.label.toLowerCase()}</strong>, but something has changed since: {stale.join("; ")}.
              </Alert>
            ) : next.length && !disabled ? (
              <div className="row-meta cl-blockers">
                {next.map((status) => (
                  <div key={status.value}>
                    <strong>{status.label.split(" — ")[0]}</strong>: {status.blockers.join("; ")}.
                  </div>
                ))}
              </div>
            ) : null}
            <div className="form-grid cl-grid" style={{ marginTop: 12 }}>
              {item.records
                .filter((record) => appliesTo(record, ctx) !== false)
                .map((record) => labelled(record, answers[record.key], (value) => set(record.key, value), `${id}-${record.key}`, disabled, { span: spans(record) }))}
            </div>
          </>
        );
      }
      default: {
        const value = answers[item.key];
        const invalid = item.validate === "nmi" && !blank(value) && !isNmi(value);
        return (
          <Field error={invalid ? "An NMI is 10 characters — 11 with its checksum digit." : undefined} htmlFor={id}>
            {control(item, value, (next) => set(item.key, next), id, disabled)}
          </Field>
        );
      }
    }
  };

  const items = section.items.map((item) => {
    const done = itemDone(section, item, answers, ctx);
    const number = itemNumber(section, item.key);
    return (
      <div key={item.key} className={`cl-item ${done ? "done" : ""}`.trim()} id={`${section.key}-item-${number}`}>
        <span className="cl-no" aria-label={done ? `Item ${number} done` : `Item ${number}`}>
          {done ? <Check size={14} /> : number}
        </span>
        <div className="cl-body">
          {item.kind !== "checkbox" || item.owner ? (
            <div className="cl-label">
              {item.kind !== "checkbox" ? item.label : null}
              {item.owner ? <Badge tone="gold">{item.owner}</Badge> : null}
            </div>
          ) : null}
          {body(item)}
          {item.note ? <div className="row-meta cl-note">{item.note}</div> : null}
        </div>
      </div>
    );
  });

  const readOnly = !canEdit && !canApprove;
  return (
    <div className="cl">
      <div className="cl-head">
        <div style={{ minWidth: 0 }}>
          <div className="cl-title">
            <Badge tone="neutral">{section.code}</Badge>
            <strong>{section.title}</strong>
          </div>
          <div className="row-meta">
            Completed by the {section.owner ?? "Operations Coordinator"}
            {owners.length ? ` · items marked ${owners.join(", ")} are theirs to sign` : ""}
            {readOnly ? " · read only" : ""}
          </div>
        </div>
        <Badge tone={summary.tone}>{summary.label}</Badge>
      </div>

      {section.optional ? (
        <label className="check cl-check cl-applies">
          <input type="checkbox" checked={answers.applies === true} disabled={!canEdit} onChange={(e) => set("applies", e.target.checked)} />
          <span>{section.appliesLabel ?? "This applies to the job"}</span>
        </label>
      ) : null}

      {!sectionApplies(section, answers) ? (
        <Alert tone="info">{section.notApplicableText ?? "Not needed on this job."}</Alert>
      ) : (
        <>
          {locked ? (
            <Alert tone="info" className="cl-lock">
              <Lock size={14} /> {locked}
            </Alert>
          ) : summary.done === summary.total ? (
            <Alert tone="success">{section.completeText ?? `${section.title} complete.`}</Alert>
          ) : null}
          <div className="checklist-progress">
            <span className="cp-label">
              {summary.done} of {summary.total} items
            </span>
            <div className="cp-track">
              <i style={{ width: `${(summary.done / summary.total) * 100}%` }} />
            </div>
          </div>
          <div className="cl-items">{items}</div>
        </>
      )}
    </div>
  );
}
