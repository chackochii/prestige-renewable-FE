// Redux store config, root reducer

import { configureStore } from "@reduxjs/toolkit";
import { useDispatch, useSelector } from "react-redux";
import { setForbiddenHandler, setUnauthorizedHandler } from "@/services/api/client";
import { loadSession, SESSION_STORAGE_KEY } from "@/services/api/tokenStore";

import authReducer, { adoptSession, fetchMe, logout, SESSION_NOTICES } from "@/slices/authSlice";
import businessUnitsReducer from "@/slices/businessUnitsSlice";
import pagesReducer from "@/slices/pagesSlice";
import rolesReducer from "@/slices/rolesSlice";
import leadsReducer from "@/slices/leadsSlice";
import estimationReducer from "@/slices/estimationSlice";
import catalogReducer from "@/slices/catalogSlice";
import dnspNetworksReducer from "@/slices/dnspNetworksSlice";
import collaborationReducer from "@/slices/collaborationSlice";
import approvalsReducer from "@/slices/approvalsSlice";
import procurementReducer from "@/slices/procurementSlice";
import constructionReducer from "@/slices/constructionSlice";
import invoicingReducer from "@/slices/invoicingSlice";
import warrantyReducer from "@/slices/warrantySlice";
import referralsReducer from "@/slices/referralsSlice";
import dlpOmReducer from "@/slices/dlpOmSlice";
import employeeReducer from "@/slices/employeeSlice";
import notificationsReducer from "@/slices/notificationsSlice";
import inboxReducer from "@/slices/inboxSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    businessUnits: businessUnitsReducer,
    pages: pagesReducer,
    roles: rolesReducer,
    leads: leadsReducer,
    estimation: estimationReducer,
    catalog: catalogReducer,
    dnspNetworks: dnspNetworksReducer,
    collaboration: collaborationReducer,
    approvals: approvalsReducer,
    procurement: procurementReducer,
    construction: constructionReducer,
    invoicing: invoicingReducer,
    warranty: warrantyReducer,
    referrals: referralsReducer,
    dlpOm: dlpOmReducer,
    employee: employeeReducer,
    notifications: notificationsReducer,
    inbox: inboxReducer,
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

// Every tab shares the stored session, but each holds its own copy in memory.
// When another tab signs in or out, this one follows (the `storage` event
// fires in every tab except the one that wrote):
//  - signed out there → signed out here too;
//  - the same person signed in again → carry on with the new token;
//  - somebody else signed in → nothing from the first person's session may
//    stay on screen or be sent under the new token: end it here (every slice
//    resets on logout) and continue as the new person.
if (typeof window !== "undefined") {
  window.addEventListener("storage", (event) => {
    if (event.key !== SESSION_STORAGE_KEY && event.key !== null) return; // null: storage cleared
    const { token, user } = store.getState().auth;
    const next = loadSession();
    // `elsewhere`: this tab only follows — the stored session is the other tab's.
    if (!next?.token) {
      if (token) store.dispatch(logout({ notice: SESSION_NOTICES.SIGNED_OUT, elsewhere: true }));
      return;
    }
    if (next.token === token) return;
    if (token && next.user?.id !== user?.id) store.dispatch(logout({ notice: SESSION_NOTICES.SIGNED_OUT, elsewhere: true }));
    store.dispatch(adoptSession(next));
  });
}

export const useAppDispatch = useDispatch;
export const useAppSelector = useSelector;
