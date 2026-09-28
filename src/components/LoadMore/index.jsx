// The foot of a lazily-loaded list: how much is showing, and the means to get
// the rest. Scrolling here loads the next page on its own; the button is there
// for keyboard users, for anyone whose browser lacks IntersectionObserver, and
// for when auto-loading has already run and the person wants to insist.

import LoadingState from "@/components/LoadingState";
import { useInfiniteScroll } from "@/hooks/useInfiniteScroll";

export default function LoadMore({ loaded, total, hasMore, loading = false, onMore, noun = "records" }) {
  const sentinel = useInfiniteScroll({ onMore, enabled: hasMore && !loading });

  // Nothing loaded yet: the list's own empty or loading state covers it.
  if (!loaded) return null;

  return (
    <div className="load-more" ref={sentinel}>
      <span className="row-meta">
        Showing {loaded} of {total} {noun}
      </span>
      {loading ? (
        <LoadingState label="Loading more…" />
      ) : hasMore ? (
        <button type="button" className="btn btn-ghost btn-sm" onClick={onMore}>
          Load more
        </button>
      ) : (
        <span className="row-meta">All loaded</span>
      )}
    </div>
  );
}
