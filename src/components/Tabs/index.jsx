// Underline tabs. items: [{ key, label, icon?, count? }]
//
// Switching tab — by a click, or by a form moving on after Save — brings the
// tab bar back into view, so the new tab is read from its top rather than
// from wherever the page was scrolled to on the last one.

import { useEffect, useRef } from "react";

// Room for the sticky top bar above the tabs.
const TOP_OFFSET = 88;

export default function Tabs({ items, value, onChange }) {
  const ref = useRef(null);
  const shown = useRef(value);

  useEffect(() => {
    if (shown.current === value) return;
    shown.current = value;
    const bar = ref.current;
    if (!bar) return;
    const top = bar.getBoundingClientRect().top;
    if (top < TOP_OFFSET || top > window.innerHeight * 0.5) {
      window.scrollTo({ top: Math.max(0, window.scrollY + top - TOP_OFFSET), behavior: "smooth" });
    }
  }, [value]);

  return (
    <div className="tabs" role="tablist" ref={ref}>
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
