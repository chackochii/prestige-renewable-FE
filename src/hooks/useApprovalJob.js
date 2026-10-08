// One job's approvals, from the approvals slice: fetched on first use —
// unless the board already brought it, as it does on the approvals page —
// shared by the approvals page and the opportunity page's stage-5 panel, and
// changed through the API.
//
// Checklist answers are applied on screen at once and sent after a short
// pause, so a reference typed letter by letter is one request, not ten; the
// track the answers settle (status, authority, reference, dates — see
// helpers/approvalChecklist.js derivedTrack) travels with them, which is what
// lets the API run the "All approved?" gate.
//
// A save still waiting when another job is picked belongs to the job it was
// typed on: answers wait per job *and* type, and the track sent with them is
// worked out from that job as the store holds it when the save goes — never
// from whichever job is on screen by then.

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import { clearSaveError, fetchJobApprovals, patchChecklistLocally, setRequiredApprovals, updateApproval } from "@/slices/approvalsSlice";
import { applyChecklist, derivedTrack, sectionOf } from "@/helpers/approvalChecklist";

const SEND_AFTER_MS = 700;

const keyOf = (jobId, type) => `${jobId}:${type}`;
const partsOf = (key) => {
  const at = key.indexOf(":");
  return [Number(key.slice(0, at)), key.slice(at + 1)];
};

export function useApprovalJob(opportunityId) {
  const id = opportunityId ? Number(opportunityId) : null;
  const dispatch = useAppDispatch();
  const raw = useAppSelector((state) => (id ? state.approvals.jobs[id] : null) ?? null);
  const status = useAppSelector((state) => (id ? state.approvals.jobStatus[id] : null) ?? "idle");
  const error = useAppSelector((state) => (id ? state.approvals.jobError[id] : null) ?? null);
  const saveError = useAppSelector((state) => (id ? state.approvals.saveError[id] : null) ?? null);

  useEffect(() => {
    if (id && status === "idle") dispatch(fetchJobApprovals(id));
  }, [id, status, dispatch]);

  const reload = useCallback(() => (id ? dispatch(fetchJobApprovals(id)) : null), [id, dispatch]);
  const job = useMemo(() => (raw ? applyChecklist(raw) : null), [raw]);

  const pending = useRef(new Map()); // "jobId:type" → the answers changed since the last send
  const timers = useRef(new Map());

  const flush = useCallback(
    (key) => {
      clearTimeout(timers.current.get(key));
      timers.current.delete(key);
      const patch = pending.current.get(key);
      pending.current.delete(key);
      const [jobId, type] = partsOf(key);
      if (!patch || !jobId) return;
      dispatch((send, getState) => {
        const held = getState().approvals.jobs[jobId];
        const item = held?.items?.find((candidate) => candidate.key === type);
        const section = item ? sectionOf(item) : null;
        const track = section ? derivedTrack(section, item.checklist ?? {}, held) : {};
        return (
          send(updateApproval({ id: jobId, type, body: { checklist: patch, ...track }, fromChecklist: true }))
            .unwrap()
            // Refused or lost on the way: the screen goes back to what the API
            // holds (the reason stays up — see saveError), rather than showing
            // answers that were never saved.
            .catch(() => send(fetchJobApprovals(jobId)))
        );
      });
    },
    [dispatch],
  );

  const updateChecklist = useCallback(
    (type, patch) => {
      if (!id) return;
      dispatch(patchChecklistLocally({ id, type, patch }));
      const key = keyOf(id, type);
      pending.current.set(key, { ...(pending.current.get(key) ?? {}), ...patch });
      clearTimeout(timers.current.get(key));
      timers.current.set(
        key,
        setTimeout(() => flush(key), SEND_AFTER_MS),
      );
    },
    [id, dispatch, flush],
  );

  // Leaving the screen sends whatever is still waiting, for every job it was typed on.
  useEffect(() => {
    const waiting = pending.current;
    return () => {
      for (const key of [...waiting.keys()]) flush(key);
    };
  }, [flush]);

  /** A plain approval recorded directly: { status?, authority?, reference?, submittedAt?, decidedAt?, note? }. */
  const updateItem = useCallback((type, body) => dispatch(updateApproval({ id, type, body })).unwrap(), [id, dispatch]);

  /** Which approvals the job needs; the job comes back with its new rows in the same call. */
  const setRequired = useCallback((keys) => dispatch(setRequiredApprovals({ id, keys })).unwrap(), [id, dispatch]);

  const dismissSaveError = useCallback(() => (id ? dispatch(clearSaveError(id)) : null), [id, dispatch]);

  return { job, status, error, saveError, dismissSaveError, reload, updateChecklist, updateItem, setRequired };
}
