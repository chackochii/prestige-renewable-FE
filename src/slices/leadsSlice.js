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
  quote: null,
  quoteStatus: "idle",
  quoteError: null,
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

// ---- Estimation stage (2) workflow ------------------------------------

export const submitEstimationRequirements = createAsyncThunk(
  "leads/estimation/requirements",
  async ({ id, body }, { rejectWithValue }) => {
    try {
      return await api.submitEstimationRequirements(id, body);
    } catch (err) {
      return reject(err, rejectWithValue);
    }
  },
);

export const submitEstimationClientInfo = createAsyncThunk(
  "leads/estimation/clientInfo",
  async ({ id, body }, { rejectWithValue }) => {
    try {
      return await api.submitEstimationClientInfo(id, body);
    } catch (err) {
      return reject(err, rejectWithValue);
    }
  },
);

export const submitEstimatorChecklist = createAsyncThunk(
  "leads/estimation/checklist",
  async ({ id, body }, { rejectWithValue }) => {
    try {
      return await api.submitEstimatorChecklist(id, body);
    } catch (err) {
      return reject(err, rejectWithValue);
    }
  },
);

/** Fire-and-forget — no opportunity fields change, so nothing to store here. */
export const notifySalesManager = createAsyncThunk(
  "leads/notifySalesManager",
  async (id, { rejectWithValue }) => {
    try {
      return await api.notifySalesManager(id);
    } catch (err) {
      return reject(err, rejectWithValue);
    }
  },
);

/** Fire-and-forget — no opportunity fields change, so nothing to store here. */
export const notifyOperationsCoordinator = createAsyncThunk(
  "leads/notifyOperationsCoordinator",
  async (id, { rejectWithValue }) => {
    try {
      return await api.notifyOperationsCoordinator(id);
    } catch (err) {
      return reject(err, rejectWithValue);
    }
  },
);

// ---- Quote (Create Quote / Quote Builder) ------------------------------

export const fetchOpportunityQuote = createAsyncThunk("leads/quote/fetch", async (id, { rejectWithValue }) => {
  try {
    return await api.getOpportunityQuote(id);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const createOpportunityQuote = createAsyncThunk("leads/quote/create", async (id, { rejectWithValue }) => {
  try {
    return await api.createOpportunityQuote(id);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const updateOpportunityQuote = createAsyncThunk(
  "leads/quote/update",
  async ({ id, body }, { rejectWithValue }) => {
    try {
      return await api.updateOpportunityQuote(id, body);
    } catch (err) {
      return reject(err, rejectWithValue);
    }
  },
);

export const addQuoteItem = createAsyncThunk("leads/quote/items/add", async ({ id, body }, { rejectWithValue }) => {
  try {
    return await api.addQuoteItem(id, body);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const updateQuoteItem = createAsyncThunk(
  "leads/quote/items/update",
  async ({ id, itemId, body }, { rejectWithValue }) => {
    try {
      return await api.updateQuoteItem(id, itemId, body);
    } catch (err) {
      return reject(err, rejectWithValue);
    }
  },
);

export const deleteQuoteItem = createAsyncThunk(
  "leads/quote/items/delete",
  async ({ id, itemId }, { rejectWithValue }) => {
    try {
      await api.deleteQuoteItem(id, itemId);
      return itemId;
    } catch (err) {
      return reject(err, rejectWithValue);
    }
  },
);

export const addQuoteCost = createAsyncThunk("leads/quote/costs/add", async ({ id, body }, { rejectWithValue }) => {
  try {
    return await api.addQuoteCost(id, body);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const updateQuoteCost = createAsyncThunk(
  "leads/quote/costs/update",
  async ({ id, costId, body }, { rejectWithValue }) => {
    try {
      return await api.updateQuoteCost(id, costId, body);
    } catch (err) {
      return reject(err, rejectWithValue);
    }
  },
);

export const deleteQuoteCost = createAsyncThunk(
  "leads/quote/costs/delete",
  async ({ id, costId }, { rejectWithValue }) => {
    try {
      await api.deleteQuoteCost(id, costId);
      return costId;
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
      state.quote = null;
      state.quoteStatus = "idle";
      state.quoteError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchOpportunities.pending, (state, action) => {
        state.status = "loading";
        state.error = null;
        state.query = action.meta.arg;
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
      .addCase(submitEstimationRequirements.fulfilled, (state, action) => upsert(state, action.payload))
      .addCase(submitEstimationClientInfo.fulfilled, (state, action) => upsert(state, action.payload))
      .addCase(submitEstimatorChecklist.fulfilled, (state, action) => upsert(state, action.payload))
      .addCase(fetchOpportunityQuote.pending, (state) => {
        state.quoteStatus = "loading";
        state.quoteError = null;
      })
      .addCase(fetchOpportunityQuote.fulfilled, (state, action) => {
        state.quoteStatus = "succeeded";
        state.quote = action.payload || null;
      })
      .addCase(fetchOpportunityQuote.rejected, (state, action) => {
        state.quoteStatus = "failed";
        state.quoteError = action.payload;
      })
      .addCase(createOpportunityQuote.fulfilled, (state, action) => {
        state.quote = action.payload;
      })
      .addCase(updateOpportunityQuote.fulfilled, (state, action) => {
        state.quote = action.payload;
      })
      .addCase(addQuoteItem.fulfilled, (state, action) => {
        state.quote?.items.push(action.payload);
      })
      .addCase(updateQuoteItem.fulfilled, (state, action) => {
        const idx = state.quote?.items.findIndex((i) => i.id === action.payload.id);
        if (idx != null && idx !== -1) state.quote.items[idx] = action.payload;
      })
      .addCase(deleteQuoteItem.fulfilled, (state, action) => {
        if (state.quote) state.quote.items = state.quote.items.filter((i) => i.id !== action.payload);
      })
      .addCase(addQuoteCost.fulfilled, (state, action) => {
        state.quote?.additionalCosts.push(action.payload);
      })
      .addCase(updateQuoteCost.fulfilled, (state, action) => {
        const idx = state.quote?.additionalCosts.findIndex((c) => c.id === action.payload.id);
        if (idx != null && idx !== -1) state.quote.additionalCosts[idx] = action.payload;
      })
      .addCase(deleteQuoteCost.fulfilled, (state, action) => {
        if (state.quote) state.quote.additionalCosts = state.quote.additionalCosts.filter((c) => c.id !== action.payload);
      })
      .addCase(logout, () => initialState);
  },
});

export const { clearSelected } = leadsSlice.actions;
export default leadsSlice.reducer;
