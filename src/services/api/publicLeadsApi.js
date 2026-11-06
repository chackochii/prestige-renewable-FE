// Public (no sign-in) endpoint behind the website enquiry form. apiClient
// only attaches a bearer token when one exists, so this works signed out.

import { apiClient, unwrap } from "./client";

/**
 * body: { name, email, phone, siteLine1?, siteSuburb?, siteState?, sitePostcode?, message?, businessUnit? }
 * `businessUnit` is set by the link the sender followed (?unit=PRS), never
 * chosen by the visitor; without it the server files the lead into its
 * default unit.
 * → { number, businessUnit }
 */
export async function submitPublicLead(body) {
  return unwrap(await apiClient.post("/public/leads", body));
}

/**
 * Whose logo the enquiry page shows for its link. `unitCode` is the `?unit=`
 * on the link, if any — without it the server answers for its default unit.
 * → { businessUnit, brand: "prestige" | "sydpro" }
 */
export async function getPublicLeadBrand(unitCode) {
  const query = unitCode ? `?unit=${encodeURIComponent(unitCode)}` : "";
  return unwrap(await apiClient.get(`/public/leads/brand${query}`));
}
