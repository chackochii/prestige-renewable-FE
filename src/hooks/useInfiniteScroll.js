// Calls `onMore` when a sentinel element scrolls into view. Attach the returned
// ref to an element at the end of a list:
//
//   const sentinel = useInfiniteScroll({ onMore: loadMore, enabled: hasMore });
//   <div ref={sentinel} />
//
// The observer fires a little before the sentinel is actually visible, so the
// next page is usually there by the time the person reaches the bottom. A
// button should always sit alongside it — the observer is the convenience, not
// the only way to load more (see components/LoadMore).

import { useEffect, useRef } from "react";

export function useInfiniteScroll({ onMore, enabled = true, rootMargin = "320px" } = {}) {
  const ref = useRef(null);
  // Held in a ref so a new onMore on every render does not tear down and
  // rebuild the observer, which would make it fire again immediately.
  const handler = useRef(onMore);

  useEffect(() => {
    handler.current = onMore;
  }, [onMore]);

  useEffect(() => {
    const node = ref.current;
    // No node, nothing more to load, or an environment without the API (jsdom,
    // an old browser): the button in LoadMore still works.
    if (!node || !enabled || typeof IntersectionObserver === "undefined") return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) handler.current?.();
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [enabled, rootMargin]);

  return ref;
}

export default useInfiniteScroll;
