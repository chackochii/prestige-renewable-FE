// Centered empty state with icon, title, body and optional action.

import { Inbox } from "lucide-react";

export default function EmptyState({ title, body, action, icon }) {
  return (
    <div className="empty">
      <div style={{ color: "var(--muted)", marginBottom: 10, display: "flex", justifyContent: "center" }}>
        {icon || <Inbox size={28} strokeWidth={1.5} />}
      </div>
      <h3>{title}</h3>
      {body ? <p>{body}</p> : null}
      {action}
    </div>
  );
}
