// Opportunities in the current business unit, refetched when the unit or the
// requested filters change. Pass { enabled: false } to skip the request (for
// example when the person cannot read leads) — the hook then reports an
// empty, ready list without hitting the API.
//
// Pass { pageSize } to load the list a page at a time and use `loadMore`. The
// default stays high on purpose: screens like Home and Quotes derive totals by
// filtering the whole array, and a smaller page would quietly make those
// figures wrong. Opting in is per screen, and only the screens that render a
// "load more" control should do it.

import { useCallback, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import { fetchOpportunities } from "@/slices/leadsSlice";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";

const sameQuery = (a, b) => JSON.stringify(a || null) === JSON.stringify(b || null);

export function useOpportunities(filters = {}, { enabled = true, pageSize = 200 } = {}) {
  const dispatch = useAppDispatch();
  const { unitId } = useBusinessUnit();
  const { items, total, page, status, error, query } = useAppSelector((s) => s.leads);
  const wanted = enabled && unitId ? { businessUnitId: unitId, ...filters } : null;
  const wantedKey = JSON.stringify(wanted);

  useEffect(() => {
    if (!wanted) return;
    if (status === "loading") return;
    if (status === "idle" || !sameQuery(query, wanted)) dispatch(fetchOpportunities({ ...wanted, page: 1, pageSize }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedKey, status, pageSize, dispatch]);

  const reload = useCallback(() => {
    if (wanted) dispatch(fetchOpportunities({ ...wanted, page: 1, pageSize }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedKey, pageSize, dispatch]);

  const ready = status === "succeeded" && sameQuery(query, wanted);
  const loaded = ready ? items.length : 0;
  const hasMore = ready && loaded < total;

  const loadMore = useCallback(() => {
    if (!wanted || !hasMore || status === "loading") return;
    dispatch(fetchOpportunities({ ...wanted, page: page + 1, pageSize, append: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantedKey, hasMore, status, page, pageSize, dispatch]);

  if (!enabled)
    return { items: [], total: 0, loaded: 0, status: "succeeded", error: null, ready: true, hasMore: false, reload, loadMore };

  return {
    items: ready ? items : [],
    total,
    loaded,
    status,
    error: sameQuery(query, wanted) ? error : null,
    ready,
    hasMore,
    // True only while a *further* page is on its way, so the list stays put
    // instead of flashing its loading state.
    loadingMore: status === "loading" && loaded > 0,
    reload,
    loadMore,
  };
}
