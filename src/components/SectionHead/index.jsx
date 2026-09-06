// Small uppercase section heading with optional icon.

export default function SectionHead({ icon, title }) {
  return (
    <div className="section-head">
      {icon ? <span className="section-icon">{icon}</span> : null}
      <h3>{title}</h3>
    </div>
  );
}
