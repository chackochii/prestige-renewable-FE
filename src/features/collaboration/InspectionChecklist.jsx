// The pre-site inspection checklist as a picker: everything a visit could
// bring back, with the requester ticking what this job actually needs.
//
// What is ticked travels with the request to the operations coordinator, who
// hands it to whoever is attending — each ticked item becomes a field on their
// form. Nothing is ticked by default: an inspection asked to confirm forty
// things is an inspection nobody finishes.

import { INSPECTION_SECTIONS } from "@/constants/inspectionReport";

/** Only items a person can answer; photos are asked for as document slots. */
const askable = (field) => field.kind !== "files";

export default function InspectionChecklist({ selected = [], onChange, disabled = false }) {
  const toggle = (key) =>
    onChange(selected.includes(key) ? selected.filter((k) => k !== key) : [...selected, key]);

  const setSection = (fields, on) => {
    const keys = fields.map((f) => f.key);
    onChange(on ? [...new Set([...selected, ...keys])] : selected.filter((k) => !keys.includes(k)));
  };

  return (
    <>
      {INSPECTION_SECTIONS.map((section) => {
        const fields = section.fields.filter(askable);
        if (!fields.length) return null;
        const chosen = fields.filter((f) => selected.includes(f.key)).length;
        const all = chosen === fields.length;
        return (
          <div key={section.key} className="section" style={{ marginTop: 16, marginBottom: 0 }}>
            <div className="input-group-head">
              <h4>{section.title}</h4>
              <span>
                {chosen}/{fields.length}
                {disabled ? null : (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ marginLeft: 8 }}
                    onClick={() => setSection(fields, !all)}
                  >
                    {all ? "Clear" : "Select all"}
                  </button>
                )}
              </span>
            </div>
            <div className="choice-grid" style={{ marginTop: 10 }}>
              {fields.map((field) => (
                <label key={field.key} className="choice">
                  <input
                    type="checkbox"
                    checked={selected.includes(field.key)}
                    disabled={disabled}
                    onChange={() => toggle(field.key)}
                  />
                  <span>
                    {field.label}
                    {field.hint ? <small>{field.hint}</small> : null}
                  </span>
                </label>
              ))}
            </div>
          </div>
        );
      })}
    </>
  );
}
