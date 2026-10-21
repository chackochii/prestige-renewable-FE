// The button under a tab that moves on to the next one. It is always there,
// so people can see where the work goes next; while the tab still needs
// something it is disabled, and hovering it says what (`blockers`).
//
// `onContinue` runs first — typically the save that sends the tab to the API —
// and only when it resolves to something other than false does the next tab
// open (`onDone`).

import { useState } from "react";
import { ArrowRight } from "lucide-react";

export default function ContinueButton({
  nextLabel,
  blockers = [],
  onContinue,
  onDone,
  verb = "Continue",
  className = "btn btn-primary btn-sm",
  style,
}) {
  const [busy, setBusy] = useState(false);
  const pending = blockers.filter(Boolean);
  const blocked = pending.length > 0;

  const click = async () => {
    setBusy(true);
    try {
      const ok = onContinue ? await onContinue() : true;
      if (ok !== false) onDone?.();
    } finally {
      setBusy(false);
    }
  };

  return (
    // A disabled button fires no hover events in every browser, so the reason
    // sits on a wrapper that always does.
    <span title={blocked ? `Still needed: ${pending.join(", ")}` : undefined} style={{ display: "inline-block", ...style }}>
      <button type="button" className={className} onClick={click} disabled={blocked || busy} aria-disabled={blocked || busy}>
        {busy ? "Saving…" : `${verb} to ${nextLabel}`} <ArrowRight size={14} />
      </button>
    </span>
  );
}
