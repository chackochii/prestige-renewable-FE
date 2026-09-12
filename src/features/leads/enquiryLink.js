// The public enquiry form's URL. Built from the browser's own origin so it is
// correct in dev and in every deployment without extra configuration, unless
// the site is served from a different host than the app, in which case set
// VITE_PUBLIC_SITE_URL.

export const ENQUIRY_PATH = "/enquiry";

const origin = () => {
  const configured = import.meta.env.VITE_PUBLIC_SITE_URL;
  if (configured) return String(configured).replace(/\/+$/, "");
  return typeof window !== "undefined" ? window.location.origin : "";
};

/**
 * @param {string} [unitCode] business unit code (PRS, PCC, …). When given, the
 *   form is locked to that unit; when omitted, visitors pick from a dropdown.
 */
export function enquiryLink(unitCode) {
  const base = `${origin()}${ENQUIRY_PATH}`;
  return unitCode ? `${base}?unit=${encodeURIComponent(unitCode)}` : base;
}
