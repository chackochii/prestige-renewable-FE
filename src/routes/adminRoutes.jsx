// Workspace routes. Every screen sits under the app shell; which ones a
// person can open is decided by RequirePage (registry page + permission +
// unit toggle) or RequirePermission (module actions), never by role name.
//
// Screens are lazy-loaded so each page ships as its own chunk; AdminLayout
// renders the Suspense fallback while a chunk downloads.
//
// `workspaceRoutes` is the list of known screens. RequireAuth uses it to tell
// a protected URL (→ sign in, then come back) from an unknown one (→ 404).

import { lazy } from "react";
import { Navigate } from "react-router-dom";
import { RequireAuth, RequirePage, RequirePermission } from "./routeGuards";
import { superadminRoutes } from "./superadminRoutes";
import { PAGE_CODES, PERMISSIONS } from "@/constants/permissions";
import AdminLayout from "@/layouts/adminLayout";
import ForbiddenPage from "@/pages/public/ForbiddenPage";
import NotFoundPage from "@/pages/public/NotFoundPage";
import RouteErrorPage from "@/pages/public/RouteErrorPage";

const LandingPage = lazy(() => import("@/pages/public/LandingPage"));
const HomePage = lazy(() => import("@/pages/admin/HomePage"));
const LeadsPage = lazy(() => import("@/pages/admin/LeadsPage"));
const NewLeadPage = lazy(() => import("@/pages/admin/NewLeadPage"));
const OpportunityPage = lazy(() => import("@/pages/admin/OpportunityPage"));
const PipelinePage = lazy(() => import("@/pages/admin/PipelinePage"));
const MarketingPage = lazy(() => import("@/pages/admin/MarketingPage"));
const ApprovalsPage = lazy(() => import("@/pages/admin/ApprovalsPage"));
const ProcurementPage = lazy(() => import("@/pages/admin/ProcurementPage"));
const ConstructionPage = lazy(() => import("@/pages/admin/ConstructionPage"));
const QuotesPage = lazy(() => import("@/pages/admin/QuotesPage"));
const CostsPage = lazy(() => import("@/pages/admin/CostsPage"));
const InvoicingPage = lazy(() => import("@/pages/admin/InvoicingPage"));
const WarrantyPage = lazy(() => import("@/pages/admin/WarrantyPage"));
const ReferralsPage = lazy(() => import("@/pages/admin/ReferralsPage"));
const DashboardsPage = lazy(() => import("@/pages/admin/DashboardsPage"));
const NotificationsPage = lazy(() => import("@/pages/admin/NotificationsPage"));
const UsersPage = lazy(() => import("@/pages/admin/UsersPage"));
const RolesPage = lazy(() => import("@/pages/admin/RolesPage"));
const PagesPage = lazy(() => import("@/pages/admin/PagesPage"));
const UnitSettingsPage = lazy(() => import("@/pages/admin/UnitSettingsPage"));

const page = (code, element) => <RequirePage code={code}>{element}</RequirePage>;
const permission = (code, element) => <RequirePermission permission={code}>{element}</RequirePermission>;

export const workspaceRoutes = [
  { index: true, element: <HomePage /> },
  { path: "leads", element: page(PAGE_CODES.LEADS, <LeadsPage />) },
  { path: "leads/new", element: permission(PERMISSIONS.LEADS_CREATE, <NewLeadPage />) },
  { path: "opportunities", element: <Navigate to="/pipeline" replace /> },
  { path: "opportunities/:id", element: permission(PERMISSIONS.LEADS_READ, <OpportunityPage />) },
  { path: "pipeline", element: page(PAGE_CODES.PIPELINE, <PipelinePage />) },
  { path: "marketing", element: page(PAGE_CODES.MARKETING, <MarketingPage />) },
  { path: "approvals", element: page(PAGE_CODES.APPROVALS, <ApprovalsPage />) },
  { path: "procurement", element: page(PAGE_CODES.PROCUREMENT, <ProcurementPage />) },
  { path: "construction", element: page(PAGE_CODES.CONSTRUCTION, <ConstructionPage />) },
  { path: "quotes", element: page(PAGE_CODES.QUOTES, <QuotesPage />) },
  { path: "costs", element: page(PAGE_CODES.COSTS, <CostsPage />) },
  { path: "billing", element: page(PAGE_CODES.BILLING, <InvoicingPage />) },
  { path: "warranty", element: page(PAGE_CODES.WARRANTY, <WarrantyPage />) },
  { path: "referrers", element: page(PAGE_CODES.REFERRERS, <ReferralsPage />) },
  { path: "dashboards", element: page(PAGE_CODES.DASHBOARDS, <DashboardsPage />) },
  { path: "notifications", element: <NotificationsPage /> },
  { path: "admin", element: page(PAGE_CODES.ADMIN, <UsersPage />) },
  { path: "admin/users", element: <Navigate to="/admin" replace /> },
  { path: "admin/roles", element: page(PAGE_CODES.ADMIN, <RolesPage />) },
  { path: "admin/pages", element: page(PAGE_CODES.ADMIN, <PagesPage />) },
  { path: "admin/settings", element: page(PAGE_CODES.ADMIN, <UnitSettingsPage />) },
  ...superadminRoutes,
  // Legacy / convenience aliases
  { path: "home", element: <Navigate to="/" replace /> },
  { path: "dashboard", element: <Navigate to="/" replace /> },
  { path: "settings", element: <Navigate to="/admin/settings" replace /> },
  { path: "forbidden", element: <ForbiddenPage /> },
];

export const adminRoutes = [
  {
    element: <RequireAuth fallback={<LandingPage />} routes={workspaceRoutes} />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        path: "/",
        element: <AdminLayout />,
        children: [...workspaceRoutes, { path: "*", element: <NotFoundPage /> }],
      },
    ],
  },
];
