// collaboration slice: cross-department requests and assignments.
//
// Three lists, kept apart because they answer different questions:
//   assigned — what this person has to act on (My Assigned Requests)
//   raised   — what this person is waiting on (Waiting For)
//   byOpp    — everything on the job currently open, for its stage panels
// plus the one request open in a detail view, with its history.

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as api from "@/services/api/collaborationApi";
import { logout } from "./authSlice";

const initialState = {
  assigned: [],
  assignedStatus: "idle",
  assignedError: null,
  raised: [],
  raisedStatus: "idle",
  raisedError: null,
  oppId: null,
  byOpp: [],
  byOppStatus: "idle",
  byOppError: null,
  selected: null,
  selectedStatus: "idle",
  selectedError: null,
  history: [],
  historyStatus: "idle",
};

const reject = (err, rejectWithValue) => rejectWithValue(err.message);

export const fetchAssignedRequests = createAsyncThunk(
  "collaboration/fetchAssigned",
  async (params, { rejectWithValue }) => {
    try {
      const result = await api.listRequests({ scope: "assigned", pageSize: 200, ...params });
      return result.items;
    } catch (err) {
      return reject(err, rejectWithValue);
    }
  },
);

export const fetchRaisedRequests = createAsyncThunk(
  "collaboration/fetchRaised",
  async (params, { rejectWithValue }) => {
    try {
      const result = await api.listRequests({ scope: "raised", pageSize: 200, ...params });
      return result.items;
    } catch (err) {
      return reject(err, rejectWithValue);
    }
  },
);

export const fetchOpportunityRequests = createAsyncThunk(
  "collaboration/fetchForOpportunity",
  async (opportunityId, { rejectWithValue }) => {
    try {
      return { opportunityId: Number(opportunityId), items: await api.listOpportunityRequests(opportunityId) };
    } catch (err) {
      return reject(err, rejectWithValue);
    }
  },
);

