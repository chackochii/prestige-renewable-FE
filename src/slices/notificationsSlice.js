// notifications slice: transient in-app toasts.

import { createSlice, nanoid } from "@reduxjs/toolkit";

const initialState = {
  toasts: [],
};

const notificationsSlice = createSlice({
  name: "notifications",
  initialState,
  reducers: {
    pushToast: {
      reducer(state, action) {
        state.toasts.push(action.payload);
      },
      prepare({ message, tone = "success" }) {
        return { payload: { id: nanoid(), message, tone, leaving: false } };
      },
    },
    startDismissToast(state, action) {
      const toast = state.toasts.find((t) => t.id === action.payload);
      if (toast) toast.leaving = true;
    },
    dismissToast(state, action) {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
    clearToasts(state) {
      state.toasts = [];
    },
  },
});

export const { pushToast, startDismissToast, dismissToast, clearToasts } = notificationsSlice.actions;
export default notificationsSlice.reducer;
