// inbox slice: the notifications the API has stored for the signed-in user.
// Transient toasts live in notificationsSlice — different lifetime, different
// data. Rows arriving live over SSE land here through notificationReceived.

import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import * as api from "@/services/api/notificationsApi";
import { logout } from "./authSlice";

const initialState = {
  items: [],
  total: 0,
  unread: 0,
  query: null,
  status: "idle",
  error: null,
  events: [], // catalogue from the API, for labels and the filter
};

const reject = (err, rejectWithValue) => rejectWithValue(err.message);

export const fetchNotifications = createAsyncThunk("inbox/fetchAll", async (params = {}, { rejectWithValue }) => {
  try {
    const result = await api.listNotifications(params);
    return { ...result, query: params };
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const fetchUnreadCount = createAsyncThunk("inbox/unreadCount", async (_, { rejectWithValue }) => {
  try {
    return await api.getUnreadCount();
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const fetchNotificationEvents = createAsyncThunk("inbox/events", async (_, { rejectWithValue }) => {
  try {
    return await api.listNotificationEvents();
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const markNotificationRead = createAsyncThunk("inbox/markRead", async (id, { rejectWithValue }) => {
  try {
    return await api.markNotificationRead(id, true);
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

export const markAllNotificationsRead = createAsyncThunk("inbox/markAllRead", async (_, { rejectWithValue }) => {
  try {
    return await api.markAllNotificationsRead();
  } catch (err) {
    return reject(err, rejectWithValue);
  }
});

const inboxSlice = createSlice({
  name: "inbox",
  initialState,
  reducers: {
    /** A notification pushed down the live stream. */
    notificationReceived(state, action) {
      const incoming = action.payload;
      if (!incoming?.id || state.items.some((n) => n.id === incoming.id)) return;
      // Only prepend when the list being shown would include it; otherwise the
      // count still moves and the next load picks it up.
      const filter = state.query || {};
      const matchesFilter =
        (!filter.priority || filter.priority === incoming.priority) && (!filter.event || filter.event === incoming.event);
      if (matchesFilter) {
        state.items.unshift(incoming);
        state.total += 1;
      }
      if (!incoming.read) state.unread += 1;
    },
    /** Unread count as reported by the stream's ready event. */
    unreadCountReceived(state, action) {
      state.unread = Math.max(0, Number(action.payload) || 0);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchNotifications.pending, (state, action) => {
        state.status = "loading";
        state.error = null;
        state.query = action.meta.arg ?? {};
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.items = action.payload.items;
        state.total = action.payload.total;
        state.unread = action.payload.unread;
        state.query = action.payload.query;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.payload;
      })
      .addCase(fetchUnreadCount.fulfilled, (state, action) => {
        state.unread = action.payload?.unread ?? 0;
      })
      .addCase(fetchNotificationEvents.fulfilled, (state, action) => {
        state.events = action.payload || [];
      })
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        const row = state.items.find((n) => n.id === action.payload.id);
        if (row && !row.read) state.unread = Math.max(0, state.unread - 1);
        if (row) row.read = true;
        // An unread-only list drops it once read.
        if (state.query?.unread) state.items = state.items.filter((n) => n.id !== action.payload.id);
      })
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.items = state.query?.unread ? [] : state.items.map((n) => ({ ...n, read: true }));
        state.unread = 0;
      })
      .addCase(logout, () => initialState);
  },
});

export const { notificationReceived, unreadCountReceived } = inboxSlice.actions;
export default inboxSlice.reducer;