export const fetchRequest = createAsyncThunk("collaboration/fetchOne", async (id, { rejectWithValue }) => {
  try {
    return await api.getRequest(id);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const createRequest = createAsyncThunk(
  "collaboration/create",
  async ({ opportunityId, body }, { rejectWithValue }) => {
    try {
      return await api.createRequest(opportunityId, body);
    } catch (err) {
      return reject(err, rejectWithValue);
    }
  },
);

export const updateRequest = createAsyncThunk("collaboration/update", async ({ id, body }, { rejectWithValue }) => {
  try {
    return await api.updateRequest(id, body);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const submitResponse = createAsyncThunk(
  "collaboration/respond",
  async ({ id, body }, { rejectWithValue }) => {
    try {
      return await api.submitResponse(id, body);
    } catch (err) {
      return reject(err, rejectWithValue);
    }
  },
);

export const decideResponse = createAsyncThunk("collaboration/decide", async ({ id, body }, { rejectWithValue }) => {
  try {
    return await api.decideResponse(id, body);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const addProgress = createAsyncThunk("collaboration/progress", async ({ id, body }, { rejectWithValue }) => {
  try {
    return await api.addProgress(id, body);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const uploadRequestAttachment = createAsyncThunk(
  "collaboration/uploadAttachment",
  async ({ id, category, file }, { rejectWithValue }) => {
    try {
      return await api.uploadRequestAttachment(id, category, file);
    } catch (err) {
      return reject(err, rejectWithValue);
    }
  },
);

export const cancelRequest = createAsyncThunk("collaboration/cancel", async ({ id, body }, { rejectWithValue }) => {
  try {
    return await api.cancelRequest(id, body);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const fetchRequestHistory = createAsyncThunk("collaboration/history", async (id, { rejectWithValue }) => {
  try {
    return await api.listRequestHistory(id);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

/** A changed request replaces itself everywhere it is already held. */
const upsert = (state, request) => {
  if (!request?.id) return;
  for (const key of ["assigned", "raised", "byOpp"]) {
    const idx = state[key].findIndex((r) => r.id === request.id);
    if (idx !== -1) state[key][idx] = request;
  }
  if (state.selected?.id === request.id) state.selected = request;
};

const collaborationSlice = createSlice({
  name: "collaboration",
  initialState,
  reducers: {
    selectRequest(state, action) {
      state.selected = action.payload;
      state.selectedStatus = action.payload ? "succeeded" : "idle";
      state.history = [];
      state.historyStatus = "idle";
    },
    clearSelectedRequest(state) {
      state.selected = null;
      state.selectedStatus = "idle";
      state.selectedError = null;
      state.history = [];
      state.historyStatus = "idle";
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchAssignedRequests.pending, (state) => {
        state.assignedStatus = "loading";
        state.assignedError = null;
      })
      .addCase(fetchAssignedRequests.fulfilled, (state, action) => {
        state.assignedStatus = "succeeded";
        state.assigned = action.payload || [];
      })
      .addCase(fetchAssignedRequests.rejected, (state, action) => {
        state.assignedStatus = "failed";
        state.assignedError = action.payload;
      })
      .addCase(fetchRaisedRequests.pending, (state) => {
        state.raisedStatus = "loading";
        state.raisedError = null;
      })
      .addCase(fetchRaisedRequests.fulfilled, (state, action) => {
        state.raisedStatus = "succeeded";
        state.raised = action.payload || [];
      })
      .addCase(fetchRaisedRequests.rejected, (state, action) => {
        state.raisedStatus = "failed";
        state.raisedError = action.payload;
      })
      .addCase(fetchOpportunityRequests.pending, (state, action) => {
        state.byOppStatus = "loading";
        state.byOppError = null;
        state.oppId = Number(action.meta.arg);
      })
      .addCase(fetchOpportunityRequests.fulfilled, (state, action) => {
        state.byOppStatus = "succeeded";
        state.oppId = action.payload.opportunityId;
        state.byOpp = action.payload.items || [];
      })
      .addCase(fetchOpportunityRequests.rejected, (state, action) => {
        state.byOppStatus = "failed";
        state.byOppError = action.payload;
        state.byOpp = [];
      })
      .addCase(fetchRequest.pending, (state) => {
        state.selectedStatus = "loading";
        state.selectedError = null;
      })
      .addCase(fetchRequest.fulfilled, (state, action) => {
        state.selectedStatus = "succeeded";
        state.selected = action.payload;
      })
      .addCase(fetchRequest.rejected, (state, action) => {
        state.selectedStatus = "failed";
        state.selectedError = action.payload;
      })
      .addCase(createRequest.fulfilled, (state, action) => {
        const request = action.payload;
        if (!request?.id) return;
        state.raised.unshift(request);
        if (state.oppId && Number(request.opportunityId) === state.oppId) state.byOpp.unshift(request);
      })
      .addCase(updateRequest.fulfilled, (state, action) => upsert(state, action.payload))
      .addCase(submitResponse.fulfilled, (state, action) => upsert(state, action.payload))
      .addCase(decideResponse.fulfilled, (state, action) => upsert(state, action.payload))
      .addCase(addProgress.fulfilled, (state, action) => upsert(state, action.payload))
      .addCase(cancelRequest.fulfilled, (state, action) => upsert(state, action.payload))
      .addCase(uploadRequestAttachment.fulfilled, (state, action) => upsert(state, action.payload?.request))
      .addCase(fetchRequestHistory.pending, (state) => {
        state.historyStatus = "loading";
      })
      .addCase(fetchRequestHistory.fulfilled, (state, action) => {
        state.historyStatus = "succeeded";
        state.history = action.payload || [];
      })
      .addCase(fetchRequestHistory.rejected, (state) => {
        state.historyStatus = "failed";
        state.history = [];
      })
      .addCase(logout, () => initialState);
  },
});

export const { selectRequest, clearSelectedRequest } = collaborationSlice.actions;

/** Requests on one job, only when the store holds that job's list. */
export const selectOpportunityRequests = (state, opportunityId) =>
  state.collaboration.oppId === Number(opportunityId) ? state.collaboration.byOpp : [];

export default collaborationSlice.reducer;
