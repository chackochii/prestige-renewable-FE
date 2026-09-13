// employee slice: staff accounts (people pickers + the admin users screen).

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as api from "@/services/api/usersApi";
import { logout } from "./authSlice";

const initialState = {
  items: [],
  total: 0,
  query: null,
  status: "idle",
  error: null,
  // Names-only directory of the current unit, for pickers (see useUnitUsers).
  directory: { items: [], unitId: null, status: "idle", error: null },
};

const reject = (err, rejectWithValue) => rejectWithValue(err.message);

export const fetchDirectory = createAsyncThunk("employee/fetchDirectory", async (unitId, { rejectWithValue }) => {
  try {
    return { items: await api.listDirectory(unitId), unitId };
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const fetchUsers = createAsyncThunk("employee/fetchAll", async (params = {}, { rejectWithValue }) => {
  try {
    const result = await api.listUsers({ pageSize: 100, ...params });
    return { ...result, query: params };
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const createUser = createAsyncThunk("employee/create", async (body, { rejectWithValue }) => {
  try {
    return await api.createUser(body);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const updateUser = createAsyncThunk(
  "employee/update",
  async ({ id, body, password }, { rejectWithValue }) => {
    try {
      const user = await api.updateUser(id, body);
      if (password) await api.resetUserPassword(id, password);
      return user;
    } catch (err) {
      return reject(err, rejectWithValue);
    }
  },
);

export const deleteUser = createAsyncThunk("employee/delete", async (id, { rejectWithValue }) => {
  try {
    await api.deleteUser(id);
    return id;
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

const upsert = (state, user) => {
  const idx = state.items.findIndex((u) => u.id === user.id);
  if (idx === -1) {
    state.items.push(user);
    state.total += 1;
  } else state.items[idx] = user;
  state.items.sort((a, b) => a.name.localeCompare(b.name));
};

/**
 * The directory (see fetchDirectory below) is cached per unit and only
 * fetched once — useUnitUsers() re-fetches whenever it sees an unloaded
 * unitId. Resetting it here after any create/update/delete is what makes
 * that guard trigger a fresh fetch, so a deleted or edited user doesn't
 * keep showing up (and failing to submit) in the lead-form pickers.
 */
const invalidateDirectory = (state) => {
  state.directory = { items: [], unitId: null, status: "idle", error: null };
};

const employeeSlice = createSlice({
  name: "employee",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsers.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchUsers.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.items = action.payload.items;
        state.total = action.payload.total;
        state.query = action.payload.query;
      })
      .addCase(fetchUsers.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })
      .addCase(fetchDirectory.pending, (state, action) => {
        state.directory.status = "loading";
        state.directory.error = null;
        state.directory.unitId = action.meta.arg;
      })
      .addCase(fetchDirectory.fulfilled, (state, action) => {
        state.directory.status = "succeeded";
        state.directory.items = action.payload.items;
        state.directory.unitId = action.payload.unitId;
      })
      .addCase(fetchDirectory.rejected, (state, action) => {
        // Keep unitId so the hook does not retry in a loop; the unit change resets it.
        state.directory.status = "failed";
        state.directory.error = action.payload;
        state.directory.unitId = action.meta.arg;
      })
      .addCase(createUser.fulfilled, (state, action) => {
        upsert(state, action.payload);
        invalidateDirectory(state);
      })
      .addCase(updateUser.fulfilled, (state, action) => {
        upsert(state, action.payload);
        invalidateDirectory(state);
      })
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.items = state.items.filter((u) => u.id !== action.payload);
        state.total = Math.max(0, state.total - 1);
        invalidateDirectory(state);
      })
      .addCase(logout, () => initialState);
  },
});

export default employeeSlice.reducer;
