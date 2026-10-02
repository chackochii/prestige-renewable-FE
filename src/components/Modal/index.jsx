// Modal dialog.
//
// Closing is deliberate: a close button in the corner and Escape, both behind
// a confirmation, and nothing happens when the backdrop is clicked. These
// dialogs hold forms people have been filling in for minutes — losing that to
// a stray click beside the box is the kind of thing nobody reports and
// everybody resents.
//
// Pass `confirmClose={false}` where there is nothing to lose: a preview, or a
// dialog that is itself a confirmation.

import { useCallback, useEffect } from "react";
import { X } from "lucide-react";

const CLOSE_WARNING = "Close this? Anything you have entered here will be lost.";

export default function Modal({
  title,
  body,
  children,
  onClose,
  actions,
  className = "",
  confirmClose = true,
  closeWarning = CLOSE_WARNING,
}) {
  const requestClose = useCallback(() => {
    if (confirmClose && !window.confirm(closeWarning)) return;
    onClose?.();
  }, [confirmClose, closeWarning, onClose]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestClose]);

  return (
    // No onClick here: a click outside the dialog does nothing on purpose.
    <div className="modal-back" role="presentation">
      <div className={`modal ${className}`.trim()} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : undefined}>
        <button type="button" className="modal-close" onClick={requestClose} aria-label="Close">
          <X size={18} />
        </button>
        <h2>{title}</h2>
        {body ? (
          <p className="lede" style={{ marginBottom: 16 }}>
            {body}
          </p>
        ) : null}
        {children}
        {actions ? <div className="modal-actions">{actions}</div> : null}
      </div>
    </div>
  );
}
