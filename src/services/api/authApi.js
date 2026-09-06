// Authentication: login issues a JWT; /me returns the user with their
// effective permission codes and business units.

import { apiClient, unwrap } from "./client";

export async function login(email, password) {
  const response = await apiClient.post("/users/login", { email, password });
  const { token, user } = response.data || {};
  return { token, user };
}

export async function me() {
  return unwrap(await apiClient.get("/users/me"));
}
