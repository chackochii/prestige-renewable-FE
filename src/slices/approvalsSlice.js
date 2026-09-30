// Approvals (stage 5). `checklists` holds each job's CL-07 / CL-08 / CL-09 /
// CL-10 answers by job id — in memory only until the approvals service is
// connected, when saving becomes a thunk here. Shape: see
// helpers/approvalChecklist.js.

import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  items: [],
  selectedId: null,
  status: "idle",
  error: null,
  checklists: {},
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
    /** Merges `patch` into one section of a job's checklist; `base` is the checklist to start from when nothing is held yet. */
    updateChecklist(state, action) {
      const { jobId, sectionKey, patch, base } = action.payload;
      const current = state.checklists[jobId] ?? base ?? {};
      state.checklists[jobId] = { ...current, [sectionKey]: { ...(current[sectionKey] ?? {}), ...patch } };
    },
  },
});

export const approvalsActions = approvalsSlice.actions;
export default approvalsSlice.reducer;
