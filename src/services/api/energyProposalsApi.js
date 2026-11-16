// Commercial Solar + BESS (+ EV) proposals on a job. The AI drafts the
// calculator's input from the job's bills to the admin's skill; the API works
// out every figure; the PDF is built in the browser (helpers/energyProposalPdf.js).

import { apiClient, unwrap } from "./client";

// Drafting reads bills and makes two AI calls — give it longer than the default.
const AI_TIMEOUT = 180000;

const base = (oppId) => `/opportunities/${oppId}/energy-proposals`;

/** { skill, settings, aiConfigured, bills: [{ id, name, readable }], jobInput } */
export async function getProposalOptions(oppId) {
  return unwrap(await apiClient.get(`${base(oppId)}/options`));
}

export async function listEnergyProposals(oppId) {
  return unwrap(await apiClient.get(base(oppId)));
}

export async function getEnergyProposal(oppId, proposalId) {
  return unwrap(await apiClient.get(`${base(oppId)}/${proposalId}`));
}

/** body: { input?, title? } — a blank draft from the job. */
export async function createEnergyProposal(oppId, body = {}) {
  return unwrap(await apiClient.post(base(oppId), body));
}

/** body: { instructions?, documentIds?, proposalId? } */
export async function draftEnergyProposalWithAi(oppId, body) {
  return unwrap(await apiClient.post(`${base(oppId)}/ai-draft`, body, { timeout: AI_TIMEOUT }));
}

/** body: { input } → { input, result } — nothing saved. */
export async function previewEnergyProposal(oppId, body) {
  return unwrap(await apiClient.post(`${base(oppId)}/calculate`, body));
}

/** body: { input?, narrative?, title?, number?, preparedOn?, validUntil? } */
export async function updateEnergyProposal(oppId, proposalId, body) {
  return unwrap(await apiClient.patch(`${base(oppId)}/${proposalId}`, body));
}

export async function rewriteEnergyProposalText(oppId, proposalId, body = {}) {
  return unwrap(await apiClient.post(`${base(oppId)}/${proposalId}/narrative/ai`, body, { timeout: AI_TIMEOUT }));
}

export async function finaliseEnergyProposal(oppId, proposalId) {
  return unwrap(await apiClient.post(`${base(oppId)}/${proposalId}/finalise`));
}

export async function reviseEnergyProposal(oppId, proposalId) {
  return unwrap(await apiClient.post(`${base(oppId)}/${proposalId}/revise`));
}

/** Files the PDF (a Blob) on the job's documents. */
export async function saveEnergyProposalPdf(oppId, proposalId, blob, filename) {
  const form = new FormData();
  form.append("file", new File([blob], filename, { type: "application/pdf" }));
  return unwrap(await apiClient.post(`${base(oppId)}/${proposalId}/pdf`, form, { headers: { "Content-Type": "multipart/form-data" }, timeout: 60000 }));
}

export async function deleteEnergyProposal(oppId, proposalId) {
  await apiClient.delete(`${base(oppId)}/${proposalId}`);
}
