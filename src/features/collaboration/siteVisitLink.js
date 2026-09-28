// The public site-visit form's URL, built the same way the enquiry link is:
// from the browser's own origin, so it is right in dev and in every deployment
// without extra configuration. Set VITE_PUBLIC_SITE_URL when the public site
// is served from a different host than the app.

export const SITE_VISIT_PATH = "/site-visit";

const origin = () => {
  const configured = import.meta.env.VITE_PUBLIC_SITE_URL;
  if (configured) return String(configured).replace(/\/+$/, "");
  return typeof window !== "undefined" ? window.location.origin : "";
};

/**
 * @param {string} token the site-visit task's token, from the API.
 * @returns {string} the link a coordinator hands to whoever is attending —
 *   they open it, say who they are, answer what was asked and upload photos,
 *   with no sign-in and no access to anything else.
 */
export function siteVisitLink(token) {
  if (!token) return "";
  return `${origin()}${SITE_VISIT_PATH}/${encodeURIComponent(token)}`;
}
