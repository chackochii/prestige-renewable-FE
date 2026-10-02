// A time picked from a list rather than typed.
//
// The native time input means three separate spin fields on a desktop browser
// and a different widget in every one of them. A plain dropdown of quarter
// hours is one scroll and reads the same everywhere — and these are scheduling
// slots, not stopwatch readings, so the minute between 14:30 and 14:31 is not
// worth the extra fiddling.
//
// A value that is not on the list (something already stored at 14:07, say) is
// added so it still shows and is not silently rounded away.

const STEP_MINUTES = 15;

const label = (minutes) => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  const suffix = h < 12 ? "am" : "pm";
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${suffix}`;
};

const value24 = (minutes) =>
  `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;

const SLOTS = Array.from({ length: (24 * 60) / STEP_MINUTES }, (_, i) => {
  const minutes = i * STEP_MINUTES;
  return { value: value24(minutes), label: label(minutes) };
});

export default function TimeSelect({ value = "", onChange, disabled = false, placeholder = "Select a time", id }) {
  const current = value ? value.slice(0, 5) : "";
  const known = SLOTS.some((slot) => slot.value === current);
  const options = known || !current ? SLOTS : [{ value: current, label: current }, ...SLOTS];

  return (
    <select id={id} value={current} disabled={disabled} onChange={(e) => onChange?.(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((slot) => (
        <option key={slot.value} value={slot.value}>
          {slot.label}
        </option>
      ))}
    </select>
  );
}
