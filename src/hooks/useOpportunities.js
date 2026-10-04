// Opportunities in the current business unit, one page at a time, refetched
// when the unit, the filters or the page change. Pass { enabled: false } to
// skip the request (for example when the person cannot read leads) — the hook
// then reports an empty, ready list without hitting the API.
//
// { page, pageSize } pick the page; filters and search go in `filters` and
// are applied by the API across every record, newest first. The default page
// size stays high on purpose: Home and the other summary screens derive their
// figures from the whole list.
//
// While a different page of the same list is on its way, the rows already on
// screen stay put (`loading` says so) rather than flashing a loading state.

import { useCallback, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import { fetchOpportunities } from "@/slices/leadsSlice";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";

const sameQuery = (a, b) => JSON.stringify(a || null) === JSON.stringify(b || null);

export function useOpportunities(filters = {}, { enabled = true, page = 1, pageSize = 200 } = {}) {
  const dispatch = useAppDispatch();
  const { unitId } = useBusinessUnit();
  const held = useAppSelector((s) => s.leads);
  const wanted = enabled && unitId ? { businessUnitId: unitId, ...filters } : null;
  const wantedKey = JSON.stringify(wanted);

  const sameList = sameQuery(held.query, wanted);
  const current = sameList && held.page === page && held.pageSize === pageSize;
  // Already asked for this very page — answered, on its way, or failed. A
  // failure is not asked for again on its own (that would loop); reload() does.
  const asked = wanted ? sameQuery(held.requested, { ...wanted, page, pageSize }) : true;

  useEffect(() => {
    if (!wanted) return;
    if (held.status === "loading") return;
    if (held.status === "idle" || !asked) dispatch(fetchOpportunities({ ...wanted, page, pageSize }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedKey, held.status, asked, page, pageSize, dispatch]);

  const reload = useCallback(() => {
    if (wanted) dispatch(fetchOpportunities({ ...wanted, page, pageSize }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedKey, page, pageSize, dispatch]);

  if (!enabled) return { items: [], total: 0, totals: null, status: "succeeded", error: null, ready: true, loading: false, reload };

  const ready = held.status === "succeeded" && current;
  // Another page of the same list: keep showing what is there until it lands.
  const showing = ready || (sameList && held.status === "loading");
  return {
    items: showing ? held.items : [],
    total: sameList ? held.total : 0,
    totals: sameList ? held.totals : null,
    status: held.status,
    error: sameList ? held.error : null,
    ready,
    loading: held.status === "loading",
    reload,
  };
}
