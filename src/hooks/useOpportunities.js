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
// Every visit to a screen asks again: the list held may be from an earlier
// visit, and records move on while it sits there (a lead advanced, a job
// created elsewhere). The rows held are shown meanwhile, dimmed by `loading`.
//
// While another page of the *same* list is on its way, the rows already on
// screen stay put rather than flashing a loading state. A *different* list
// (other filters) shows nothing of the previous one — not its rows, and not
// its total, which used to push the pager to the wrong page while loading.

import { useCallback, useEffect, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import { fetchOpportunities } from "@/slices/leadsSlice";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";

const sameQuery = (a, b) => JSON.stringify(a || null) === JSON.stringify(b || null);

export function useOpportunities(filters = {}, { enabled = true, page = 1, pageSize = 200 } = {}) {
  const dispatch = useAppDispatch();
  const { unitId } = useBusinessUnit();
  const held = useAppSelector((s) => s.leads);
  const wanted = enabled && unitId ? { businessUnitId: unitId, ...filters } : null;
  const params = wanted ? { ...wanted, page, pageSize } : null;
  const paramsKey = JSON.stringify(params);

  // The rows held belong to this list (some page of it) / to this very page.
  const sameList = sameQuery(held.query, wanted);
  const current = sameList && held.page === page && held.pageSize === pageSize;
  // The newest request is for this very page — answered, on its way, or
  // failed. A failure is not asked for again on its own (that would loop);
  // reload() does.
  const asked = params ? sameQuery(held.requested, params) : true;

  const visited = useRef(false);
  useEffect(() => {
    if (!params) return;
    if (visited.current && asked) return;
    visited.current = true;
    dispatch(fetchOpportunities(params));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey, asked, dispatch]);

  const reload = useCallback(() => {
    if (params) dispatch(fetchOpportunities(params));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paramsKey, dispatch]);

  if (!enabled) return { items: [], total: 0, totals: null, status: "succeeded", error: null, ready: true, loading: false, reload };

  const loading = held.status === "loading";
  // Another page of the same list: keep showing what is there until it lands.
  const showing = current || (sameList && loading);
  return {
    items: showing ? held.items : [],
    total: sameList ? held.total : 0,
    totals: sameList ? held.totals : null,
    status: held.status,
    // The rows held are this very page (possibly being refreshed).
    ready: current,
    error: asked && held.status === "failed" ? held.error : null,
    loading,
    reload,
  };
}
