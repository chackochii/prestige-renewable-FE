// The approvals jobs with their checklists: each job's tracks are driven by
// its CL-07 / CL-08 / CL-09 answers (helpers/approvalChecklist.js), and the
// answers are held in the approvals slice so the approvals page and the
// opportunity page see the same thing. Until the approvals service is
// connected the answers start from the sample data and live in memory.

import { useCallback, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import { approvalsActions } from "@/slices/approvalsSlice";
import { applyChecklist } from "@/helpers/approvalChecklist";
import { sampleChecklist } from "@/lib/mockData/approvals";

export function useApprovalChecklists(jobs) {
  const saved = useAppSelector((state) => state.approvals.checklists);
  const dispatch = useAppDispatch();

  const withChecklists = useMemo(
    () =>
      (jobs ?? []).map((job) => {
        const checklist = saved[job.id] ?? sampleChecklist(job);
        return { ...applyChecklist(job, checklist), checklist };
      }),
    [jobs, saved],
  );

  /** Change some answers in one section of a job's checklist. */
  const update = useCallback(
    (job, sectionKey, patch) => dispatch(approvalsActions.updateChecklist({ jobId: job.id, sectionKey, patch, base: job.checklist })),
    [dispatch],
  );

  return { jobs: withChecklists, update };
}
