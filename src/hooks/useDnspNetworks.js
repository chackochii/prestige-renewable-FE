// The DNSP networks list, fetched on first use and shared from the store.

import { useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import { fetchDnspNetworks } from "@/slices/dnspNetworksSlice";

export function useDnspNetworks() {
  const dispatch = useAppDispatch();
  const { items, status, error } = useAppSelector((s) => s.dnspNetworks);

  useEffect(() => {
    if (status === "idle") dispatch(fetchDnspNetworks());
  }, [dispatch, status]);

  return { networks: items, status, error, reload: () => dispatch(fetchDnspNetworks()) };
}

/**
 * The networks as dropdown options grouped by state: the active ones, plus the
 * one already picked on a job if it has since been retired or renamed — so the
 * job keeps showing what was recorded.
 */
export function dnspNetworkOptions(networks, current) {
  const options = networks
    .filter((n) => n.isActive)
    .map((n) => ({ value: n.name, label: n.name, group: n.state || "Other" }));
  if (current && !options.some((o) => o.value === current)) {
    options.push({ value: current, label: `${current} (no longer listed)`, group: "Other" });
  }
  return options;
}
