// Initials avatar with a hue derived from the name.

import { hueStyle, initials } from "@/utils/text";

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
