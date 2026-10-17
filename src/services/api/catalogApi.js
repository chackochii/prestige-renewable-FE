// Product catalog (items, brands, unit prices) for the quote builder.

import { apiClient, unwrap } from "./client";

/** Every active catalog item: { key, name, unit, brands: [{ name, unitPrice }] }, AUD ex GST. */
export async function listCatalogItems() {
  return unwrap(await apiClient.get("/catalog"));
}

/** Superadmin only. Active and retired items: [{ id, key, name, unit, brands, isActive, sortOrder, isSystem }]. */
export async function listManagedCatalogItems() {
  return unwrap(await apiClient.get("/catalog/manage"));
}

/** Superadmin only. body: { name, unit?, brands: [{ name, unitPrice }], isActive?, sortOrder? } */
export async function createCatalogItem(body) {
  return unwrap(await apiClient.post("/catalog", body));
}

/** Superadmin only. body: any of { name, unit, brands, isActive, sortOrder } */
export async function updateCatalogItem(id, body) {
  return unwrap(await apiClient.patch(`/catalog/${id}`, body));
}

/** Superadmin only. */
export async function deleteCatalogItem(id) {
  await apiClient.delete(`/catalog/${id}`);
}
