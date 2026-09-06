// Users (staff accounts). Reads and writes are scoped by the API: ADM works on
// everyone, other admin.* holders only inside their own business units.

import { apiClient, unwrap, unwrapList } from "./client";

export async function listUsers(params = {}) {
  return unwrapList(await apiClient.get("/users", { params }));
}

export async function getUser(id) {
  return unwrap(await apiClient.get(`/users/${id}`));
}

/** body: { name, email, password, roles, title?, phone?, status?, businessUnitIds?, referrerId? } */
export async function createUser(body) {
  return unwrap(await apiClient.post("/users", body));
}

export async function updateUser(id, body) {
  return unwrap(await apiClient.patch(`/users/${id}`, body));
}

export async function resetUserPassword(id, password) {
  await apiClient.patch(`/users/${id}/password`, { password });
}

export async function deleteUser(id) {
  await apiClient.delete(`/users/${id}`);
}
