// businessUnits slice: units the user can work in + the one they are working in.

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as api from "@/services/api/businessUnitsApi";
import { loadUnitChoice, saveUnitChoice } from "@/services/api/tokenStore";
import { logout } from "./authSlice";

const initialState = {
  items: [],
  currentId: null,
  status: "idle",
  error: null,
  mutationStatus: "idle",
};

const reject = (err, rejectWithValue) => rejectWithValue(err.message);

export const fetchBusinessUnits = createAsyncThunk(
  "businessUnits/fetchAll",
  async (_, { getState, rejectWithValue }) => {
    try {
      const items = await api.listBusinessUnits();
      const userId = getState().auth.user?.id;
      return { items, remembered: userId ? loadUnitChoice(userId) : null };
    } catch (err) {
      return reject(err, rejectWithValue);
    }
  },
);

export const createBusinessUnit = createAsyncThunk("businessUnits/create", async (body, { rejectWithValue }) => {
  try {
    return await api.createBusinessUnit(body);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const updateBusinessUnit = createAsyncThunk(
  "businessUnits/update",
  async ({ id, body }, { rejectWithValue }) => {
    try {
      return await api.updateBusinessUnit(id, body);
    } catch (err) {
      return reject(err, rejectWithValue);
    }
  },
);

export const updateBusinessUnitConfig = createAsyncThunk(
  "businessUnits/updateConfig",
  async ({ id, body }, { rejectWithValue }) => {
    try {
      return await api.updateBusinessUnitConfig(id, body);
    } catch (err) {
      return reject(err, rejectWithValue);
    }
  },
);

export const removeBusinessUnit = createAsyncThunk("businessUnits/remove", async (id, { rejectWithValue }) => {
  try {
    await api.deleteBusinessUnit(id);
    return id;
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

const mergeUnit = (state, unit) => {
  if (!unit) return;
  const idx = state.items.findIndex((u) => u.id === unit.id);
  // Keep disabledPages from the list payload — the single-unit endpoints omit it.
  const merged = idx === -1 ? unit : { ...state.items[idx], ...unit };
  if (idx === -1) state.items.push(merged);
  else state.items[idx] = merged;
  state.items.sort((a, b) => a.code.localeCompare(b.code));
};

const businessUnitsSlice = createSlice({
  name: "businessUnits",
  initialState,
  reducers: {
    setCurrentUnit: {
      reducer(state, action) {
        state.currentId = action.payload.unitId;
      },
      prepare(unitId, userId) {
        if (userId) saveUnitChoice(userId, unitId);
        return { payload: { unitId } };
      },
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchBusinessUnits.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchBusinessUnits.fulfilled, (state, action) => {
        const { items, remembered } = action.payload;
        state.status = "succeeded";
        state.items = items;
        const ids = items.map((u) => u.id);
        if (state.currentId !== null && !ids.includes(state.currentId)) state.currentId = null;
        if (state.currentId === null && remembered !== null && ids.includes(remembered)) state.currentId = remembered;
        if (state.currentId === null && items.length === 1) state.currentId = items[0].id;
      })
      .addCase(fetchBusinessUnits.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })
      .addCase(createBusinessUnit.fulfilled, (state, action) => {
        mergeUnit(state, { disabledPages: [], ...action.payload });
      })
      .addCase(updateBusinessUnit.fulfilled, (state, action) => {
        mergeUnit(state, action.payload);
      })
      .addCase(updateBusinessUnitConfig.fulfilled, (state, action) => {
        mergeUnit(state, action.payload);
      })
      .addCase(removeBusinessUnit.fulfilled, (state, action) => {
        state.items = state.items.filter((u) => u.id !== action.payload);
        if (state.currentId === action.payload) state.currentId = null;
      })
      .addCase(logout, () => initialState);
  },
});

export const { setCurrentUnit } = businessUnitsSlice.actions;

export const selectCurrentUnit = (state) =>
  state.businessUnits.items.find((u) => u.id === state.businessUnits.currentId) || null;

export default businessUnitsSlice.reducer;
