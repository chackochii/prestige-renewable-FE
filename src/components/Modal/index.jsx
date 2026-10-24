// Modal dialog.
//
// Closing is deliberate: a close button in the corner and Escape, both behind
// a confirmation, and nothing happens when the backdrop is clicked. These
// dialogs hold forms people have been filling in for minutes — losing that to
// a stray click beside the box is the kind of thing nobody reports and
// everybody resents.
//
// Pass `confirmClose={false}` where there is nothing to lose: a preview, or a
// dialog that is itself a confirmation. The confirmation is a popup of our own
// over the dialog — never the browser's confirm box.
//
// Escape is for the dialog on top only: a confirmation opened from inside a
// dialog (deleting a photo on a request) closes by itself, and the dialog
// under it does not also ask to close.

import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";

const CLOSE_WARNING = "Anything you have entered here will be lost.";

/** Whether `element` is the backdrop on top: the last one in the page, as a dialog opened from inside another renders after it. */
const isTopmost = (element) => {
  const backdrops = document.querySelectorAll(".modal-back");
  return Boolean(element) && backdrops[backdrops.length - 1] === element;
};

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
  const [confirming, setConfirming] = useState(false);
  const backRef = useRef(null);
  const confirmRef = useRef(null);

  const requestClose = useCallback(() => {
    if (!confirmClose) return onClose?.();
    return setConfirming(true);
  }, [confirmClose, onClose]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      // Escape backs out of the close confirmation first, then asks to close.
      if (confirming) {
        if (isTopmost(confirmRef.current)) setConfirming(false);
      } else if (isTopmost(backRef.current)) requestClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [confirming, requestClose]);

  return (
    // No onClick here: a click outside the dialog does nothing on purpose.
    <div className="modal-back" role="presentation" ref={backRef}>
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
      {confirming ? (
        <div className="modal-back" role="presentation" ref={confirmRef}>
          <div className="modal" role="alertdialog" aria-modal="true" aria-label="Close without saving?">
            <h2>Close without saving?</h2>
            <p className="lede" style={{ marginBottom: 16 }}>
              {closeWarning}
            </p>
            <div className="modal-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setConfirming(false)}>
                Keep editing
              </button>
              <button type="button" className="btn btn-danger" onClick={() => onClose?.()}>
                Discard
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
