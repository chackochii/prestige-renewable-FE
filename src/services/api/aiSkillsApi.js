// AI skills (Admin → AI skills): the instructions, reference files and
// calculator settings the AI works to when it drafts an energy proposal.
// Reading needs admin.read or skills.manage; changing needs skills.manage.

import { apiClient, unwrap } from "./client";

/** [{ id, key, name, description, purpose, isActive, version, contentLength, references, settings, updatedBy, updatedAt }] */
export async function listSkills() {
  return unwrap(await apiClient.get("/ai-skills"));
}

/** One skill with its content, reference names, merged settings and the defaults. */
export async function getSkill(id) {
  return unwrap(await apiClient.get(`/ai-skills/${id}`));
}

/** body: { key, name, description?, content, settings? } — a new skill starts inactive. */
export async function createSkill(body) {
  return unwrap(await apiClient.post("/ai-skills", body));
}

/** body: any of { name, description, content, settings, isActive } + note */
export async function updateSkill(id, body) {
  return unwrap(await apiClient.patch(`/ai-skills/${id}`, body));
}

export async function resetSkillSettings(id) {
  return unwrap(await apiClient.post(`/ai-skills/${id}/settings/reset`));
}

/** target: "content" (replaces the instructions) | "reference" (adds or replaces a reference file). */
export async function uploadSkillFile(id, file, { target = "reference", note } = {}) {
  const form = new FormData();
  form.append("file", file);
  form.append("target", target);
  if (note) form.append("note", note);
  return unwrap(await apiClient.post(`/ai-skills/${id}/files`, form, { headers: { "Content-Type": "multipart/form-data" } }));
}

export async function getSkillReference(id, name) {
  return unwrap(await apiClient.get(`/ai-skills/${id}/references/${encodeURIComponent(name)}`));
}

export async function updateSkillReference(id, name, body) {
  return unwrap(await apiClient.put(`/ai-skills/${id}/references/${encodeURIComponent(name)}`, body));
}

export async function removeSkillReference(id, name) {
  return unwrap(await apiClient.delete(`/ai-skills/${id}/references/${encodeURIComponent(name)}`));
}

export async function listSkillVersions(id) {
  return unwrap(await apiClient.get(`/ai-skills/${id}/versions`));
}

export async function getSkillVersion(id, version) {
  return unwrap(await apiClient.get(`/ai-skills/${id}/versions/${version}`));
}

export async function restoreSkillVersion(id, version) {
  return unwrap(await apiClient.post(`/ai-skills/${id}/versions/${version}/restore`));
}
