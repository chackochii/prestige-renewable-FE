// Labelled form field with hint and validation message.

export default function Field({ label, hint, error, children, className = "", htmlFor }) {
  return (
    <div className={`field ${className} ${error ? "invalid" : ""}`.trim()}>
      {label ? (
        <label htmlFor={htmlFor}>
          {label}
          {hint ? <span className="hint"> · {hint}</span> : null}
        </label>
      ) : null}
      {children}
      {error ? <span className="field-error">{error}</span> : null}
    </div>
  );
}
