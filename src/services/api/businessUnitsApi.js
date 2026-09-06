// Business units. The list is scoped to the caller's assigned units (ADM sees
// all) and each unit carries `disabledPages` for the sidebar filter.

import { apiClient, unwrap } from "./client";

export async function listBusinessUnits() {
  return unwrap(await apiClient.get("/business-units"));
}

export async function getBusinessUnit(id) {
  return unwrap(await apiClient.get(`/business-units/${id}`));
}

/** Superadmin only. body: { code, name, legalName?, timezone?, status?, ...config } */
export async function createBusinessUnit(body) {
  return unwrap(await apiClient.post("/business-units", body));
}

/** Superadmin only. body: { name?, legalName?, timezone?, status? } */
export async function updateBusinessUnit(id, body) {
  return unwrap(await apiClient.patch(`/business-units/${id}`, body));
}

export async function deleteBusinessUnit(id) {
  await apiClient.delete(`/business-units/${id}`);
}

export async function getBusinessUnitConfig(id) {
  return unwrap(await apiClient.get(`/business-units/${id}/config`));
}

/** body: any of billingSplit, commissionTiers, approvalTypes, siteWorkSubstages, enabledStages, slaDays, marginFloor, metadata */
export async function updateBusinessUnitConfig(id, body) {
  return unwrap(await apiClient.patch(`/business-units/${id}/config`, body));
}
