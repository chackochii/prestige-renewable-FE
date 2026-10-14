// auth slice: signed-in user (with roles[] and permissions[]) + JWT.

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as authApi from "@/services/api/authApi";
import {
  clearSession,
  decodeTokenExpiry,
  isTokenExpired,
  loadSession,
  saveSession,
} from "@/services/api/tokenStore";

// Why the last session ended — the login page turns this into a message.
export const SESSION_NOTICES = {
  EXPIRED: "expired",
  UNAUTHORIZED: "unauthorized",
  SIGNED_OUT: "signed_out",
};

const persisted = loadSession();
// A token that already expired while the tab was closed is dropped up front.
const persistedValid = persisted?.token && !isTokenExpired(persisted.token);
if (persisted?.token && !persistedValid) clearSession();

const initialState = {
  user: persistedValid ? persisted.user ?? null : null,
  token: persistedValid ? persisted.token : null,
  expiresAt: persistedValid ? decodeTokenExpiry(persisted.token) : null,
  // A persisted token still needs a /me round-trip before the app trusts it.
  initialized: !persistedValid,
  status: "idle",
  error: null,
  notice: persisted?.token && !persistedValid ? SESSION_NOTICES.EXPIRED : null,
  // Set once the login page has displayed the notice, so the landing page
  // stops redirecting to sign-in for it.
  noticeSeen: false,
};

export const login = createAsyncThunk("auth/login", async ({ email, password }, { rejectWithValue }) => {
  try {
    const { token, user } = await authApi.login(email, password);
    saveSession({ token, user });
    return { token, user };
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

export const fetchMe = createAsyncThunk("auth/fetchMe", async (_, { rejectWithValue }) => {
  try {
    const user = await authApi.me();
    const session = loadSession();
    if (session) saveSession({ ...session, user });
    return user;
  } catch (err) {
    return rejectWithValue({ message: err.message, status: err.status ?? null });
  }
});

const clearState = (state, notice, { elsewhere = false } = {}) => {
  // Only this tab's own session — another tab may have signed in since. When
  // this tab is only following another tab's sign-out (`elsewhere`), storage
  // is that tab's business and is left alone: writing to it late could wipe
  // what the other tab saved since (a new sign-in, the unit just chosen).
  if (!elsewhere) clearSession(state.token);
  state.user = null;
  state.token = null;
  state.expiresAt = null;
  state.initialized = true;
  state.status = "idle";
  state.error = null;
  state.notice = notice ?? null;
  state.noticeSeen = false;
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    /**
     * payload (optional): { notice: SESSION_NOTICES.*, elsewhere } — elsewhere:
     * following another tab's change, so the stored session is not touched.
     */
    logout(state, action) {
      clearState(state, action.payload?.notice ?? SESSION_NOTICES.SIGNED_OUT, { elsewhere: Boolean(action.payload?.elsewhere) });
    },
    /**
     * The same person signed in again in another tab: this tab carries on
     * with that session (payload: { token, user }) instead of running out on
     * the old token.
     */
    adoptSession(state, action) {
      const { token, user } = action.payload ?? {};
      if (!token) return;
      state.token = token;
      state.user = user ?? state.user;
      state.expiresAt = decodeTokenExpiry(token);
      state.initialized = true;
      state.status = "succeeded";
      state.error = null;
      state.notice = null;
      state.noticeSeen = false;
    },
    clearAuthError(state) {
      state.error = null;
    },
    clearSessionNotice(state) {
      state.notice = null;
      state.noticeSeen = false;
    },
    markSessionNoticeSeen(state) {
      if (state.notice) state.noticeSeen = true;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(login.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload.user;
        state.token = action.payload.token;
        state.expiresAt = decodeTokenExpiry(action.payload.token);
        state.initialized = true;
        state.notice = null;
        state.noticeSeen = false;
      })
      .addCase(login.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload || action.error?.message || "Sign in failed.";
      })
      .addCase(fetchMe.pending, (state) => {
        state.status = "loading";
      })
      .addCase(fetchMe.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.user = action.payload;
        state.initialized = true;
      })
      .addCase(fetchMe.rejected, (state, action) => {
        state.status = "failed";
        state.initialized = true;
        // A 401 means the session is gone; network errors keep the cached user.
        if (action.payload?.status === 401) clearState(state, SESSION_NOTICES.UNAUTHORIZED);
        else state.error = action.payload?.message || null;
      });
  },
});

export const { logout, adoptSession, clearAuthError, clearSessionNotice, markSessionNoticeSeen } = authSlice.actions;
export default authSlice.reducer;
