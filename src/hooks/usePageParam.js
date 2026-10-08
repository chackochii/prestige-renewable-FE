// The page a list is on, kept in the URL (?page=2) so opening a record and
// coming back — or sending the link — lands on the same page. Page 1 leaves
// the URL clean.
//
//   const [page, setPage] = usePageParam(filtersKey);
//
// `resetKey` is whatever changes the list's meaning (its search and filters,
// as a string): when it changes the list goes back to page 1. A page change is
// a history step of its own, so Back returns to the previous page.

import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

export function usePageParam(resetKey = "") {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Math.trunc(Number(params.get("page"))) || 1);

  const write = useCallback(
    (next, replace) =>
      setParams(
        (previous) => {
          const updated = new URLSearchParams(previous);
          if (next > 1) updated.set("page", String(next));
          else updated.delete("page");
          return updated;
        },
        { replace },
      ),
    [setParams],
  );
  const setPage = useCallback((next) => write(next, false), [write]);

  // New filters, new list: back to the first page (but not on the first render,
  // so a link to page 3 stays on page 3).
  const seen = useRef(resetKey);
  useEffect(() => {
    if (seen.current === resetKey) return;
    seen.current = resetKey;
    write(1, true);
  }, [resetKey, write]);

  return [page, setPage];
}

export default usePageParam;
