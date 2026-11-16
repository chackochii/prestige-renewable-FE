// Authentication: login issues a JWT; /me returns the user with their
// effective permission codes and business units.
//
// A first sign-in with the temporary password an administrator set answers
// with mustChangePassword and a set-up token that only opens
// POST /users/me/password — setFirstPassword uses it to set the person's own
// password and gets the real session token back.

import { apiClient, unwrap } from "./client";

/** → { token, user, mustChangePassword } — with mustChangePassword the token is the set-up token, not a session. */
export async function login(email, password) {
  const response = await apiClient.post("/users/login", { email, password });
  const { token, user, mustChangePassword } = response.data || {};
  return { token, user, mustChangePassword: Boolean(mustChangePassword) };
}

/** The person's own password, with the set-up token from login → { token, user } (a full session). */
export async function setFirstPassword(setupToken, newPassword) {
  const response = await apiClient.post(
    "/users/me/password",
    { newPassword },
    { headers: { Authorization: `Bearer ${setupToken}` }, sessionless: true },
  );
  const { token, user } = response.data || {};
  return { token, user };
}

export async function me() {
  return unwrap(await apiClient.get("/users/me"));
}
