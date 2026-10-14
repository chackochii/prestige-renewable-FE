// The page a list is on, kept in the URL (?page=2) so opening a record and
// coming back — or sending the link — lands on the same page. Page 1 leaves
// the URL clean.
//
//   const [page, setPage] = usePageParam(filtersKey);
//   setPage(3);                      // a history step: Back returns to the page before
//   setPage(2, { replace: true });   // a correction, not a step (Pagination's clamp)
//
// `resetKey` is whatever changes the list's meaning (its search and filters,
// as a string): when it changes the list goes back to page 1. Writes go
// through useSearchParamWriter, which keeps the scroll where it is (Pagination
// brings the list into view itself) and merges with a search or filter
// written in the same moment.

import { useCallback, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { useSearchParamWriter } from "./useSearchParamWriter";

export function usePageParam(resetKey = "") {
  const [params] = useSearchParams();
  const writeParams = useSearchParamWriter();
  const page = Math.max(1, Math.trunc(Number(params.get("page"))) || 1);

  const write = useCallback(
    (next, replace) =>
      writeParams(
        (updated) => {
          if (next > 1) updated.set("page", String(next));
          else updated.delete("page");
        },
        { replace },
      ),
    [writeParams],
  );
  const setPage = useCallback((next, { replace = false } = {}) => write(next, replace), [write]);

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
