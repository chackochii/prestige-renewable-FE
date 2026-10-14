// Writes to the URL's query string (?q=…&page=…) without losing a change.
//
// React Router's setSearchParams works from the query string as it was when
// the component rendered, so two changes made in the same moment overwrite
// each other: typing a search and the page going back to 1 happen in the same
// commit, and one of them was lost (so was every filter but the last when
// "Clear filters" reset several at once). Changes made in the same tick are
// gathered here onto the live URL and written once.
//
//   const write = useSearchParamWriter();
//   write((params) => params.set("q", "smith"));            // replace (default)
//   write((params) => params.delete("stage"), { replace: false }); // a history step
//
// Every write keeps the scroll where it is: a filter or page change is not a
// new page (the layout's ScrollRestoration would otherwise jump to the top).

import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

let pending = null; // { params, replace, setParams } waiting for the end of this tick

function queue(setParams, mutate, { replace = true } = {}) {
  if (!pending) {
    pending = { params: new URLSearchParams(window.location.search), replace: true, setParams };
    queueMicrotask(() => {
      const { params, replace: asReplace, setParams: write } = pending;
      pending = null;
      // Nothing changed: no navigation at all (it would still be a history step).
      if (params.toString() === new URLSearchParams(window.location.search).toString()) return;
      write(params, { replace: asReplace, preventScrollReset: true });
    });
  }
  mutate(pending.params);
  // One push among the changes makes the whole write a history step.
  pending.replace = pending.replace && replace;
  pending.setParams = setParams;
}

export function useSearchParamWriter() {
  const [, setParams] = useSearchParams();
  return useCallback((mutate, options) => queue(setParams, mutate, options), [setParams]);
}

export default useSearchParamWriter;
