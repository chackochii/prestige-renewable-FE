// Business unit hook: the unit being worked in, the units available, switching.

import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import { fetchBusinessUnits, selectCurrentUnit, setCurrentUnit } from "@/slices/businessUnitsSlice";

export function useBusinessUnit() {
  const dispatch = useAppDispatch();
  const unit = useAppSelector(selectCurrentUnit);
  const { items: units, status, error } = useAppSelector((s) => s.businessUnits);
  const userId = useAppSelector((s) => s.auth.user?.id);

  const switchUnit = useCallback(
    (unitId) => {
      const id = Number(unitId);
      if (units.some((u) => u.id === id)) dispatch(setCurrentUnit(id, userId));
    },
    [dispatch, units, userId],
  );

  const reload = useCallback(() => dispatch(fetchBusinessUnits()), [dispatch]);

  return { unit, unitId: unit?.id ?? null, units, status, error, switchUnit, reload };
}
