// Spinner with a short message. `screen` centres it in the viewport.

export default function LoadingState({ label = "Loading…", screen = false }) {
  return (
    <div className={`loading ${screen ? "screen" : ""}`.trim()} role="status" aria-live="polite">
      <span className="spinner" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
