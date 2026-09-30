// The procurement jobs with their checklists: the CL-11 to CL-14 and CL-10
// answers are held in the procurement slice so the procurement page and the
// opportunity page see the same thing, and what they settle (the Green Deal
// job) is applied to the record. Until the purchase-order service is
// connected the answers start from the sample data and live in memory.

import { useCallback, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import { procurementActions } from "@/slices/procurementSlice";
import { applyProcurementChecklist } from "@/helpers/procurementChecklist";
import { sampleProcurementChecklist } from "@/lib/mockData/procurement";

export function useProcurementChecklists(jobs) {
  const saved = useAppSelector((state) => state.procurement.checklists);
  const dispatch = useAppDispatch();

  const withChecklists = useMemo(
    () =>
      (jobs ?? []).map((job) => {
        const checklist = saved[job.id] ?? sampleProcurementChecklist(job);
        return { ...applyProcurementChecklist(job, checklist), checklist };
      }),
    [jobs, saved],
  );

  /** Change some answers in one section of a job's checklist. */
  const update = useCallback(
    (job, sectionKey, patch) => dispatch(procurementActions.updateChecklist({ jobId: job.id, sectionKey, patch, base: job.checklist })),
    [dispatch],
  );

  return { jobs: withChecklists, update };
}
