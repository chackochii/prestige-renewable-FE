// The foot of a paged list: "Showing 13–24 of 40 leads", then numbered page
// buttons — Previous, 1 2 3 … 9, Next. The current page is highlighted; on a
// phone the numbers give way to "Page 2 of 4" between Previous and Next.
//
// page / total / pageSize — where the list is; onPageChange(page) — go to a page.
// noun — what the rows are, for the summary.
//
// A page past the end (the list shrank under it: a filter, a record moving on)
// is pulled back to the last page there is. Changing page scrolls the top of
// the list back into view when it has gone off screen.

import { useEffect, useRef } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { PAGE_SIZE, pageWindow } from "@/helpers/pagination";

export default function Pagination({ page = 1, total = 0, pageSize = PAGE_SIZE, onPageChange, noun = "records", loading = false }) {
  const navRef = useRef(null);
  const pages = Math.max(1, Math.ceil(total / pageSize));

  useEffect(() => {
    if (total > 0 && page > pages) onPageChange?.(pages);
  }, [page, pages, total, onPageChange]);

  if (!total) return null;

  const current = Math.min(page, pages);
  const start = (current - 1) * pageSize + 1;
  const end = Math.min(current * pageSize, total);

  const go = (next) => {
    if (next < 1 || next > pages || next === current) return;
    onPageChange?.(next);
    const list = navRef.current?.closest(".card") ?? navRef.current?.parentElement;
    if (list && list.getBoundingClientRect().top < 0) list.scrollIntoView({ block: "start", behavior: "smooth" });
  };

  return (
    <nav className={`pagination${loading ? " is-loading" : ""}`} aria-label="Pagination" ref={navRef}>
      <span className="pagination-summary row-meta" aria-live="polite">
        Showing {start === end ? start : `${start}–${end}`} of {total} {noun}
      </span>
      {pages > 1 ? (
        <div className="pagination-pages">
          <button type="button" className="btn btn-ghost btn-sm pagination-step" onClick={() => go(current - 1)} disabled={current <= 1} aria-label="Previous page">
            <ChevronLeft size={14} />
            <span className="pagination-step-label">Previous</span>
          </button>
          {pageWindow(current, pages).map((entry) =>
            typeof entry === "number" ? (
              <button
                key={entry}
                type="button"
                className={`btn btn-sm pagination-page${entry === current ? " is-current" : " btn-ghost"}`}
                aria-current={entry === current ? "page" : undefined}
                aria-label={`Page ${entry}`}
                onClick={() => go(entry)}
              >
                {entry}
              </button>
            ) : (
              <span key={entry} className="pagination-gap" aria-hidden="true">
                …
              </span>
            ),
          )}
          <span className="pagination-compact row-meta">
            Page {current} of {pages}
          </span>
          <button type="button" className="btn btn-ghost btn-sm pagination-step" onClick={() => go(current + 1)} disabled={current >= pages} aria-label="Next page">
            <span className="pagination-step-label">Next</span>
            <ChevronRight size={14} />
          </button>
        </div>
      ) : null}
    </nav>
  );
}
