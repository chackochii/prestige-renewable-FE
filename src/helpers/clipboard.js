// Copy text to the clipboard. The async Clipboard API needs a secure context
// (https, or localhost in dev); on plain http it is missing entirely, so fall
// back to a hidden textarea + execCommand, which still works everywhere.

export async function copyText(text) {
  const value = String(text ?? "");
  if (!value) return false;

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return true;
    } catch {
      /* permission denied or non-secure context — try the fallback */
    }
  }

  try {
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "");
    // Keep it off-screen but focusable, and avoid scrolling the page on focus.
    textarea.style.cssText = "position:fixed;top:0;left:-9999px;opacity:0;";
    document.body.appendChild(textarea);
    textarea.select();
    const ok = document.execCommand("copy");
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}
