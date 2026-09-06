// Roles and the permission catalog. Everything here is runtime data.

import { apiClient, unwrap } from "./client";

export async function listRoles() {
  return unwrap(await apiClient.get("/roles"));
}

export async function listPermissions() {
  return unwrap(await apiClient.get("/roles/permissions"));
}

/** body: { code, name, description?, inheritsFrom?, permissionCodes? } */
export async function createRole(body) {
  return unwrap(await apiClient.post("/roles", body));
}

/** body: { name?, description?, isActive?, inheritsFrom? } */
export async function updateRole(code, body) {
  return unwrap(await apiClient.patch(`/roles/${code}`, body));
}

export async function deleteRole(code) {
  await apiClient.delete(`/roles/${code}`);
}

/** Replaces the role's own grants with the given permission codes. */
export async function setRolePermissions(code, permissionCodes) {
  return unwrap(await apiClient.put(`/roles/${code}/permissions`, { permissionCodes }));
}

/** body: { code, name, category? } */
export async function createPermission(body) {
  return unwrap(await apiClient.post("/roles/permissions", body));
}

export async function updatePermission(code, body) {
  return unwrap(await apiClient.patch(`/roles/permissions/${code}`, body));
}

export async function deletePermission(code) {
  await apiClient.delete(`/roles/permissions/${code}`);
}
