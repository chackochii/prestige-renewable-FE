// referrals slice: referrer directory used for lead attribution.

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as api from "@/services/api/referrersApi";
import { logout } from "./authSlice";

const initialState = {
  items: [],
  status: "idle",
  error: null,
};

export const fetchReferrers = createAsyncThunk("referrals/fetchAll", async (params, { rejectWithValue }) => {
  try {
    return await api.listReferrers(params);
  } catch (err) {
    return rejectWithValue(err.message);
  }
});

const referralsSlice = createSlice({
  name: "referrals",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchReferrers.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchReferrers.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.items = action.payload;
      })
      .addCase(fetchReferrers.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })
      .addCase(logout, () => initialState);
  },
});

export default referralsSlice.reducer;
