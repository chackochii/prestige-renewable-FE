// Product catalog (items, brands, unit prices) for the quote builder.

import { apiClient, unwrap } from "./client";

/** Every catalog item: { key, name, unit, brands: [{ name, unitPrice }] }, AUD ex GST. */
export async function listCatalogItems() {
  return unwrap(await apiClient.get("/catalog"));
}
