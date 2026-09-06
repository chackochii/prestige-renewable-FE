// Surface card with optional title, icon and sub-copy.

export default function Card({ title, sub, icon, children, pad = true, className = "", style, actions }) {
  return (
    <section className={`card ${className}`.trim()} style={style}>
      <div className={pad ? "card-pad" : undefined}>
        {title ? (
          <div className="card-head" style={actions ? { justifyContent: "space-between" } : undefined}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
              {icon ? <span className="card-icon">{icon}</span> : null}
              <h2>{title}</h2>
            </div>
            {actions ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{actions}</div> : null}
          </div>
        ) : null}
        {sub ? <p className="sub">{sub}</p> : null}
        {children}
      </div>
    </section>
  );
}
