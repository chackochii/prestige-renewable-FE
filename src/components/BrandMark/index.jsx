// The Prestige Renewable mark (public/icon.svg), used wherever the brand shows.

const ICON_URL = "/icon.svg";

export default function BrandMark({ size = 36, className = "" }) {
  return (
    <img
      src={ICON_URL}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size, borderRadius: size * 0.3, display: "block", flexShrink: 0 }}
    />
  );
}
