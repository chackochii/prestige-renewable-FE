// Approvals (stage 5): the board (every job at the stage) and each job's
// approvals by opportunity id, both from prestige-be. The approvals page and
// the opportunity page's stage-5 panel read the same job entry, so a change
// on one is seen by the other.
//
// The board's rows are whole jobs, so loading it fills the job entries too:
// the approvals page is one request, and picking a job on it is none. Only
// the opportunity page, which has no board, fetches a single job.

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as api from "@/services/api/approvalsApi";
import { logout } from "./authSlice";

const initialState = {
  board: [], // the page of jobs on screen
  boardTotal: 0, // every job on the board, across all its pages
  boardCounts: null, // the stat cards, across the whole board
  boardStatus: "idle",
  boardError: null,
  boardQuery: null, // what the board on screen (or on its way) was asked for
  jobs: {}, // opportunityId → job
  jobStatus: {}, // opportunityId → idle | loading | succeeded | failed
  jobError: {},
  // opportunityId → why the last checklist save was refused. Kept apart from
  // jobError: the job is reloaded after a refusal, and that reload must not
  // wipe the reason off the screen.
  saveError: {},
};

const reject = (err, rejectWithValue) => rejectWithValue(err.message);

const boardQueryOf = (params = {}) => JSON.stringify(params);

export const fetchApprovalsBoard = createAsyncThunk(
  "approvals/board",
  async (params, { rejectWithValue }) => {
    try {
      return await api.getApprovalsBoard(params);
    } catch (err) {
      return reject(err, rejectWithValue);
    }
  },
  {
    // The same board asked for while it is already on its way is not asked
    // for twice — React's development double-run of effects, or two panels
    // mounting together, make one request between them.
    condition: (params, { getState }) => {
      const { boardStatus, boardQuery } = getState().approvals;
      return !(boardStatus === "loading" && boardQuery === boardQueryOf(params));
    },
  },
);

export const fetchJobApprovals = createAsyncThunk("approvals/job", async (opportunityId, { rejectWithValue }) => {
  try {
    return await api.getJobApprovals(opportunityId);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

/** → the job's approvals, with the rows that follow the change already on it. */
export const setRequiredApprovals = createAsyncThunk("approvals/setRequired", async ({ id, keys }, { rejectWithValue }) => {
  try {
    return await api.setRequiredApprovals(id, keys, { view: "approvals" });
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

/**
 * Answers typed while a copy of the job was on its way from the API are still
 * on screen and will be sent next; the API's copy must not wipe them.
 */
const keepLocalAnswers = (held, incoming) =>
  held
    ? {
        ...incoming,
        items: (incoming.items ?? []).map((item) => {
          const local = held.items?.find((candidate) => candidate.key === item.key);
          return local?.checklist ? { ...item, checklist: { ...(item.checklist ?? {}), ...local.checklist } } : item;
        }),
      }
    : incoming;

/** { id, type, body, fromChecklist? } — fromChecklist marks the debounced checklist saves, whose refusals go to saveError. */
export const updateApproval = createAsyncThunk("approvals/update", async ({ id, type, body }, { rejectWithValue }) => {
  try {
    return await api.updateApproval(id, type, body);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

/** One job, fresh from the API, into its entry and its board row. */
const putJob = (state, job) => {
  if (!job?.id) return;
  state.jobs[job.id] = job;
  state.jobStatus[job.id] = "succeeded";
  state.jobError[job.id] = null;
  const idx = state.board.findIndex((row) => row.id === job.id);
  if (idx !== -1) state.board[idx] = job;
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
    clearSaveError(state, action) {
      state.saveError[action.payload] = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchApprovalsBoard.pending, (state, action) => {
        state.boardStatus = "loading";
        state.boardError = null;
        state.boardQuery = boardQueryOf(action.meta.arg);
      })
      .addCase(fetchApprovalsBoard.fulfilled, (state, action) => {
        state.boardStatus = "succeeded";
        state.board = action.payload?.items ?? [];
        state.boardTotal = action.payload?.total ?? state.board.length;
        state.boardCounts = action.payload?.counts ?? null;
        // Every row is a whole job: it is the job entry too, so nothing is
        // asked for again when one is picked.
        for (const row of state.board) {
          if (!row?.id) continue;
          state.jobs[row.id] = keepLocalAnswers(state.jobs[row.id], row);
          state.jobStatus[row.id] = "succeeded";
          state.jobError[row.id] = null;
        }
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
      .addCase(updateApproval.pending, (state, action) => {
        if (action.meta.arg?.fromChecklist) state.saveError[action.meta.arg.id] = null;
      })
      .addCase(updateApproval.fulfilled, (state, action) => {
        putJob(state, keepLocalAnswers(state.jobs[action.payload?.id], action.payload));
      })
      .addCase(updateApproval.rejected, (state, action) => {
        // The plain approval buttons show their own refusal; a checklist save
        // has nobody waiting on it, so its reason is kept here for the screen.
        const { id, fromChecklist } = action.meta.arg ?? {};
        if (id && fromChecklist) state.saveError[id] = action.payload || "Your last checklist answers could not be saved.";
      })
      .addCase(setRequiredApprovals.fulfilled, (state, action) => {
        putJob(state, keepLocalAnswers(state.jobs[action.payload?.id], action.payload));
      })
      .addCase(logout, () => initialState);
  },
});

export const { patchChecklistLocally, clearSaveError } = approvalsSlice.actions;
export default approvalsSlice.reducer;
