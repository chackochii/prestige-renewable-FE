// Superadmin routes (ADM only): business-unit lifecycle and the reference data
// every unit shares (DNSP networks, the quote catalog). Deliberately outside
// the page registry so it can never be granted to other roles or toggled off.

import { lazy } from "react";
import SuperadminLayout from "@/layouts/superadminLayout";

const BusinessUnitsPage = lazy(() => import("@/pages/superadmin/BusinessUnitsPage"));
const DnspNetworksPage = lazy(() => import("@/pages/superadmin/DnspNetworksPage"));
const CatalogPage = lazy(() => import("@/pages/superadmin/CatalogPage"));

export const superadminRoutes = [
  {
    element: <SuperadminLayout />,
    children: [
      { path: "superadmin", element: <BusinessUnitsPage /> },
      { path: "superadmin/dnsp-networks", element: <DnspNetworksPage /> },
      { path: "superadmin/catalog", element: <CatalogPage /> },
    ],
  },
];
