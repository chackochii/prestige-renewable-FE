// Superadmin routes (ADM only): business-unit lifecycle. Deliberately outside
// the page registry so it can never be granted to other roles or toggled off.

import { lazy } from "react";
import SuperadminLayout from "@/layouts/superadminLayout";

const BusinessUnitsPage = lazy(() => import("@/pages/superadmin/BusinessUnitsPage"));

export const superadminRoutes = [
  {
    element: <SuperadminLayout />,
    children: [{ path: "superadmin", element: <BusinessUnitsPage /> }],
  },
];
