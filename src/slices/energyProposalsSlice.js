// Energy proposals on the job that is open: the list, the editor's options
// (the skill's products and settings, the job's bills) and the proposal open
// in the editor. Every write returns the whole proposal, recalculated.

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as api from "@/services/api/energyProposalsApi";
import { logout } from "./authSlice";

const thunk = (type, fn) =>
  createAsyncThunk(type, async (arg, { rejectWithValue }) => {
    try {
      return await fn(arg);
    } catch (err) {
      return rejectWithValue(err.message);
    }
  });

export const fetchProposalOptions = thunk("energyProposals/options", (oppId) => api.getProposalOptions(oppId));
export const fetchEnergyProposals = thunk("energyProposals/list", (oppId) => api.listEnergyProposals(oppId));
export const fetchEnergyProposal = thunk("energyProposals/get", ({ oppId, id }) => api.getEnergyProposal(oppId, id));
export const createEnergyProposal = thunk("energyProposals/create", ({ oppId, body }) => api.createEnergyProposal(oppId, body));
export const draftEnergyProposalWithAi = thunk("energyProposals/aiDraft", ({ oppId, body }) => api.draftEnergyProposalWithAi(oppId, body));
export const previewEnergyProposal = thunk("energyProposals/preview", ({ oppId, body }) => api.previewEnergyProposal(oppId, body));
export const updateEnergyProposal = thunk("energyProposals/update", ({ oppId, id, body }) => api.updateEnergyProposal(oppId, id, body));
export const rewriteEnergyProposalText = thunk("energyProposals/rewrite", ({ oppId, id, body }) => api.rewriteEnergyProposalText(oppId, id, body));
export const finaliseEnergyProposal = thunk("energyProposals/finalise", ({ oppId, id }) => api.finaliseEnergyProposal(oppId, id));
export const reviseEnergyProposal = thunk("energyProposals/revise", ({ oppId, id }) => api.reviseEnergyProposal(oppId, id));
export const saveEnergyProposalPdf = thunk("energyProposals/savePdf", ({ oppId, id, blob, filename }) => api.saveEnergyProposalPdf(oppId, id, blob, filename));
export const deleteEnergyProposal = thunk("energyProposals/delete", async ({ oppId, id }) => {
  await api.deleteEnergyProposal(oppId, id);
  return id;
});

const initialState = { oppId: null, list: [], listStatus: "idle", options: null, current: null, error: null };

/** The list row a full proposal reads as. */
const rowOf = (p) => ({
  id: p.id,
  number: p.number,
  revision: p.revision,
  title: p.title,
  status: p.status,
  preparedOn: p.preparedOn,
  netIncGst: p.result?.net?.incGst ?? null,
  totalIncGst: p.result?.prices?.totalIncGst ?? null,
  annualBenefit: p.result?.savings?.annualBenefit ?? null,
  system: p.result?.system ? { nominalKwh: p.result.system.nominalKwh, solarKw: p.result.system.solarKw, evChargers: p.result.system.evChargers } : null,
  openItems: (p.result?.flags ?? []).length,
  pdf: p.pdf ?? null,
  createdBy: p.createdBy ?? null,
  updatedAt: p.updatedAt,
});

const put = (state, proposal) => {
  state.current = proposal;
  const idx = state.list.findIndex((p) => p.id === proposal.id);
  if (idx === -1) state.list.unshift(rowOf(proposal));
  else state.list[idx] = rowOf(proposal);
};

const energyProposalsSlice = createSlice({
  name: "energyProposals",
  initialState,
  reducers: {
    closeEnergyProposal(state) {
      state.current = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchEnergyProposals.pending, (state, action) => {
        if (state.oppId !== action.meta.arg) {
          state.list = [];
          state.current = null;
          state.options = null;
        }
        state.oppId = action.meta.arg;
        state.listStatus = "loading";
      })
      .addCase(fetchEnergyProposals.fulfilled, (state, action) => {
        state.listStatus = "succeeded";
        state.list = action.payload;
      })
      .addCase(fetchEnergyProposals.rejected, (state, action) => {
        state.listStatus = "failed";
        state.error = action.payload;
      })
      .addCase(fetchProposalOptions.fulfilled, (state, action) => {
        state.options = action.payload;
      })
      .addCase(deleteEnergyProposal.fulfilled, (state, action) => {
        state.list = state.list.filter((p) => p.id !== action.payload);
        if (state.current?.id === action.payload) state.current = null;
      })
      .addCase(logout, () => initialState);
    for (const t of [fetchEnergyProposal, createEnergyProposal, draftEnergyProposalWithAi, updateEnergyProposal, rewriteEnergyProposalText, finaliseEnergyProposal, reviseEnergyProposal, saveEnergyProposalPdf])
      builder.addCase(t.fulfilled, (state, action) => put(state, action.payload));
  },
});

export const { closeEnergyProposal } = energyProposalsSlice.actions;
export default energyProposalsSlice.reducer;
