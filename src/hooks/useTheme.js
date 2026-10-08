// Light / dark theme. The preference is stored per browser; with none stored
// the system setting applies. index.html applies the stored value before the
// first paint so there is no flash.
//
// Switching is animated: a soft crossfade of the whole page from one theme to
// the other in 0.3s. Where the browser has View Transitions (Chrome, Edge,
// Safari 18+) that is the browser's own crossfade of the two snapshots,
// timed in index.css; elsewhere every colour fades across for the same time.
// Both are skipped for people who ask their system for reduced motion.

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";

const STORAGE_KEY = "prestige.theme";
const SWITCH_MS = 300; // matches the theme-crossfade timing in index.css

let running = null; // the view transition under way, so a quick second click cleans up after the right one

const prefersReducedMotion = () => Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)").matches);

/**
 * Runs `change` (which switches the theme) as a transition. The View
 * Transitions API snapshots the page as it is, `change` runs, and the two
 * snapshots crossfade, timed by the `theme-crossfade` class on <html>
 * (index.css); `flushSync` makes React render the switch (the sun/moon icon)
 * inside that callback so it is in the new snapshot. Without the API, the
 * `theme-fading` class gives every element a brief colour transition.
 */
function animateThemeChange(change) {
  const root = document.documentElement;
  if (prefersReducedMotion()) return change();

  if (typeof document.startViewTransition === "function") {
    root.classList.add("theme-crossfade");
    const transition = document.startViewTransition(() => flushSync(change));
    running = transition;
    transition.ready.catch(() => {
      // Skipped (a second click straight after): the theme still changed.
    });
    transition.finished.finally(() => {
      if (running === transition) {
        root.classList.remove("theme-crossfade");
        running = null;
      }
    });
    return undefined;
  }

  root.classList.add("theme-fading");
  change();
  window.setTimeout(() => root.classList.remove("theme-fading"), SWITCH_MS);
  return undefined;
}

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
  // The theme last asked for. The switch itself lands a frame later (inside
  // the transition), so a second click straight after the first must toggle
  // from what was asked for, not from what is still on screen — or both
  // clicks pick the same theme.
  const requested = useRef(null);

  const setTheme = useCallback((next) => {
    requested.current = next ?? systemTheme();
    try {
      if (next) localStorage.setItem(STORAGE_KEY, next);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // Storage unavailable: the choice lasts for this page only.
    }
    // Applied here as well as by the effect, so the colours change inside the
    // transition rather than a render later.
    animateThemeChange(() => {
      applyTheme(next);
      setStored(next);
    });
  }, []);

  const toggle = useCallback(() => setTheme((requested.current ?? theme) === "dark" ? "light" : "dark"), [theme, setTheme]);

  return { theme, isDark: theme === "dark", followsSystem: stored === null, setTheme, toggle };
}
