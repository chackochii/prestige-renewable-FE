// Underline tabs. items: [{ key, label, icon?, count? }]

export default function Tabs({ items, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {items.map((item) => (
        <button
          key={item.key}
          type="button"
          role="tab"
          aria-selected={value === item.key}
          className={value === item.key ? "active" : ""}
          onClick={() => onChange(item.key)}
        >
          {item.icon}
          {item.label}
          {item.count != null ? <span className="tab-count">{item.count}</span> : null}
        </button>
      ))}
    </div>
  );
}
