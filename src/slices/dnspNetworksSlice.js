// DNSP networks — fetched once and cached like other shared reference data
// (the catalog). The approvals checklist reads the active ones; the
// superadmin screen maintains the list.

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as api from "@/services/api/dnspNetworksApi";
import { logout } from "./authSlice";

const reject = (err, rejectWithValue) => rejectWithValue(err.message);

export const fetchDnspNetworks = createAsyncThunk("dnspNetworks/fetch", async (_, { rejectWithValue }) => {
  try {
    return await api.listDnspNetworks();
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const createDnspNetwork = createAsyncThunk("dnspNetworks/create", async (body, { rejectWithValue }) => {
  try {
    return await api.createDnspNetwork(body);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const updateDnspNetwork = createAsyncThunk("dnspNetworks/update", async ({ id, body }, { rejectWithValue }) => {
  try {
    return await api.updateDnspNetwork(id, body);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const removeDnspNetwork = createAsyncThunk("dnspNetworks/remove", async (id, { rejectWithValue }) => {
  try {
    await api.deleteDnspNetwork(id);
    return id;
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

const byOrder = (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);

const upsert = (state, network) => {
  const idx = state.items.findIndex((n) => n.id === network.id);
  if (idx === -1) state.items.push(network);
  else state.items[idx] = network;
  state.items.sort(byOrder);
};

const initialState = {
  items: [],
  status: "idle",
  error: null,
};

const dnspNetworksSlice = createSlice({
  name: "dnspNetworks",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchDnspNetworks.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchDnspNetworks.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.items = action.payload || [];
      })
      .addCase(fetchDnspNetworks.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })
      .addCase(createDnspNetwork.fulfilled, (state, action) => upsert(state, action.payload))
      .addCase(updateDnspNetwork.fulfilled, (state, action) => upsert(state, action.payload))
      .addCase(removeDnspNetwork.fulfilled, (state, action) => {
        state.items = state.items.filter((n) => n.id !== action.payload);
      })
      .addCase(logout, () => initialState);
  },
});

export default dnspNetworksSlice.reducer;
