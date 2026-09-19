// What arrived from the lead, shown inside the estimation requirements check.
//
// The mandatory rows are read-only — sales had to complete them before the
// handover, so there is nothing for estimation to do but read them. The
// optional rows are different: sales was never required to fill them in, so
// anything still blank is collected here, from the client, by the estimator.

import { useState } from "react";
import { Check, Circle, Pencil } from "lucide-react";
import Badge from "@/components/Badge";
import Field from "@/components/Field";
import NumberInput from "@/components/NumberInput";
import { PERMIT_OPTIONS } from "@/constants/estimationInput";
import { countDone, groupOptionalItems, leadMandatoryItems, leadOptionalItems } from "@/helpers/leadChecklist";
import { useNotifications } from "@/hooks/useNotifications";
import { useAppDispatch } from "@/store";
import { collectEstimationInputs } from "@/slices/leadsSlice";

const errText = (err, fallback) => (typeof err === "string" ? err : err?.message || fallback);

function Tick({ done, label, value }) {
  return (
    <div className="lead-input-row">
      <span className={`status-icon ${done ? "done" : "pending"}`}>
        {done ? <Check size={15} /> : <Circle size={15} />}
      </span>
      <span className="lead-input-label">{label}</span>
      <span className={`lead-input-value${done ? "" : " is-missing"}`}>{done ? value || "Confirmed" : "Not supplied"}</span>
    </div>
  );
}

/** One optional row: read-only when sales supplied it, editable when they didn't. */
function OptionalRow({ row, canEdit, onSave, saving }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(row.value ?? "");

  const commit = async () => {
    await onSave(row.field, row.type === "checkbox" ? Boolean(value) : value);
    setEditing(false);
  };

  const control = () => {
    if (row.type === "textarea")
      return <textarea rows={2} value={value} onChange={(e) => setValue(e.target.value)} />;
    if (row.type === "number") return <NumberInput value={value} min={0} onChange={setValue} />;
    if (row.type === "yesno")
      return (
        <select value={value} onChange={(e) => setValue(e.target.value)}>
          <option value="">Select</option>
          <option value="yes">Yes</option>
          <option value="no">No</option>
        </select>
      );
    if (row.type === "select")
      return (
        <select value={value} onChange={(e) => setValue(e.target.value)}>
          <option value="">Select</option>
          {row.options.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
      );
    if (row.type === "permits")
      return (
        <div className="choice-grid">
          {PERMIT_OPTIONS.map((permit) => {
            const list = Array.isArray(value) ? value : [];
            return (
              <label key={permit.key} className="choice">
                <input
                  type="checkbox"
                  checked={list.includes(permit.key)}
                  onChange={() =>
                    setValue(list.includes(permit.key) ? list.filter((k) => k !== permit.key) : [...list, permit.key])
                  }
                />
                <span>{permit.label}</span>
              </label>
            );
          })}
        </div>
      );
    if (row.type === "checkbox")
      return (
        <label className="check" style={{ margin: 0 }}>
          <input type="checkbox" checked={Boolean(value)} onChange={(e) => setValue(e.target.checked)} />
          Confirmed
        </label>
      );
    return <input type="text" value={value} onChange={(e) => setValue(e.target.value)} />;
  };

  if (editing) {
    return (
      <div className="lead-input-row is-editing">
        <span className="status-icon pending">
          <Circle size={15} />
        </span>
        <span className="lead-input-label">{row.label}</span>
        <span className="lead-input-value">
          <Field hint="collected from the client">{control()}</Field>
          <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
            <button type="button" className="btn btn-primary btn-sm" onClick={commit} disabled={saving}>
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </button>
          </div>
        </span>
      </div>
    );
  }

  return (
    <div className="lead-input-row">
      <span className={`status-icon ${row.done ? "done" : "pending"}`}>
        {row.done ? <Check size={15} /> : <Circle size={15} />}
      </span>
      <span className="lead-input-label">{row.label}</span>
      <span className={`lead-input-value${row.done ? "" : " is-missing"}`}>
        {row.done ? row.display || "Confirmed" : "Not supplied by sales"}
        {canEdit && row.type !== "readonly" ? (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ marginLeft: 8 }}
            onClick={() => {
              setValue(row.type === "permits" ? (Array.isArray(row.value) ? row.value : []) : row.value ?? "");
              setEditing(true);
            }}
          >
            <Pencil size={13} /> {row.done ? "Update" : "Collect"}
          </button>
        ) : null}
      </span>
    </div>
  );
}

export default function LeadInputs({ opp, canEdit = false, billFiles = [], drawings = [], sitePhotos = [] }) {
  const dispatch = useAppDispatch();
  const { notify, error: notifyError } = useNotifications();
  const [saving, setSaving] = useState(false);

  const mandatory = leadMandatoryItems(opp, { billCount: billFiles.length });
  const optional = leadOptionalItems(opp, { drawingCount: drawings.length, sitePhotoCount: sitePhotos.length });
  const optionalGroups = groupOptionalItems(optional);
  const mandatoryDone = countDone(mandatory);
  const optionalDone = countDone(optional);
  const outstanding = optional.filter((row) => !row.done && row.type !== "readonly");

  const saveField = async (field, value) => {
    setSaving(true);
    try {
      await dispatch(collectEstimationInputs({ id: opp.id, body: { input: { [field]: value } } })).unwrap();
      notify("Saved to the job");
    } catch (err) {
      notifyError(errText(err, "Could not save it."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="section" style={{ marginTop: 24 }}>
        <div className="estimation-item-head">
          <h3>From the lead · mandatory</h3>
          <Badge tone={mandatoryDone === mandatory.length ? "success" : "warning"}>
            {mandatoryDone}/{mandatory.length} complete
          </Badge>
        </div>
        <p className="lede" style={{ marginBottom: 12 }}>
          What sales had to confirm before handing the lead over. Read-only here.
        </p>
        <div className="lead-input-list">
          {mandatory.map((row) => (
            <Tick key={row.key} done={row.done} label={row.label} value={row.value} />
          ))}
        </div>
      </div>

      <div className="section" style={{ marginTop: 24 }}>
        <div className="estimation-item-head">
          <h3>From the lead · optional</h3>
          <Badge tone={outstanding.length ? "warning" : "success"}>
            {optionalDone}/{optional.length} supplied
          </Badge>
        </div>
        <p className="lede" style={{ marginBottom: 12 }}>
          {outstanding.length
            ? `Sales left ${outstanding.length} of these blank — collect them from the client and record them here.`
            : "Everything optional was supplied with the lead."}
        </p>
        {optionalGroups.map((group) => (
          <div key={group.title} className="input-group">
            <div className="input-group-head">
              <h4>{group.title}</h4>
              <span>
                {countDone(group.rows)}/{group.rows.length}
              </span>
            </div>
            <div className="lead-input-list">
              {group.rows.map((row) => (
                <OptionalRow key={row.field} row={row} canEdit={canEdit} onSave={saveField} saving={saving} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
