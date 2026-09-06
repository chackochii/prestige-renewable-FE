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
};

const reject = (err, rejectWithValue) => rejectWithValue(err.message);

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
      .addCase(createUser.fulfilled, (state, action) => upsert(state, action.payload))
      .addCase(updateUser.fulfilled, (state, action) => upsert(state, action.payload))
      .addCase(deleteUser.fulfilled, (state, action) => {
        state.items = state.items.filter((u) => u.id !== action.payload);
        state.total = Math.max(0, state.total - 1);
      })
      .addCase(logout, () => initialState);
  },
});

export default employeeSlice.reducer;
