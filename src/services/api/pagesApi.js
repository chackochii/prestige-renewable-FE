// Page registry (drives the sidebar) and per-business-unit page toggles.

import { apiClient, unwrap } from "./client";

export async function listPages() {
  return unwrap(await apiClient.get("/pages"));
}

/** body: { code, label, path, sortOrder?, viewPermissionCode? } */
export async function createPage(body) {
  return unwrap(await apiClient.post("/pages", body));
}

export async function updatePage(code, body) {
  return unwrap(await apiClient.patch(`/pages/${code}`, body));
}

export async function deletePage(code) {
  await apiClient.delete(`/pages/${code}`);
}

/** → { id, code, name, pages: [{ code, label, path, sortOrder, viewPermissionCode, enabled }] } */
export async function getUnitPages(unitId) {
  return unwrap(await apiClient.get(`/business-units/${unitId}/pages`));
}

/** entries: [{ code, enabled }] — pages not mentioned keep their state. */
export async function setUnitPages(unitId, entries) {
  return unwrap(await apiClient.put(`/business-units/${unitId}/pages`, { pages: entries }));
}
