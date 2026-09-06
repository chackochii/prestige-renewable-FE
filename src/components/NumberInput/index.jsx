// Numeric input that keeps "" for empty and strips leading zeros.

export default function NumberInput({ value, onChange, disabled, step, min, max, placeholder = "0", id }) {
  const empty = value === "" || value === null || value === undefined;
  return (
    <input
      id={id}
      type="number"
      inputMode="decimal"
      step={step}
      min={min}
      max={max}
      disabled={disabled}
      placeholder={placeholder}
      value={empty ? "" : value}
      onChange={(e) => {
        let next = e.target.value;
        if (next === "") {
          onChange("");
          return;
        }
        if (/^0\d+/.test(next)) next = String(Number(next));
        const n = Number(next);
        onChange(Number.isNaN(n) ? "" : n);
      }}
    />
  );
}
