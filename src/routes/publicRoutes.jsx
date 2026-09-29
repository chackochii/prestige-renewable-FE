// Public routes: sign in / sign out and the website enquiry form. The landing
// page is served on "/" by RequireAuth when nobody is signed in (see
// adminRoutes.jsx).

import PublicLayout from "@/layouts/publicLayout";
import EnquiryPage from "@/pages/public/EnquiryPage";
import LoginPage from "@/pages/public/LoginPage";
import LogoutPage from "@/pages/public/LogoutPage";
import SiteVisitPage from "@/pages/public/SiteVisitPage";
import ProposalPage from "@/pages/public/ProposalPage";
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
      // Anyone can reach this, signed in or not: it is a lead-capture form, not an app screen.
      { path: "/enquiry", element: <EnquiryPage /> },
      // Same again for the site-visit report: the token in the link is the
      // whole of the caller's authority, so no sign-in and no app shell.
      { path: "/site-visit/:token", element: <SiteVisitPage /> },
      // The customer's proposal, from the link in the email sales sent them.
      { path: "/proposal/:token", element: <ProposalPage /> },
    ],
  },
];
