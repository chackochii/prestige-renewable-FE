// Initials avatar with a hue derived from the name.

import { initials } from "@/utils/text";

const HUES = [355, 24, 42, 160, 190, 220, 265, 320];

function hueStyle(name) {
  const text = String(name || "");
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  const hue = HUES[hash % HUES.length];
  return { background: `hsl(${hue} 85% 95%)`, color: `hsl(${hue} 55% 38%)` };
}

export default function Avatar({ name, size = 34 }) {
  return (
    <span
      className="row-avatar"
      style={{ width: size, height: size, fontSize: size * 0.36, ...hueStyle(name) }}
      aria-hidden="true"
    >
      {initials(name) || "?"}
    </span>
  );
}
