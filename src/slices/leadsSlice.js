// leads slice: opportunities in the current business unit (all stages) plus
// the record currently open in the detail view.

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as api from "@/services/api/leadsApi";
import { logout } from "./authSlice";

const initialState = {
  items: [],
  total: 0,
  query: null,
  status: "idle",
  error: null,
  selected: null,
  selectedStatus: "idle",
  selectedError: null,
  mutationStatus: "idle",
  history: [],
  historyStatus: "idle",
  historyError: null,
  meetings: [],
  meetingsStatus: "idle",
  meetingsError: null,
  attachments: [],
  attachmentsStatus: "idle",
  attachmentsError: null,
};

const reject = (err, rejectWithValue) => rejectWithValue(err.message);

export const fetchOpportunities = createAsyncThunk("leads/fetchAll", async (params, { rejectWithValue }) => {
  try {
    const result = await api.listOpportunities({ pageSize: 200, ...params });
    return { ...result, query: params };
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const fetchOpportunity = createAsyncThunk("leads/fetchOne", async (id, { rejectWithValue }) => {
  try {
    return await api.getOpportunity(id);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const createLead = createAsyncThunk("leads/create", async (body, { rejectWithValue }) => {
  try {
    return await api.createLead(body);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const updateLead = createAsyncThunk("leads/update", async ({ id, body }, { rejectWithValue }) => {
  try {
    return await api.updateLead(id, body);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const advanceStage = createAsyncThunk("leads/advance", async (id, { rejectWithValue }) => {
  try {
    return await api.advanceOpportunity(id);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const deleteLead = createAsyncThunk("leads/delete", async (id, { rejectWithValue }) => {
  try {
    await api.deleteLead(id);
    return id;
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const fetchOpportunityHistory = createAsyncThunk("leads/fetchHistory", async (id, { rejectWithValue }) => {
  try {
    return await api.listOpportunityHistory(id);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const addOpportunityHistoryEntry = createAsyncThunk(
  "leads/addHistoryEntry",
  async ({ id, body }, { rejectWithValue }) => {
    try {
      return await api.addOpportunityHistory(id, body);
    } catch (err) {
      return reject(err, rejectWithValue);
    }
  },
);

export const fetchOpportunityMeetings = createAsyncThunk("leads/fetchMeetings", async (id, { rejectWithValue }) => {
  try {
    return await api.listOpportunityMeetings(id);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const addOpportunityMeeting = createAsyncThunk(
  "leads/addMeeting",
  async ({ id, body }, { rejectWithValue }) => {
    try {
      return await api.addOpportunityMeeting(id, body);
    } catch (err) {
      return reject(err, rejectWithValue);
    }
  },
);

export const fetchOpportunityAttachments = createAsyncThunk(
  "leads/fetchAttachments",
  async (id, { rejectWithValue }) => {
    try {
      return await api.listOpportunityAttachments(id);
    } catch (err) {
      return reject(err, rejectWithValue);
    }
  },
);

export const uploadOpportunityAttachment = createAsyncThunk(
  "leads/uploadAttachment",
  async ({ id, category, file }, { rejectWithValue }) => {
    try {
      return await api.uploadOpportunityAttachment(id, category, file);
    } catch (err) {
      return reject(err, rejectWithValue);
    }
  },
);

export const assignSalesperson = createAsyncThunk(
  "leads/assignSalesperson",
  async ({ id, body }, { rejectWithValue }) => {
    try {
      return await api.assignSalesperson(id, body);
    } catch (err) {
      return reject(err, rejectWithValue);
    }
  },
);

export const assignEstimator = createAsyncThunk(
  "leads/assignEstimator",
  async ({ id, body }, { rejectWithValue }) => {
    try {
      return await api.assignEstimator(id, body);
    } catch (err) {
      return reject(err, rejectWithValue);
    }
  },
);

export const assignCoordinator = createAsyncThunk(
  "leads/assignCoordinator",
  async ({ id, body }, { rejectWithValue }) => {
    try {
      return await api.assignCoordinator(id, body);
    } catch (err) {
      return reject(err, rejectWithValue);
    }
  },
);

/** Fire-and-forget — no opportunity fields change, so nothing to store here. */
export const notifyBusinessOwner = createAsyncThunk(
  "leads/notifyBusinessOwner",
  async (id, { rejectWithValue }) => {
    try {
      return await api.notifyBusinessOwner(id);
    } catch (err) {
      return reject(err, rejectWithValue);
    }
  },
);

const upsert = (state, opp) => {
  if (!opp) return;
  const idx = state.items.findIndex((o) => o.id === opp.id);
  if (idx === -1) state.items.unshift(opp);
  else state.items[idx] = opp;
  if (state.selected?.id === opp.id) state.selected = opp;
};

const leadsSlice = createSlice({
  name: "leads",
  initialState,
  reducers: {
    clearSelected(state) {
      state.selected = null;
      state.selectedStatus = "idle";
      state.selectedError = null;
      state.history = [];
      state.historyStatus = "idle";
      state.historyError = null;
      state.meetings = [];
      state.meetingsStatus = "idle";
      state.meetingsError = null;
      state.attachments = [];
      state.attachmentsStatus = "idle";
      state.attachmentsError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOpportunities.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchOpportunities.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.items = action.payload.items;
        state.total = action.payload.total;
        state.query = action.payload.query;
      })
      .addCase(fetchOpportunities.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })
      .addCase(fetchOpportunity.pending, (state) => {
        state.selectedStatus = "loading";
        state.selectedError = null;
      })
      .addCase(fetchOpportunity.fulfilled, (state, action) => {
        state.selectedStatus = "succeeded";
        state.selected = action.payload;
      })
      .addCase(fetchOpportunity.rejected, (state, action) => {
        state.selectedStatus = "failed";
        state.selectedError = action.payload;
        state.selected = null;
      })
      .addCase(createLead.fulfilled, (state, action) => upsert(state, action.payload))
      .addCase(updateLead.fulfilled, (state, action) => upsert(state, action.payload))
      .addCase(advanceStage.fulfilled, (state, action) => upsert(state, action.payload))
      .addCase(deleteLead.fulfilled, (state, action) => {
        state.items = state.items.filter((o) => o.id !== action.payload);
        if (state.selected?.id === action.payload) state.selected = null;
      })
      .addCase(fetchOpportunityHistory.pending, (state) => {
        state.historyStatus = "loading";
        state.historyError = null;
      })
      .addCase(fetchOpportunityHistory.fulfilled, (state, action) => {
        state.historyStatus = "succeeded";
        state.history = action.payload || [];
      })
      .addCase(fetchOpportunityHistory.rejected, (state, action) => {
        state.historyStatus = "failed";
        state.historyError = action.payload;
      })
      .addCase(addOpportunityHistoryEntry.fulfilled, (state, action) => {
        state.history.unshift(action.payload);
      })
      .addCase(fetchOpportunityMeetings.pending, (state) => {
        state.meetingsStatus = "loading";
        state.meetingsError = null;
      })
      .addCase(fetchOpportunityMeetings.fulfilled, (state, action) => {
        state.meetingsStatus = "succeeded";
        state.meetings = action.payload || [];
      })
      .addCase(fetchOpportunityMeetings.rejected, (state, action) => {
        state.meetingsStatus = "failed";
        state.meetingsError = action.payload;
      })
      .addCase(addOpportunityMeeting.fulfilled, (state, action) => {
        state.meetings.unshift(action.payload);
      })
      .addCase(fetchOpportunityAttachments.pending, (state) => {
        state.attachmentsStatus = "loading";
        state.attachmentsError = null;
      })
      .addCase(fetchOpportunityAttachments.fulfilled, (state, action) => {
        state.attachmentsStatus = "succeeded";
        state.attachments = action.payload || [];
      })
      .addCase(fetchOpportunityAttachments.rejected, (state, action) => {
        state.attachmentsStatus = "failed";
        state.attachmentsError = action.payload;
      })
      .addCase(uploadOpportunityAttachment.fulfilled, (state, action) => {
        state.attachments.unshift(action.payload);
      })
      .addCase(assignSalesperson.fulfilled, (state, action) => upsert(state, action.payload))
      .addCase(assignEstimator.fulfilled, (state, action) => upsert(state, action.payload))
      .addCase(assignCoordinator.fulfilled, (state, action) => upsert(state, action.payload))
      .addCase(logout, () => initialState);
  },
});

export const { clearSelected } = leadsSlice.actions;
export default leadsSlice.reducer;
