// Referrer directory (id, organisation, contact, status) for attribution.

import { apiClient, unwrap } from "./client";

/** params: { status?: "active" | "inactive" | "all" } */
export async function listReferrers(params = {}) {
  return unwrap(await apiClient.get("/referrers", { params }));
}
