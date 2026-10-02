// Approvals (stage 5): the board (every job at the stage) and each job's
// approvals by opportunity id, both from prestige-be. The approvals page and
// the opportunity page's stage-5 panel read the same job entry, so a change
// on one is seen by the other.

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as api from "@/services/api/approvalsApi";
import { logout } from "./authSlice";

const initialState = {
  board: [],
  boardStatus: "idle",
  boardError: null,
  jobs: {}, // opportunityId → job
  jobStatus: {}, // opportunityId → idle | loading | succeeded | failed
  jobError: {},
};

const reject = (err, rejectWithValue) => rejectWithValue(err.message);

export const fetchApprovalsBoard = createAsyncThunk("approvals/board", async (params, { rejectWithValue }) => {
  try {
    return await api.getApprovalsBoard(params);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const fetchJobApprovals = createAsyncThunk("approvals/job", async (opportunityId, { rejectWithValue }) => {
  try {
    return await api.getJobApprovals(opportunityId);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

/** → the opportunity (requiredApprovals on it); the job entry is refetched by the caller when it is at the stage. */
export const setRequiredApprovals = createAsyncThunk("approvals/setRequired", async ({ id, keys }, { rejectWithValue }) => {
  try {
    return await api.setRequiredApprovals(id, keys);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const updateApproval = createAsyncThunk("approvals/update", async ({ id, type, body }, { rejectWithValue }) => {
  try {
    return await api.updateApproval(id, type, body);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

const putJob = (state, job) => {
  if (!job?.id) return;
  state.jobs[job.id] = job;
  state.jobStatus[job.id] = "succeeded";
  state.jobError[job.id] = null;
  const idx = state.board.findIndex((row) => row.id === job.id);
  // The board's rows carry no history or notifications; keep them that way.
  if (idx !== -1) state.board[idx] = { ...state.board[idx], ...job, history: undefined, notifications: undefined };
};

const approvalsSlice = createSlice({
  name: "approvals",
  initialState,
  reducers: {
    /** Answers typed into a checklist, applied straight away while the save is on its way. */
    patchChecklistLocally(state, action) {
      const { id, type, patch } = action.payload;
      const item = state.jobs[id]?.items?.find((candidate) => candidate.key === type);
      if (item) item.checklist = { ...(item.checklist ?? {}), ...patch };
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchApprovalsBoard.pending, (state) => {
        state.boardStatus = "loading";
        state.boardError = null;
      })
      .addCase(fetchApprovalsBoard.fulfilled, (state, action) => {
        state.boardStatus = "succeeded";
        state.board = action.payload || [];
      })
      .addCase(fetchApprovalsBoard.rejected, (state, action) => {
        state.boardStatus = "failed";
        state.boardError = action.payload;
      })
      .addCase(fetchJobApprovals.pending, (state, action) => {
        state.jobStatus[action.meta.arg] = "loading";
        state.jobError[action.meta.arg] = null;
      })
      .addCase(fetchJobApprovals.fulfilled, (state, action) => putJob(state, action.payload))
      .addCase(fetchJobApprovals.rejected, (state, action) => {
        state.jobStatus[action.meta.arg] = "failed";
        state.jobError[action.meta.arg] = action.payload;
      })
      .addCase(updateApproval.fulfilled, (state, action) => {
        // Answers typed while this save was on its way are still on screen
        // and will be sent next; the API's copy must not wipe them.
        const held = state.jobs[action.payload?.id];
        const job = held
          ? {
              ...action.payload,
              items: (action.payload.items ?? []).map((item) => {
                const local = held.items?.find((candidate) => candidate.key === item.key);
                return local?.checklist ? { ...item, checklist: { ...(item.checklist ?? {}), ...local.checklist } } : item;
              }),
            }
          : action.payload;
        putJob(state, job);
      })
      .addCase(logout, () => initialState);
  },
});

export const { patchChecklistLocally } = approvalsSlice.actions;
export default approvalsSlice.reducer;
