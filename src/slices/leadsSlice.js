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
      .addCase(logout, () => initialState);
  },
});

export const { clearSelected } = leadsSlice.actions;
export default leadsSlice.reducer;
