// The pre-site inspections (CL-04) behind this job, on the BOQ vs site tab:
// every one the job's Operations Coordinator was asked to do that has come
// back, so whoever checks the BOQ can read what the site crew found. Each
// opens the request with its inspection report.

import { useEffect, useState } from "react";
import { HardHat } from "lucide-react";
import SectionHead from "@/components/SectionHead";
import RequestStatusBadge from "@/features/collaboration/RequestStatusBadge";
import RequestDetail from "@/features/collaboration/RequestDetail";
import {
  completedInspectionsFor,
  requestCode,
  siteVisitTask,
} from "@/constants/collaboration";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import {
  fetchOpportunityRequests,
  selectOpportunityRequests,
} from "@/slices/collaborationSlice";
import { useAppDispatch, useAppSelector } from "@/store";

export default function SiteInspectionLinks({ job }) {
  const dispatch = useAppDispatch();
  const { unit } = useBusinessUnit();
  const loadedFor = useAppSelector((s) => s.collaboration.oppId);
  const status = useAppSelector((s) => s.collaboration.byOppStatus);
  const requests = useAppSelector((s) => selectOpportunityRequests(s, job?.id));
  const [open, setOpen] = useState(null);

  // The opportunity page has usually loaded them already; the procurement page has not.
  useEffect(() => {
    if (job?.id && loadedFor !== Number(job.id))
      dispatch(fetchOpportunityRequests(job.id));
  }, [job?.id, loadedFor, dispatch]);

  const inspections = completedInspectionsFor(requests, job?.coordinatorId);
  const loading = loadedFor !== Number(job?.id) || status === "loading";

  return (
    <div style={{ margin: "12px 0 16px" }}>
      <SectionHead
        icon={<HardHat size={13} />}
        title="Pre-site inspection details"
      />
      {!inspections.length ? (
        <p className="row-meta" style={{ whiteSpace: "normal" }}>
          {loading
            ? "Loading pre-site inspections…"
            : job?.coordinatorId
              ? `No completed pre-site inspection by ${job.coordinator || "the Operations Coordinator"} on this job.`
              : "No Operations Coordinator on this job, so there are no pre-site inspections to show."}
        </p>
      ) : (
        <div className="list-stack">
          {inspections.map((inspection) => {
            const submittedAt = siteVisitTask(inspection)?.submittedAt;
            return (
              <div className="list-row" key={inspection.id}>
                <div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => setOpen(inspection)}
                  >
                    {requestCode(inspection)} ·{" "}
                    {inspection.title || "Pre-site inspection"}
                  </button>
                  <div className="row-meta">
                    {[
                      inspection.assigneeName,
                      submittedAt
                        ? `submitted ${formatDate(submittedAt, { timeZone: unit?.timezone })}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <RequestStatusBadge request={inspection} />
              </div>
            );
          })}
        </div>
      )}
      {open ? (
        <RequestDetail
          request={open}
          timeZone={unit?.timezone}
          onClose={() => setOpen(null)}
        />
      ) : null}
    </div>
  );
}
