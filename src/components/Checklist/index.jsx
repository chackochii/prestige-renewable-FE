// Ordered checklist: each item shown in sequence, ticked once done.

import { Check, Circle } from "lucide-react";

export default function Checklist({ items = [] }) {
  return (
    <div className="list-stack">
      {items.map((item, i) => (
        <div key={item.key} className="list-row">
          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            <span className={`status-icon ${item.done ? "done" : "pending"}`}>
              {item.done ? <Check size={16} /> : <Circle size={16} />}
            </span>
            <span className="row-title">
              {i + 1}. {item.label}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}
