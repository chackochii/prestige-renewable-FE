// Procurement & delivery (stage 6): the board (every job at the stage) and
// each job's record by opportunity id, both from prestige-be. The procurement
// page and the opportunity page's stage-6 panel read the same job entry, so
// a change on one is seen by the other.
//
// The board's rows are whole jobs, so loading it fills the job entries too:
// the procurement page is one request, and picking a job on it is none. Only
// the opportunity page, which has no board, fetches a single job.

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as api from "@/services/api/procurementApi";
import { logout } from "./authSlice";

const initialState = {
  board: [], // the page of jobs on screen
  boardTotal: 0, // every job on the board, across all its pages
  boardCounts: null, // the stat cards, across the whole board
  boardStatus: "idle",
  boardError: null,
  boardQuery: null,
  jobs: {}, // opportunityId → job
  jobStatus: {}, // opportunityId → idle | loading | succeeded | failed
  jobError: {}, // opportunityId → the last failure on that job, cleared by the next success
};

const reject = (err, rejectWithValue) => rejectWithValue(err.message);
const boardQueryOf = (params = {}) => JSON.stringify(params);

export const fetchProcurementBoard = createAsyncThunk(
  "procurement/board",
  async (params, { rejectWithValue }) => {
    try {
      return await api.getProcurementBoard(params);
    } catch (err) {
      return reject(err, rejectWithValue);
    }
  },
  {
    // The same board asked for while it is on its way is not asked for twice.
    condition: (params, { getState }) => {
      const { boardStatus, boardQuery } = getState().procurement;
      return !(boardStatus === "loading" && boardQuery === boardQueryOf(params));
    },
  },
);

export const fetchProcurementJob = createAsyncThunk("procurement/job", async (opportunityId, { rejectWithValue }) => {
  try {
    return await api.getProcurementJob(opportunityId);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

/** A thunk that sends one change and gets the whole job back. */
const jobWrite = (name, call) =>
  createAsyncThunk(`procurement/${name}`, async (arg, { rejectWithValue }) => {
    try {
      return await call(arg);
    } catch (err) {
      return reject(err, rejectWithValue);
    }
  });

export const saveChecklist = jobWrite("checklist", ({ id, section, patch }) => api.patchProcurementChecklist(id, section, patch));
export const saveBoq = jobWrite("boq", ({ id, body }) => api.saveBoq(id, body));
export const addSupplierQuote = jobWrite("addQuote", ({ id, body }) => api.addSupplierQuote(id, body));
export const removeSupplierQuote = jobWrite("removeQuote", ({ id, index }) => api.removeSupplierQuote(id, index));
export const createPurchaseOrder = jobWrite("createPurchaseOrder", ({ id, body }) => api.createPurchaseOrder(id, body));
export const updatePurchaseOrder = jobWrite("updatePurchaseOrder", ({ id, poId, body }) => api.updatePurchaseOrder(id, poId, body));
export const deletePurchaseOrder = jobWrite("deletePurchaseOrder", ({ id, poId }) => api.deletePurchaseOrder(id, poId));
export const decideVariation = jobWrite("decideVariation", ({ id, role, body }) => api.decideVariation(id, role, body));

const WRITES = [saveChecklist, saveBoq, addSupplierQuote, removeSupplierQuote, createPurchaseOrder, updatePurchaseOrder, deletePurchaseOrder, decideVariation];

/**
 * Answers typed while a copy of the job was on its way from the API are still
 * on screen and will be sent next; the API's copy must not wipe them.
 */
const keepLocalAnswers = (held, incoming) => {
  if (!held?.checklist) return incoming;
  const checklist = { ...(incoming.checklist ?? {}) };
  for (const [section, answers] of Object.entries(held.checklist)) checklist[section] = { ...(checklist[section] ?? {}), ...(answers ?? {}) };
  return { ...incoming, checklist };
};

/** One job, fresh from the API, into its entry and its board row. */
const putJob = (state, job) => {
  if (!job?.id) return;
  state.jobs[job.id] = job;
  state.jobStatus[job.id] = "succeeded";
  state.jobError[job.id] = null;
  const idx = state.board.findIndex((row) => row.id === job.id);
  if (idx !== -1) state.board[idx] = job;
};

const procurementSlice = createSlice({
  name: "procurement",
  initialState,
  reducers: {
    /** Answers typed into a checklist, applied straight away while the save is on its way. */
    patchChecklistLocally(state, action) {
      const { id, section, patch } = action.payload;
      const job = state.jobs[id];
      if (!job) return;
      job.checklist = { ...(job.checklist ?? {}), [section]: { ...(job.checklist?.[section] ?? {}), ...patch } };
    },
    clearJobError(state, action) {
      state.jobError[action.payload] = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProcurementBoard.pending, (state, action) => {
        state.boardStatus = "loading";
        state.boardError = null;
        state.boardQuery = boardQueryOf(action.meta.arg);
      })
      .addCase(fetchProcurementBoard.fulfilled, (state, action) => {
        state.boardStatus = "succeeded";
        state.board = action.payload?.items ?? [];
        state.boardTotal = action.payload?.total ?? state.board.length;
        state.boardCounts = action.payload?.counts ?? null;
        for (const row of state.board) {
          if (!row?.id) continue;
          state.jobs[row.id] = keepLocalAnswers(state.jobs[row.id], row);
          state.jobStatus[row.id] = "succeeded";
          state.jobError[row.id] = null;
        }
      })
      .addCase(fetchProcurementBoard.rejected, (state, action) => {
        state.boardStatus = "failed";
        state.boardError = action.payload;
      })
      .addCase(fetchProcurementJob.pending, (state, action) => {
        state.jobStatus[action.meta.arg] = "loading";
      })
      .addCase(fetchProcurementJob.fulfilled, (state, action) => putJob(state, action.payload))
      .addCase(fetchProcurementJob.rejected, (state, action) => {
        state.jobStatus[action.meta.arg] = "failed";
        state.jobError[action.meta.arg] = action.payload;
      })
      .addCase(logout, () => initialState);
    for (const write of WRITES) {
      builder
        .addCase(write.fulfilled, (state, action) => {
          // A checklist save carries the answers it sent; anything typed since is kept.
          putJob(state, write === saveChecklist ? keepLocalAnswers(state.jobs[action.payload?.id], action.payload) : action.payload);
        })
        .addCase(write.rejected, (state, action) => {
          const id = action.meta.arg?.id;
          if (id) state.jobError[id] = action.payload;
        });
    }
  },
});

export const { patchChecklistLocally, clearJobError } = procurementSlice.actions;
export default procurementSlice.reducer;
