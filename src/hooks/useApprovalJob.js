// One job's approvals, from the approvals slice: fetched on first use,
// shared by the approvals page and the opportunity page's stage-5 panel, and
// changed through the API.
//
// Checklist answers are applied on screen at once and sent after a short
// pause, so a reference typed letter by letter is one request, not ten; the
// track the answers settle (status, authority, reference, dates — see
// helpers/approvalChecklist.js derivedTrack) travels with them, which is what
// lets the API run the "All approved?" gate.

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import { fetchJobApprovals, patchChecklistLocally, setRequiredApprovals, updateApproval } from "@/slices/approvalsSlice";
import { applyChecklist, derivedTrack, sectionOf } from "@/helpers/approvalChecklist";

const SEND_AFTER_MS = 700;

export function useApprovalJob(opportunityId) {
  const id = opportunityId ? Number(opportunityId) : null;
  const dispatch = useAppDispatch();
  const raw = useAppSelector((state) => (id ? state.approvals.jobs[id] : null) ?? null);
  const status = useAppSelector((state) => (id ? state.approvals.jobStatus[id] : null) ?? "idle");
  const error = useAppSelector((state) => (id ? state.approvals.jobError[id] : null) ?? null);

  useEffect(() => {
    if (id && status === "idle") dispatch(fetchJobApprovals(id));
  }, [id, status, dispatch]);

  const reload = useCallback(() => (id ? dispatch(fetchJobApprovals(id)) : null), [id, dispatch]);
  const job = useMemo(() => (raw ? applyChecklist(raw) : null), [raw]);

  // The latest local answers, for the send that happens after the pause.
  const latest = useRef(raw);
  latest.current = raw;
  const pending = useRef(new Map()); // type → the answers changed since the last send
  const timers = useRef(new Map());

  const flush = useCallback(
    (type) => {
      clearTimeout(timers.current.get(type));
      timers.current.delete(type);
      const patch = pending.current.get(type);
      pending.current.delete(type);
      if (!patch || !id) return;
      const item = latest.current?.items?.find((candidate) => candidate.key === type);
      const section = item ? sectionOf(item) : null;
      const track = section ? derivedTrack(section, item.checklist ?? {}, latest.current) : {};
      dispatch(updateApproval({ id, type, body: { checklist: patch, ...track } }));
    },
    [id, dispatch],
  );

  const updateChecklist = useCallback(
    (type, patch) => {
      if (!id) return;
      dispatch(patchChecklistLocally({ id, type, patch }));
      pending.current.set(type, { ...(pending.current.get(type) ?? {}), ...patch });
      clearTimeout(timers.current.get(type));
      timers.current.set(type, setTimeout(() => flush(type), SEND_AFTER_MS));
    },
    [id, dispatch, flush],
  );

  // Leaving the screen sends whatever is still waiting.
  useEffect(() => {
    const waiting = pending.current;
    return () => {
      for (const type of [...waiting.keys()]) flush(type);
    };
  }, [flush]);

  /** A plain approval recorded directly: { status?, authority?, reference?, submittedAt?, decidedAt?, note? }. */
  const updateItem = useCallback((type, body) => dispatch(updateApproval({ id, type, body })).unwrap(), [id, dispatch]);

  /** Which approvals the job needs; the job is reread so new rows show. */
  const setRequired = useCallback(
    async (keys) => {
      const opportunity = await dispatch(setRequiredApprovals({ id, keys })).unwrap();
      await dispatch(fetchJobApprovals(id));
      return opportunity;
    },
    [id, dispatch],
  );

  return { job, status, error, reload, updateChecklist, updateItem, setRequired };
}
