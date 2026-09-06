// Public routes: sign in / sign out. The landing page is served on "/" by
// RequireAuth when nobody is signed in (see adminRoutes.jsx).

import PublicLayout from "@/layouts/publicLayout";
import LoginPage from "@/pages/public/LoginPage";
import LogoutPage from "@/pages/public/LogoutPage";
import RouteErrorPage from "@/pages/public/RouteErrorPage";
import { RedirectIfAuthenticated } from "./routeGuards";

export const publicRoutes = [
  {
    element: <PublicLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        path: "/login",
        element: (
          <RedirectIfAuthenticated>
            <LoginPage />
          </RedirectIfAuthenticated>
        ),
      },
      { path: "/logout", element: <LogoutPage /> },
    ],
  },
];
