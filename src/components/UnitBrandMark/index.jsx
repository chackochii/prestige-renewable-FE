// Per-business-unit "logo": no real per-unit logo asset exists in the API,
// so this is a colored badge generated from the unit's own code/name —
// same hue every time for that unit, swaps the moment the active unit
// changes. Falls back to the generic BrandMark icon when there's no unit
// yet (public pages, or before one is chosen).

import BrandMark from "@/components/BrandMark";
import { hueStyle } from "@/utils/text";

export default function UnitBrandMark({ unit, size = 36 }) {
  if (!unit) return <BrandMark size={size} />;
  const label = (unit.code || unit.name || "?").slice(0, 4).toUpperCase();
  return (
    <span
      aria-hidden="true"
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        borderRadius: size * 0.3,
        fontWeight: 700,
        fontSize: size * 0.3,
        flexShrink: 0,
        ...hueStyle(unit.code || unit.name),
      }}
    >
      {label}
    </span>
  );
}
