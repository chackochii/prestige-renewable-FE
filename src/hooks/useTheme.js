// Light / dark theme. The preference is stored per browser; with none stored
// the system setting applies. index.html applies the stored value before the
// first paint so there is no flash.

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "prestige.theme";

function readStored() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value === "dark" || value === "light" ? value : null;
  } catch {
    return null;
  }
}

function systemTheme() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function applyTheme(theme) {
  const root = document.documentElement;
  if (theme === "dark" || theme === "light") root.setAttribute("data-theme", theme);
  else root.removeAttribute("data-theme");
}

export function useTheme() {
  const [stored, setStored] = useState(readStored);
  const [system, setSystem] = useState(systemTheme);

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-color-scheme: dark)");
    if (!media) return undefined;
    const onChange = (e) => setSystem(e.matches ? "dark" : "light");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    applyTheme(stored);
  }, [stored]);

  const theme = stored ?? system;

  const setTheme = useCallback((next) => {
    try {
      if (next) localStorage.setItem(STORAGE_KEY, next);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage unavailable: the choice lasts for this page only.
    }
    setStored(next);
  }, []);

  const toggle = useCallback(() => setTheme(theme === "dark" ? "light" : "dark"), [theme, setTheme]);

  return { theme, isDark: theme === "dark", followsSystem: stored === null, setTheme, toggle };
}
