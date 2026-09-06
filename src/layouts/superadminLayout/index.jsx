// Superadmin (ADM) only — sits inside the workspace shell.

import { Outlet } from "react-router-dom";
import { RequireRole } from "@/routes/routeGuards";
import { SUPER_ROLE_CODE } from "@/constants/roles";

export default function SuperadminLayout() {
  return (
    <RequireRole roles={[SUPER_ROLE_CODE]}>
      <Outlet />
    </RequireRole>
  );
}
