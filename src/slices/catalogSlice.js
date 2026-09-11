// Product catalog for the quote builder — fetched once and cached, same as
// other shared reference data (referrals, the unit directory).

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as api from "@/services/api/catalogApi";

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
      });
  },
});

export default catalogSlice.reducer;
