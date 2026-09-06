// pages slice: the page registry the sidebar is built from.

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as api from "@/services/api/pagesApi";
import { logout } from "./authSlice";

const initialState = {
  items: [],
  status: "idle",
  error: null,
};

const reject = (err, rejectWithValue) => rejectWithValue(err.message);

export const fetchPages = createAsyncThunk("pages/fetchAll", async (_, { rejectWithValue }) => {
  try {
    return await api.listPages();
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const createPage = createAsyncThunk("pages/create", async (body, { rejectWithValue }) => {
  try {
    return await api.createPage(body);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const updatePage = createAsyncThunk("pages/update", async ({ code, body }, { rejectWithValue }) => {
  try {
    return await api.updatePage(code, body);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const removePage = createAsyncThunk("pages/remove", async (code, { rejectWithValue }) => {
  try {
    await api.deletePage(code);
    return code;
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

const sortPages = (items) => items.sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code));

const pagesSlice = createSlice({
  name: "pages",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchPages.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(fetchPages.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.items = sortPages([...action.payload]);
      })
      .addCase(fetchPages.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })
      .addCase(createPage.fulfilled, (state, action) => {
        state.items = sortPages([...state.items, action.payload]);
      })
      .addCase(updatePage.fulfilled, (state, action) => {
        state.items = sortPages(state.items.map((p) => (p.code === action.payload.code ? action.payload : p)));
      })
      .addCase(removePage.fulfilled, (state, action) => {
        state.items = state.items.filter((p) => p.code !== action.payload);
      })
      .addCase(logout, () => initialState);
  },
});

export default pagesSlice.reducer;
