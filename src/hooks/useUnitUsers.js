// People in the current business unit, split for the pickers on lead forms.
// Backed by the names-only directory endpoint (id, name, title, roles), which
// any member of the unit may read — the full user records stay behind
// admin.read on the Users screen.

import { useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import { fetchDirectory } from "@/slices/employeeSlice";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { usersWithRoleHint } from "@/constants/roles";

export function useUnitUsers() {
  const dispatch = useAppDispatch();
  const { unitId } = useBusinessUnit();
  const { items, unitId: loadedUnitId, status, error } = useAppSelector((s) => s.employee.directory);
  const loadedForUnit = loadedUnitId === unitId;

  useEffect(() => {
    if (!unitId || status === "loading") return;
    // A failed load for this unit stays failed until the unit changes — no retry storm.
    if (!loadedForUnit) dispatch(fetchDirectory(unitId));
  }, [unitId, status, loadedForUnit, dispatch]);

  const users = useMemo(() => (loadedForUnit && status === "succeeded" ? items : []), [items, loadedForUnit, status]);
  const active = useMemo(() => users.filter((u) => u.status === "active"), [users]);
  const estimators = useMemo(() => usersWithRoleHint(active, "estimator"), [active]);
  const sales = useMemo(() => usersWithRoleHint(active, "sales"), [active]);
  const siteOps = useMemo(() => usersWithRoleHint(active, "siteOps"), [active]);
  const byId = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  return {
    users,
    active,
    estimators,
    sales,
    siteOps,
    byId,
    status,
    error: loadedForUnit ? error : null,
    ready: loadedForUnit && status === "succeeded",
    userName: (id) => byId.get(Number(id))?.name || null,
  };
}
