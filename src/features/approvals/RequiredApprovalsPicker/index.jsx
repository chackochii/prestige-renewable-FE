// Which approvals a job will need — ticked from the unit's catalogue (Admin →
// Unit settings → Approval types). Sales ticks them on the lead, estimation
// confirms them, and the approvals stage tracks exactly these. Used wherever
// the list is edited, so the three screens agree.
//
// `value` — the keys ticked; `onChange(keys)` — the new list, in catalogue
// order; `hints` — a note under an option (e.g. finance: "sales noted a loan").

import { catalogueOf } from "@/helpers/requiredApprovals";

export default function RequiredApprovalsPicker({ unit, value = [], onChange, disabled = false, hints = {} }) {
  const catalogue = catalogueOf(unit);
  const ticked = new Set(Array.isArray(value) ? value : []);

  if (!catalogue.length)
    return <p className="row-meta">This business unit has no approval types set up — add them in Admin → Unit settings.</p>;

  const toggle = (key) => {
    const next = new Set(ticked);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    onChange?.(catalogue.map((type) => type.key).filter((candidate) => next.has(candidate)));
  };

  return (
    <div className="choice-grid">
      {catalogue.map((type) => (
        <label key={type.key} className="choice">
          <input type="checkbox" checked={ticked.has(type.key)} disabled={disabled} onChange={() => toggle(type.key)} />
          <span>
            {type.label}
            {hints[type.key] ? <small>{hints[type.key]}</small> : null}
          </span>
        </label>
      ))}
    </div>
  );
}
