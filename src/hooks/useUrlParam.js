// A list's search and filters kept in the URL (?q=smith&owner=12), next to
// its page, so opening a record and pressing Back finds the list exactly as
// it was — before, only the page survived and the search box came back empty,
// showing page 2 of everything.
//
//   const [owner, setOwner] = useUrlParam("owner");          // a select
//   const { search, setSearch, term } = useUrlSearch();      // a search box (?q=)
//
// Both write with replace by default — picking a filter or typing is not a
// step Back should retrace — through useSearchParamWriter, which merges them
// with the page reset that follows.

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDebouncedValue } from "./useDebouncedValue";
import { useSearchParamWriter } from "./useSearchParamWriter";

/** One query-string value: [value, setValue]. An empty value (or the fallback) leaves the URL clean. */
export function useUrlParam(key, fallback = "", { replace = true } = {}) {
  const [params] = useSearchParams();
  const write = useSearchParamWriter();
  const value = params.get(key) ?? fallback;
  const setValue = useCallback(
    (next) =>
      write(
        (updated) => {
          const text = next === null || next === undefined ? "" : String(next);
          if (!text || text === fallback) updated.delete(key);
          else updated.set(key, text);
        },
        { replace },
      ),
    [write, key, fallback, replace],
  );
  return [value, setValue];
}

/**
 * A search box kept in the URL. `search` / `setSearch` drive the input and
 * change at once as the person types; `term` is the trimmed, settled value the
 * list is asked for, and is what goes into ?q=. The box starts from the URL.
 * (The input is not driven from the URL itself: the router updates it a
 * moment later, which would drop keystrokes.)
 */
export function useUrlSearch(key = "q", delay = 300) {
  const [stored, setStored] = useUrlParam(key);
  const [search, setSearch] = useState(stored);
  const term = useDebouncedValue(search.trim(), delay);
  useEffect(() => {
    if (term !== stored) setStored(term);
    // Only when the settled term changes — the URL follows the box, not the reverse.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [term]);
  return { search, setSearch, term };
}

export default useUrlParam;
