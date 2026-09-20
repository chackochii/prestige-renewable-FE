// What arrived from the lead, shown inside the estimation requirements check.
//
// The mandatory rows are read-only — sales had to complete them before the
// handover, so there is nothing for estimation to do but read them. The
// optional rows are different: sales was never required to fill them in, so
// anything still blank is collected here, from the client, by the estimator.

import { useState } from "react";
import { Check, Circle, Pencil, Send, UserPlus, X } from "lucide-react";
import Badge from "@/components/Badge";
import Field from "@/components/Field";
import NumberInput from "@/components/NumberInput";
import RequestFormModal from "@/features/collaboration/RequestFormModal";
import { PERMIT_OPTIONS } from "@/constants/estimationInput";
import { countDone, groupOptionalItems, leadMandatoryItems, leadOptionalItems } from "@/helpers/leadChecklist";
import { oppTitle } from "@/helpers/opportunity";
import { useNotifications } from "@/hooks/useNotifications";
import { useUnitUsers } from "@/hooks/useUnitUsers";
import { useAppDispatch } from "@/store";
import { createRequest } from "@/slices/collaborationSlice";
import { collectEstimationInputs } from "@/slices/leadsSlice";

const errText = (err, fallback) => (typeof err === "string" ? err : err?.message || fallback);

/** A row estimation can ask sales about — the read-only ones are not questions. */
const askable = (row) => row.type !== "readonly";

/** The answer type sales gets on the response form, from the row's own control. */
const ANSWER_TYPES = { textarea: "textarea", number: "number" };
const answerType = (row) => ANSWER_TYPES[row.type] || "text";

/**
 * The note sales reads on the request: the job, then exactly the rows that
 * were ticked, so the ask is legible before they open the response form.
 */
function noteFor(opp, rows) {
  const lines = rows.map((row) => `• ${row.label}${row.group ? ` (${row.group})` : ""}`);
  return [
    `Estimation needs the following lead information for ${opp?.number || "this job"} — ${oppTitle(opp)}:`,
    "",
    ...lines,
    "",
    "Please confirm each one with the client and answer them on the form below.",
  ].join("\n");
}

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
function OptionalRow({ row, canEdit, onSave, saving, selecting = false, selected = false, onSelect }) {
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

  // While estimation is picking what to ask sales, every row is a checkbox.
  if (selecting) {
    const pickable = askable(row);
    return (
      <label className={`lead-input-row is-picking${pickable ? "" : " is-locked"}`}>
        <span className="status-icon pick">
          <input type="checkbox" checked={selected} disabled={!pickable} onChange={() => onSelect(row.field)} />
        </span>
        <span className="lead-input-label">{row.label}</span>
        <span className={`lead-input-value${row.done ? "" : " is-missing"}`}>
          {!pickable
            ? "Comes off the record — nothing to ask"
            : row.done
              ? row.display || "Confirmed"
              : "Not supplied by sales"}
        </span>
      </label>
    );
  }

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

export default function LeadInputs({
  opp,
  canEdit = false,
  stage = 2,
  billFiles = [],
  drawings = [],
  sitePhotos = [],
}) {
  const dispatch = useAppDispatch();
  const { notify, error: notifyError } = useNotifications();
  const { active, sales } = useUnitUsers();
  const [saving, setSaving] = useState(false);
  // Assigning the blanks back to sales: tick the rows, then raise one
  // information request for all of them. Starts on whatever sales left out,
  // which is the usual ask.
  const [selecting, setSelecting] = useState(false);
  const [picked, setPicked] = useState([]);
  const [requesting, setRequesting] = useState(false);

  const mandatory = leadMandatoryItems(opp, { billCount: billFiles.length });
  const optional = leadOptionalItems(opp, { drawingCount: drawings.length, sitePhotoCount: sitePhotos.length });
  const optionalGroups = groupOptionalItems(optional);
  const mandatoryDone = countDone(mandatory);
  const optionalDone = countDone(optional);
  const outstanding = optional.filter((row) => !row.done && row.type !== "readonly");
  const pickedRows = optional.filter((row) => picked.includes(row.field));

  const startPicking = () => {
    setPicked(outstanding.map((row) => row.field));
    setSelecting(true);
  };

  const stopPicking = () => {
    setSelecting(false);
    setPicked([]);
  };

  const togglePick = (field) =>
    setPicked((list) => (list.includes(field) ? list.filter((f) => f !== field) : [...list, field]));

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

  const raiseRequest = async (body) => {
    await dispatch(createRequest({ opportunityId: opp.id, body })).unwrap();
    notify("Request sent to sales");
    stopPicking();
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
          <div className="lead-input-actions">
            <Badge tone={outstanding.length ? "warning" : "success"}>
              {optionalDone}/{optional.length} supplied
            </Badge>
            {canEdit && !selecting ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={startPicking}>
                <UserPlus size={14} /> Assign to sales
              </button>
            ) : null}
            {canEdit && selecting ? (
              <>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  disabled={!pickedRows.length}
                  onClick={() => setRequesting(true)}
                >
                  <Send size={14} /> Request{pickedRows.length ? ` (${pickedRows.length})` : ""}
                </button>
                <button type="button" className="btn btn-ghost btn-sm" onClick={stopPicking}>
                  <X size={14} /> Cancel
                </button>
              </>
            ) : null}
          </div>
        </div>
        <p className="lede" style={{ marginBottom: 12 }}>
          {selecting
            ? "Tick everything sales has to confirm, then Request — they go across as one information request."
            : outstanding.length
              ? `Sales left ${outstanding.length} of these blank — collect them from the client and record them here, or assign them back to sales.`
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
                <OptionalRow
                  key={row.field}
                  row={row}
                  canEdit={canEdit}
                  onSave={saveField}
                  saving={saving}
                  selecting={selecting}
                  selected={picked.includes(row.field)}
                  onSelect={togglePick}
                />
              ))}
            </div>
          </div>
        ))}
      </div>

      {requesting ? (
        <RequestFormModal
          opportunity={opp}
          stage={stage}
          kind="information"
          department="sales"
          people={sales.length ? sales : active}
          initial={{
            title: `Lead information needed — ${pickedRows.length} item${pickedRows.length === 1 ? "" : "s"}`,
            description: noteFor(opp, pickedRows),
            fields: pickedRows.map((row) => ({ key: row.field, label: row.label, type: answerType(row) })),
          }}
          onClose={() => setRequesting(false)}
          onSubmit={async (body) => {
            try {
              await raiseRequest(body);
            } catch (err) {
              notifyError(errText(err, "Could not raise the request."));
              throw err;
            }
          }}
        />
      ) : null}
    </>
  );
}
