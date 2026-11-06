// Lead connections: the ad accounts a business unit takes leads from
// (Administration → Lead connections). Guarded server-side by admin.*.

import { apiClient, unwrap } from "./client";

/** → { webhookUrls: { meta_ads, google_ads }, meta: { appSecretSet, verifyToken, tokensSealed } } */
export async function getIntegrationSetup() {
  return unwrap(await apiClient.get("/integrations/setup"));
}

/** params: { businessUnitId } → [connection] */
export async function listConnections(params) {
  return unwrap(await apiClient.get("/integrations/connections", { params }));
}

/** body: { businessUnitId, platform, name, externalAccountId?, credentials?: { pageAccessToken }, config?: { fieldMap }, autoConvert?, isActive? } */
export async function createConnection(body) {
  return unwrap(await apiClient.post("/integrations/connections", body));
}

/** body: any of name, externalAccountId, credentials, config, autoConvert, isActive */
export async function updateConnection(id, body) {
  return unwrap(await apiClient.patch(`/integrations/connections/${id}`, body));
}

export async function deleteConnection(id) {
  await apiClient.delete(`/integrations/connections/${id}`);
}

/** Google Ads: a new key; the old one stops working at once. */
export async function rotateConnectionSecret(id) {
  return unwrap(
    await apiClient.post(`/integrations/connections/${id}/rotate-secret`),
  );
}

/** Meta: { ok, page, forms } · Google: { ok, webhookUrl, hint } */
export async function testConnection(id) {
  return unwrap(await apiClient.post(`/integrations/connections/${id}/test`));
}

/** Meta: pull leads since the last poll → { forms, fetched, created, converted } */
export async function syncConnection(id) {
  return unwrap(await apiClient.post(`/integrations/connections/${id}/sync`));
}
