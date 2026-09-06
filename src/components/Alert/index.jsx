// Inline alert. tone: info | warning | danger | success

export default function Alert({ tone = "info", children, style, className = "" }) {
  return (
    <div className={`alert ${tone} ${className}`.trim()} style={style} role={tone === "danger" ? "alert" : undefined}>
      {children}
    </div>
  );
}
