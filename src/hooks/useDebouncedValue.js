// Settles a fast-changing value before anything acts on it. Used for search
// boxes that now filter server-side: without it every keystroke would be its
// own request, and the answers could arrive out of order.

import { useEffect, useState } from "react";

export function useDebouncedValue(value, delay = 300) {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return settled;
}

export default useDebouncedValue;
