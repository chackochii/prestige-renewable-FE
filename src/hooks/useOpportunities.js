// Opportunities in the current business unit, refetched when the unit or the
// requested filters change. Pass { enabled: false } to skip the request (for
// example when the person cannot read leads) — the hook then reports an
// empty, ready list without hitting the API.

import { useCallback, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import { fetchOpportunities } from "@/slices/leadsSlice";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";

const sameQuery = (a, b) => JSON.stringify(a || null) === JSON.stringify(b || null);

export function useOpportunities(filters = {}, { enabled = true } = {}) {
  const dispatch = useAppDispatch();
  const { unitId } = useBusinessUnit();
  const { items, total, status, error, query } = useAppSelector((s) => s.leads);
  const wanted = enabled && unitId ? { businessUnitId: unitId, ...filters } : null;
  const wantedKey = JSON.stringify(wanted);

  useEffect(() => {
    if (!wanted) return;
    if (status === "loading") return;
    if (status === "idle" || !sameQuery(query, wanted)) dispatch(fetchOpportunities(wanted));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedKey, status, dispatch]);

  const reload = useCallback(() => {
    if (wanted) dispatch(fetchOpportunities(wanted));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedKey, dispatch]);

  if (!enabled) return { items: [], total: 0, status: "succeeded", error: null, ready: true, reload };

  const ready = status === "succeeded" && sameQuery(query, wanted);
  return { items: ready ? items : [], total, status, error: sameQuery(query, wanted) ? error : null, ready, reload };
}
