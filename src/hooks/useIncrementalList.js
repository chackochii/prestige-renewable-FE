// Renders a list a slice at a time without changing how it is fetched.
//
// For lists the app deliberately loads whole — because something on the page
// needs to see all of them — this keeps the cost off the DOM while leaving
// search, counts and guards working over the complete set. Where the *fetch*
// is what needs to be lazy, page the API instead (see useOpportunities).
//
// `resetKey` is whatever changes the list's meaning, usually the search term:
// when it changes the slice starts again from the top.

import { useCallback, useEffect, useState } from "react";

export function useIncrementalList(items = [], { step = 25, resetKey = null } = {}) {
  const [visible, setVisible] = useState(step);

  useEffect(() => {
    setVisible(step);
  }, [resetKey, step]);

  const showMore = useCallback(() => setVisible((current) => current + step), [step]);

  return {
    shown: items.slice(0, visible),
    loaded: Math.min(visible, items.length),
    total: items.length,
    hasMore: visible < items.length,
    showMore,
  };
}

export default useIncrementalList;
