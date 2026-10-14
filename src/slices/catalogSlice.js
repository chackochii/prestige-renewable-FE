// Product catalog for the quote builder — fetched once and cached, same as
// other shared reference data (referrals, the unit directory).

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as api from "@/services/api/catalogApi";
import { logout } from "./authSlice";

export const fetchCatalog = createAsyncThunk("catalog/fetch", async (_, { rejectWithValue }) => {
  try {
    return await api.listCatalogItems();
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

const initialState = {
  items: [],
  status: "idle",
  error: null,
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
      // The next person on this browser starts clean — and gets the catalog
      // asked for again, rather than inheriting a failed load that is never
      // retried (the quote builder only fetches from "idle").
      .addCase(logout, () => initialState);
  },
});

export default catalogSlice.reducer;
