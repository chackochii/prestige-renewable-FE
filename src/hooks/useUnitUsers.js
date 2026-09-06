// People in the current business unit, split for the pickers on lead forms.

import { useEffect, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import { fetchUsers } from "@/slices/employeeSlice";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { usersWithRoleHint } from "@/constants/roles";

export function useUnitUsers() {
  const dispatch = useAppDispatch();
  const { unitId } = useBusinessUnit();
  const { items, status, query } = useAppSelector((s) => s.employee);
  const loadedForUnit = query?.businessUnitId === unitId && !query?.allUnits;

  useEffect(() => {
    if (!unitId || status === "loading") return;
    if (status === "idle" || !loadedForUnit) dispatch(fetchUsers({ businessUnitId: unitId }));
  }, [unitId, status, loadedForUnit, dispatch]);

  const users = useMemo(() => (loadedForUnit ? items : []), [items, loadedForUnit]);
  const active = useMemo(() => users.filter((u) => u.status === "active"), [users]);
  const estimators = useMemo(() => usersWithRoleHint(active, "estimator"), [active]);
  const sales = useMemo(() => usersWithRoleHint(active, "sales"), [active]);
  const byId = useMemo(() => new Map(users.map((u) => [u.id, u])), [users]);

  return {
    users,
    active,
    estimators,
    sales,
    byId,
    status,
    ready: loadedForUnit && status === "succeeded",
    userName: (id) => byId.get(Number(id))?.name || null,
  };
}
