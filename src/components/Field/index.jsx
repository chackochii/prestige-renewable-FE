// Labelled form field with hint and validation message.
//
// `required` marks the field with an asterisk. It is the one signal for a
// mandatory field across every form — a hint reading "required" says the same
// thing in more words and in the place people scan last.

export default function Field({ label, hint, error, required = false, children, className = "", htmlFor }) {
  return (
    <div className={`field ${className} ${error ? "invalid" : ""}`.trim()}>
      {label ? (
        <label htmlFor={htmlFor}>
          {label}
          {required ? (
            <span className="req" title="Required">
              *<span className="sr-only"> (required)</span>
            </span>
          ) : null}
          {hint ? <span className="hint"> · {hint}</span> : null}
        </label>
      ) : null}
      {children}
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}
