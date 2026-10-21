// A select you can type into: the field shows the chosen option, typing
// filters the list beneath it, and a click, or ↑ ↓ then Enter, picks one.
// `options` are [{ value, label }]; `onChange(value)` gets the chosen value.

import { useId, useState } from "react";

export default function SearchSelect({ id, value, options = [], onChange, placeholder = "Type to search…", disabled = false, emptyText = "No matches" }) {
  const listId = useId();
  const selected = options.find((option) => option.value === value) ?? null;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const term = query.trim().toLowerCase();
  const matches = term ? options.filter((option) => option.label.toLowerCase().includes(term)) : options;

  const choose = (option) => {
    onChange(option.value);
    setQuery("");
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) setOpen(true);
      setActive((i) => {
        const next = i + (e.key === "ArrowDown" ? 1 : -1);
        return Math.max(0, Math.min(matches.length - 1, next));
      });
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      if (matches[active]) choose(matches[active]);
    } else if (e.key === "Escape" && open) {
      e.stopPropagation();
      setOpen(false);
      setQuery("");
    }
  };

  return (
    <div className="search-select">
      <input
        id={id}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        autoComplete="off"
        disabled={disabled}
        placeholder={selected ? selected.label : placeholder}
        value={open ? query : (selected?.label ?? "")}
        onFocus={() => {
          setOpen(true);
          setActive(0);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onBlur={() => {
          setOpen(false);
          setQuery("");
        }}
        onKeyDown={onKeyDown}
      />
      {open && !disabled ? (
        <ul className="search-select-list" id={listId} role="listbox">
          {matches.length ? (
            matches.map((option, index) => (
              <li
                key={option.value}
                role="option"
                aria-selected={option.value === value}
                className={`${index === active ? "is-active" : ""}${option.value === value ? " is-selected" : ""}`.trim() || undefined}
                // mousedown, not click: it lands before the input's blur closes the list.
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(option);
                }}
                onMouseEnter={() => setActive(index)}
              >
                {option.label}
              </li>
            ))
          ) : (
            <li className="search-select-empty">{emptyText}</li>
          )}
        </ul>
      ) : null}
    </div>
  );
}
