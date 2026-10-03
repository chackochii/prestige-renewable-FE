// One job's procurement record, from the procurement slice: fetched on first
// use — unless the board already brought it, as it does on the procurement
// page — shared by the procurement page and the opportunity page's stage-6
// panel, and changed through the API.
//
// Checklist answers are applied on screen at once and sent after a short
// pause, so a reference typed letter by letter is one request, not ten. The
// API applies what the answers settle (orders sent, deliveries received, the
// Green Deal job) and sends the whole job back; a save it refuses — releasing
// orders before the variation is approved, say — puts the job back as the
// API has it and surfaces the reason.

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  addSupplierQuote,
  clearJobError,
  createPurchaseOrder,
  decideVariation,
  deletePurchaseOrder,
  fetchProcurementJob,
  patchChecklistLocally,
  removeSupplierQuote,
  saveBoq,
  saveChecklist,
  updatePurchaseOrder,
} from "@/slices/procurementSlice";
import { uploadOpportunityAttachment } from "@/services/api/leadsApi";
import { applyProcurementChecklist } from "@/helpers/procurementChecklist";
import { UPLOAD_CATEGORY_FOR_ITEM } from "@/constants/procurement";

const SEND_AFTER_MS = 700;

export function useProcurementJob(opportunityId, { enabled = true } = {}) {
  const id = opportunityId ? Number(opportunityId) : null;
  const dispatch = useAppDispatch();
  const raw = useAppSelector((state) => (id ? state.procurement.jobs[id] : null) ?? null);
  const status = useAppSelector((state) => (id ? state.procurement.jobStatus[id] : null) ?? "idle");
  const error = useAppSelector((state) => (id ? state.procurement.jobError[id] : null) ?? null);

  useEffect(() => {
    if (enabled && id && status === "idle") dispatch(fetchProcurementJob(id));
  }, [enabled, id, status, dispatch]);

  const reload = useCallback(() => (id ? dispatch(fetchProcurementJob(id)) : null), [id, dispatch]);
  // What the answers settle, shown the moment they are typed; the API applies the same.
  const job = useMemo(() => (raw ? applyProcurementChecklist(raw, raw.checklist ?? {}) : null), [raw]);

  const pending = useRef(new Map()); // section → the answers changed since the last send
  const timers = useRef(new Map());

  const flush = useCallback(
    (section) => {
      clearTimeout(timers.current.get(section));
      timers.current.delete(section);
      const patch = pending.current.get(section);
      pending.current.delete(section);
      if (!patch || !id) return;
      // Refused: the answers on screen are put back as the API holds them.
      dispatch(saveChecklist({ id, section, patch }))
        .unwrap()
        .catch(() => dispatch(fetchProcurementJob(id)));
    },
    [id, dispatch],
  );

  const updateChecklist = useCallback(
    (section, patch) => {
      if (!id) return;
      dispatch(patchChecklistLocally({ id, section, patch }));
      pending.current.set(section, { ...(pending.current.get(section) ?? {}), ...patch });
      clearTimeout(timers.current.get(section));
      timers.current.set(section, setTimeout(() => flush(section), SEND_AFTER_MS));
    },
    [id, dispatch, flush],
  );

  // Leaving the screen sends whatever is still waiting.
  useEffect(() => {
    const waiting = pending.current;
    return () => {
      for (const section of [...waiting.keys()]) flush(section);
    };
  }, [flush]);

  const run = useCallback((thunk) => dispatch(thunk).unwrap(), [dispatch]);

  /**
   * Files attached on a checklist item go on the job's attachments, filed by
   * what the item is, and come back as { id, filename, url } for the answer.
   */
  const upload = useCallback(
    async (itemKey, files) => {
      const category = UPLOAD_CATEGORY_FOR_ITEM[itemKey] ?? "purchase_order";
      const uploaded = [];
      for (const file of Array.from(files || [])) {
        const saved = await uploadOpportunityAttachment(id, category, file);
        uploaded.push({ id: saved.id, filename: saved.filename ?? file.name, url: saved.url ?? null });
      }
      return uploaded;
    },
    [id],
  );

  return {
    job,
    status,
    error,
    reload,
    clearError: useCallback(() => (id ? dispatch(clearJobError(id)) : null), [id, dispatch]),
    updateChecklist,
    upload,
    saveBoq: useCallback((body) => run(saveBoq({ id, body })), [id, run]),
    addQuote: useCallback((body) => run(addSupplierQuote({ id, body })), [id, run]),
    removeQuote: useCallback((index) => run(removeSupplierQuote({ id, index })), [id, run]),
    createPurchaseOrder: useCallback((body) => run(createPurchaseOrder({ id, body })), [id, run]),
    updatePurchaseOrder: useCallback((poId, body) => run(updatePurchaseOrder({ id, poId, body })), [id, run]),
    deletePurchaseOrder: useCallback((poId) => run(deletePurchaseOrder({ id, poId })), [id, run]),
    decide: useCallback((role, body) => run(decideVariation({ id, role, body })), [id, run]),
  };
}
