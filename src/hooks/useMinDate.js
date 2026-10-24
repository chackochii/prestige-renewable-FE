// Every date picker inside `ref` starts no earlier than `minDate` ("yyyy-mm-dd")
// — on a job, the day the lead was created: no task on it can be dated before
// the lead existed (UAT, Oct 2026). Pickers that set their own `min` keep it;
// ones that appear later (a tab opened, a pop-up) are picked up as they render.

import { useEffect } from "react";

export function useMinDate(ref, minDate) {
  useEffect(() => {
    const root = ref.current;
    if (!root || !minDate) return undefined;
    const apply = () => {
      root.querySelectorAll('input[type="date"]').forEach((input) => {
        if (input.min && !input.dataset.leadMin) return;
        input.min = minDate;
        input.dataset.leadMin = "1";
      });
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [ref, minDate]);
}
