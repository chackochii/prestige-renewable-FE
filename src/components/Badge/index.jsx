// Pill badge. tone: success | warning | danger | info | neutral | gold

export default function Badge({ tone = "neutral", children, className = "", title }) {
  return (
    <span className={`badge ${tone} ${className}`.trim()} title={title}>
      {children}
    </span>
  );
}
