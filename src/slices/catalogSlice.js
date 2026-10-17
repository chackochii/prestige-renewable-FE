// Product catalog for the quote builder — fetched once and cached, same as
// other shared reference data (referrals, the unit directory). `manage` holds
// the superadmin screen's list (retired items too); a change there sends the
// quote builder's copy back to "idle" so it is fetched again.

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as api from "@/services/api/catalogApi";
import { logout } from "./authSlice";

const reject = (err, rejectWithValue) => rejectWithValue(err.message);

export const fetchCatalog = createAsyncThunk("catalog/fetch", async (_, { rejectWithValue }) => {
  try {
    return await api.listCatalogItems();
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const fetchManagedCatalog = createAsyncThunk("catalog/fetchManaged", async (_, { rejectWithValue }) => {
  try {
    return await api.listManagedCatalogItems();
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const createCatalogItem = createAsyncThunk("catalog/create", async (body, { rejectWithValue }) => {
  try {
    return await api.createCatalogItem(body);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const updateCatalogItem = createAsyncThunk("catalog/update", async ({ id, body }, { rejectWithValue }) => {
  try {
    return await api.updateCatalogItem(id, body);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const removeCatalogItem = createAsyncThunk("catalog/remove", async (id, { rejectWithValue }) => {
  try {
    await api.deleteCatalogItem(id);
    return id;
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

const byOrder = (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);

const upsert = (state, item) => {
  const list = state.manage.items;
  const idx = list.findIndex((i) => i.id === item.id);
  if (idx === -1) list.push(item);
  else list[idx] = item;
  list.sort(byOrder);
};

// The quote builder's list is out of date after any change: fetch it again
// next time it is needed.
const staleQuoteList = (state) => {
  if (state.status !== "loading") state.status = "idle";
};

const initialState = {
  items: [],
  status: "idle",
  error: null,
  manage: { items: [], status: "idle", error: null },
};

const catalogSlice = createSlice({
  name: "catalog",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchCatalog.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchCatalog.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.items = action.payload || [];
      })
      .addCase(fetchCatalog.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })
      .addCase(fetchManagedCatalog.pending, (state) => {
        state.manage.status = "loading";
        state.manage.error = null;
      })
      .addCase(fetchManagedCatalog.fulfilled, (state, action) => {
        state.manage.status = "succeeded";
        state.manage.items = action.payload || [];
      })
      .addCase(fetchManagedCatalog.rejected, (state, action) => {
        state.manage.status = "failed";
        state.manage.error = action.payload;
      })
      .addCase(createCatalogItem.fulfilled, (state, action) => {
        upsert(state, action.payload);
        staleQuoteList(state);
      })
      .addCase(updateCatalogItem.fulfilled, (state, action) => {
        upsert(state, action.payload);
        staleQuoteList(state);
      })
      .addCase(removeCatalogItem.fulfilled, (state, action) => {
        state.manage.items = state.manage.items.filter((i) => i.id !== action.payload);
        staleQuoteList(state);
      })
      // The next person on this browser starts clean — and gets the catalog
      // asked for again, rather than inheriting a failed load that is never
      // retried (the quote builder only fetches from "idle").
      .addCase(logout, () => initialState);
  },
});

export default catalogSlice.reducer;
