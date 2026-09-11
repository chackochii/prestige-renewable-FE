// Redux store config, root reducer

import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import { setForbiddenHandler, setUnauthorizedHandler } from "@/services/api/client";

import authReducer, { fetchMe, logout, SESSION_NOTICES } from "@/slices/authSlice";
import businessUnitsReducer from "@/slices/businessUnitsSlice";
import pagesReducer from "@/slices/pagesSlice";
import rolesReducer from "@/slices/rolesSlice";
import leadsReducer from "@/slices/leadsSlice";
import estimationReducer from "@/slices/estimationSlice";
import catalogReducer from "@/slices/catalogSlice";
import approvalsReducer from "@/slices/approvalsSlice";
import procurementReducer from "@/slices/procurementSlice";
import constructionReducer from "@/slices/constructionSlice";
import invoicingReducer from "@/slices/invoicingSlice";
import warrantyReducer from "@/slices/warrantySlice";
import referralsReducer from "@/slices/referralsSlice";
import dlpOmReducer from "@/slices/dlpOmSlice";
import employeeReducer from "@/slices/employeeSlice";
import notificationsReducer from "@/slices/notificationsSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    businessUnits: businessUnitsReducer,
    pages: pagesReducer,
    roles: rolesReducer,
    leads: leadsReducer,
    estimation: estimationReducer,
    catalog: catalogReducer,
    approvals: approvalsReducer,
    procurement: procurementReducer,
    construction: constructionReducer,
    invoicing: invoicingReducer,
    warranty: warrantyReducer,
    referrals: referralsReducer,
    dlpOm: dlpOmReducer,
    employee: employeeReducer,
    notifications: notificationsReducer,
  },
});

// When the API rejects the session (expired token, disabled account) drop it
// everywhere at once; the route guards then send the person to /login and
// bring them back to the same page after they sign in again.
setUnauthorizedHandler(({ reason } = {}) => {
  if (!store.getState().auth.token) return;
  const notice = reason === "expired" ? SESSION_NOTICES.EXPIRED : SESSION_NOTICES.UNAUTHORIZED;
  store.dispatch(logout({ notice }));
});

// A 403 usually means the person's grants changed since they signed in (a
// role edited, a page turned off for the unit). Refresh their permissions so
// the sidebar and buttons catch up, at most once every few seconds.
let lastPermissionSync = 0;
setForbiddenHandler(() => {
  const { token, status } = store.getState().auth;
  if (!token || status === "loading") return;
  if (Date.now() - lastPermissionSync < 5000) return;
  lastPermissionSync = Date.now();
  store.dispatch(fetchMe());
});

export const useAppDispatch = useDispatch;
export const useAppSelector = useSelector;
