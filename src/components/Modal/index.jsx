// Modal dialog. Closes on backdrop click and Escape.

import { useEffect } from "react";

export default function Modal({ title, body, children, onClose, actions, className = "" }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-back" onClick={onClose} role="presentation">
      <div
        className={`modal ${className}`.trim()}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === "string" ? title : undefined}
      >
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
