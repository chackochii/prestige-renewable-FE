// approvals slice

import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  items: [],
  selectedId: null,
  status: "idle",
  error: null,
};

const approvalsSlice = createSlice({
  name: "approvals",
  initialState,
  reducers: {
    setLoading(state) {
      state.status = "loading";
      state.error = null;
    },
    setItems(state, action) {
      state.items = action.payload;
      state.status = "succeeded";
    },
    upsertItem(state, action) {
      const idx = state.items.findIndex((i) => i.id === action.payload.id);
      if (idx === -1) state.items.push(action.payload);
      else state.items[idx] = action.payload;
    },
    select(state, action) {
      state.selectedId = action.payload;
    },
    setError(state, action) {
      state.status = "failed";
      state.error = action.payload;
    },
  },
});

export const approvalsActions = approvalsSlice.actions;
export default approvalsSlice.reducer;
