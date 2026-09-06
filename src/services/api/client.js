// Shared axios instance for prestige-be.
//
// Every response from the API is { success, data?, message?, errors? }. The
// helpers below unwrap that envelope and turn failures into Error objects with
// a readable message, a `status` and the field `errors` list when present.
//
// Session handling is centralised here: a 401 ends the session everywhere
// (see setUnauthorizedHandler), a 403 gets a human message and lets the app
// resync the user's permissions (see setForbiddenHandler).

import axios from "axios";
import { getToken, isTokenExpired } from "./tokenStore";

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL ?? "/api",
  headers: { "Content-Type": "application/json" },
  timeout: 30000,
});

let unauthorizedHandler = null;
let forbiddenHandler = null;

/** Registered by the store: called when the API rejects the session (401). */
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

/** Registered by the store: called on every 403 with the (already shaped) error. */
export function setForbiddenHandler(handler) {
  forbiddenHandler = handler;
}

const isLoginRequest = (config) => String(config?.url || "").endsWith("/users/login");

apiClient.interceptors.request.use((config) => {
  const token = getToken();
  if (token) {
    // Don't send a token we already know is dead — end the session instead
    // of waiting for the round-trip to fail.
    if (isTokenExpired(token) && !isLoginRequest(config)) {
      unauthorizedHandler?.({ reason: "expired" });
      const err = new Error("Your session has expired. Sign in again to continue.");
      err.isApiError = true;
      err.status = 401;
      err.errors = null;
      return Promise.reject(err);
    }
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const apiError = toApiError(error);
    if (status === 401 && !isLoginRequest(error.config)) unauthorizedHandler?.({ reason: "unauthorized" });
    if (status === 403) forbiddenHandler?.(apiError, error.config);
    return Promise.reject(apiError);
  },
);

const MISSING_PERMISSION_RE = /^Missing permission:\s*(\S+)/i;

export function toApiError(error) {
  if (error?.isApiError) return error;
  const status = error?.response?.status ?? null;
  const body = error?.response?.data;
  let message = body?.message;
  if (!message) {
    if (error?.code === "ECONNABORTED") message = "The request timed out. Please try again.";
    else if (!error?.response) message = "Cannot reach the server. Check your connection and try again.";
    else message = error.message || "Something went wrong.";
  }
  let permission = null;
  if (status === 403) {
    const match = MISSING_PERMISSION_RE.exec(message);
    permission = match ? match[1] : null;
    message = permission
      ? `You don't have permission for this action (needs ${permission}).`
      : message || "You don't have permission to do that.";
  }
  if (status === 401 && !message) message = "Your session is no longer valid. Sign in again.";
  const apiError = new Error(message);
  apiError.isApiError = true;
  apiError.status = status;
  apiError.permission = permission;
  apiError.errors = Array.isArray(body?.errors) ? body.errors : null;
  return apiError;
}

export function getErrorMessage(error, fallback = "Something went wrong.") {
  if (!error) return fallback;
  if (typeof error === "string") return error;
  return error.message || fallback;
}

/** Unwraps { success, data } → data. */
export const unwrap = (response) => response.data?.data;

/** Unwraps a paginated list { success, data, total, page, pageSize }. */
export const unwrapList = (response) => {
  const { data = [], total = 0, page = 1, pageSize = data.length } = response.data || {};
  return { items: data, total, page, pageSize };
};
