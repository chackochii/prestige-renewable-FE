// Admin → AI skills: the skills list and the one open in the editor, with its
// version history. Every write returns the whole skill, which replaces the
// open one and its row in the list.

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as api from "@/services/api/aiSkillsApi";
import { logout } from "./authSlice";

const thunk = (type, fn) =>
  createAsyncThunk(type, async (arg, { rejectWithValue }) => {
    try {
      return await fn(arg);
    } catch (err) {
      return rejectWithValue(err.message);
    }
  });

export const fetchSkills = thunk("aiSkills/list", () => api.listSkills());
export const fetchSkill = thunk("aiSkills/get", (id) => api.getSkill(id));
export const createSkill = thunk("aiSkills/create", (body) => api.createSkill(body));
export const updateSkill = thunk("aiSkills/update", ({ id, body }) => api.updateSkill(id, body));
export const resetSkillSettings = thunk("aiSkills/resetSettings", (id) => api.resetSkillSettings(id));
export const uploadSkillFile = thunk("aiSkills/upload", ({ id, file, target, note }) => api.uploadSkillFile(id, file, { target, note }));
export const fetchSkillReference = thunk("aiSkills/reference", ({ id, name }) => api.getSkillReference(id, name));
export const updateSkillReference = thunk("aiSkills/updateReference", ({ id, name, body }) => api.updateSkillReference(id, name, body));
export const removeSkillReference = thunk("aiSkills/removeReference", ({ id, name }) => api.removeSkillReference(id, name));
export const fetchSkillVersions = thunk("aiSkills/versions", (id) => api.listSkillVersions(id));
export const fetchSkillVersion = thunk("aiSkills/version", ({ id, version }) => api.getSkillVersion(id, version));
export const restoreSkillVersion = thunk("aiSkills/restore", ({ id, version }) => api.restoreSkillVersion(id, version));

const initialState = { list: [], listStatus: "idle", current: null, currentStatus: "idle", versions: [], error: null };

const summaryOf = (skill) => ({ ...skill, contentLength: skill.content?.length ?? skill.contentLength, content: undefined, defaults: undefined });

const replace = (state, skill) => {
  state.current = skill;
  const idx = state.list.findIndex((s) => s.id === skill.id);
  if (idx === -1) state.list.push(summaryOf(skill));
  else state.list[idx] = summaryOf(skill);
  // Activating one skill deactivates the others of its purpose.
  if (skill.isActive) state.list.forEach((s) => {
    if (s.id !== skill.id && s.purpose === skill.purpose) s.isActive = false;
  });
};

const aiSkillsSlice = createSlice({
  name: "aiSkills",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSkills.pending, (state) => {
        state.listStatus = "loading";
        state.error = null;
      })
      .addCase(fetchSkills.fulfilled, (state, action) => {
        state.listStatus = "succeeded";
        state.list = action.payload;
      })
      .addCase(fetchSkills.rejected, (state, action) => {
        state.listStatus = "failed";
        state.error = action.payload;
      })
      .addCase(fetchSkill.pending, (state) => {
        state.currentStatus = "loading";
      })
      .addCase(fetchSkill.fulfilled, (state, action) => {
        state.currentStatus = "succeeded";
        state.current = action.payload;
      })
      .addCase(fetchSkill.rejected, (state, action) => {
        state.currentStatus = "failed";
        state.error = action.payload;
      })
      .addCase(fetchSkillVersions.fulfilled, (state, action) => {
        state.versions = action.payload;
      })
      .addCase(logout, () => initialState);
    for (const t of [createSkill, updateSkill, resetSkillSettings, uploadSkillFile, updateSkillReference, removeSkillReference, restoreSkillVersion])
      builder.addCase(t.fulfilled, (state, action) => replace(state, action.payload));
  },
});

export default aiSkillsSlice.reducer;
