// Name an approval the unit's list does not have, and add it to the job.
// It belongs to this job only (opportunity.customApprovalTypes) and is ticked
// on it straight away — in estimation's list and on the approvals board.
// `onAdd(label)` saves it; the box clears once that resolves.

import { useState } from "react";
import { Plus } from "lucide-react";

export default function AddCustomApproval({ onAdd, disabled = false, placeholder = "Custom approval, e.g. Strata approval" }) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const label = name.trim();

  const add = async () => {
    if (!label) return;
    setBusy(true);
    try {
      const ok = await onAdd?.(label);
      if (ok !== false) setName("");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
      <input
        type="text"
        value={name}
        maxLength={120}
        placeholder={placeholder}
        aria-label="Custom approval name"
        disabled={disabled || busy}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            add();
          }
        }}
        style={{ minWidth: 260, flex: "1 1 260px", maxWidth: 420 }}
      />
      <button type="button" className="btn btn-ghost btn-sm" onClick={add} disabled={disabled || busy || !label}>
        <Plus size={14} /> {busy ? "Adding…" : "Add custom approval"}
      </button>
    </div>
  );
}
