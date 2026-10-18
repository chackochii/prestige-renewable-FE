// DNSP networks — the list behind the DNSP application's "Correct DNSP or
// network identified" item. Any signed-in user reads it; only ADM changes it.

import { apiClient, unwrap } from "./client";

/** Every network, active and inactive: [{ id, name, state, isActive, sortOrder }]. */
export async function listDnspNetworks() {
  return unwrap(await apiClient.get("/dnsp-networks"));
}

/** Superadmin only. body: { name, state?, isActive?, sortOrder? } */
export async function createDnspNetwork(body) {
  return unwrap(await apiClient.post("/dnsp-networks", body));
}

/** Superadmin only. body: any of { name, state, isActive, sortOrder } */
export async function updateDnspNetwork(id, body) {
  return unwrap(await apiClient.patch(`/dnsp-networks/${id}`, body));
}

/** Superadmin only. */
export async function deleteDnspNetwork(id) {
  await apiClient.delete(`/dnsp-networks/${id}`);
}
