// The arithmetic behind components/Pagination, kept apart from the component
// so the pages can share it (and so fast refresh keeps working on the component).

/** Rows on one page of every paged list (Leads, Pipeline, Quotes, Proposals, Approvals, Procurement). */
export const PAGE_SIZE = 12;

/** 1 … 4 5 [6] 7 8 … 20 — the current page with `siblings` either side, the first and last, and gaps. */
export function pageWindow(page, pages, siblings = 1) {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1);
  const from = Math.max(2, page - siblings);
  const to = Math.min(pages - 1, page + siblings);
  const out = [1];
  if (from > 2) out.push("gap-start");
  for (let n = from; n <= to; n += 1) out.push(n);
  if (to < pages - 1) out.push("gap-end");
  out.push(pages);
  return out;
}
