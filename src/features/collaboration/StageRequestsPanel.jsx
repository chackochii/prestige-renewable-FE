// Read-only panel for a stage: what this job is waiting on from other teams,
// and what has come back. Drops into any stage — the estimation panel uses it
// for sales information requests and operations assignments.
//
// Opening a row shows the request itself, not the other department's module.

import { useEffect, useState } from "react";
import { HandHelping, Plus, UserPlus } from "lucide-react";
import Alert from "@/components/Alert";
import EmptyState from "@/components/EmptyState";
import LoadingState from "@/components/LoadingState";
import SectionHead from "@/components/SectionHead";
import RequestDetail from "./RequestDetail";
import RequestFormModal from "./RequestFormModal";
import RequestResponseCard from "./RequestResponseCard";
import { statusMeta } from "@/constants/collaboration";
import { useAuth } from "@/hooks/useAuth";
import { useNotifications } from "@/hooks/useNotifications";
import { useUnitUsers } from "@/hooks/useUnitUsers";
import { useAppDispatch, useAppSelector } from "@/store";
import { createRequest, fetchOpportunityRequests } from "@/slices/collaborationSlice";

const errText = (err, fallback) => (typeof err === "string" ? err : err?.message || fallback);

export default function StageRequestsPanel({
  opp,
  stage,
  unit,
  canEdit = false,
  title = "Request / Response",
  // Which department each button starts on. Estimation asks sales for
  // information; the lead stage asks operations. Either way the requester can
  // change it in the form — this only decides what is pre-selected.
  informationDepartment = "sales",
  assignmentDepartment = "operations",
  emptyBody,
}) {
  const dispatch = useAppDispatch();
  const { user } = useAuth();
  const { notify, error: notifyError } = useNotifications();
  const { active, sales, siteOps } = useUnitUsers();
  const { oppId, byOpp, byOppStatus, byOppError } = useAppSelector((s) => s.collaboration);
  const [raising, setRaising] = useState(null); // { kind, department }
  const [open, setOpen] = useState(null);

  useEffect(() => {
    if (opp?.id) dispatch(fetchOpportunityRequests(opp.id));
  }, [opp?.id, dispatch]);

  const items = oppId === Number(opp?.id) ? byOpp.filter((r) => !stage || Number(r.stage) === Number(stage)) : [];
  const openItems = items.filter((r) => statusMeta(r.kind, r.status).open);

  const submitNew = async (body) => {
    await dispatch(createRequest({ opportunityId: opp.id, body })).unwrap();
    notify(body.kind === "assignment" ? "Assignment sent" : "Request sent");
  };

  const peopleFor = (kind, department) => {
    if (department === "operations") return siteOps.length ? siteOps : active;
    if (department === "sales") return sales.length ? sales : active;
    return active;
  };

  return (
    <>
      <div className="section" style={{ marginBottom: 0 }}>
        <div className="estimation-item-head">
          <SectionHead icon={<HandHelping size={13} />} title={title} />
          {canEdit ? (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setRaising({ kind: "information", department: informationDepartment })}
              >
                <Plus size={14} /> Request information
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setRaising({ kind: "assignment", department: assignmentDepartment })}
              >
                <UserPlus size={14} /> Assign an activity
              </button>
            </div>
          ) : null}
        </div>

        {byOppError ? (
          <Alert tone="warning">Requests for this job could not be loaded ({byOppError}).</Alert>
        ) : null}

        {byOppStatus === "loading" && !items.length ? (
          <LoadingState label="Loading requests…" />
        ) : !items.length ? (
          <EmptyState
            icon={<HandHelping size={24} strokeWidth={1.5} />}
            title="Nothing with another team"
            body={
              canEdit
                ? emptyBody ||
                  "Raise a request when you need information from sales, or assign an activity to operations."
                : "No requests have been raised from this stage."
            }
          />
        ) : (
          <div className="rr-list">
            {items.map((request) => (
              <RequestResponseCard
                key={request.id}
                request={request}
                user={user}
                timeZone={unit?.timezone}
                onOpen={setOpen}
              />
            ))}
          </div>
        )}

        {openItems.length ? (
          <p className="lede" style={{ marginTop: 10, marginBottom: 0 }}>
            {openItems.length} still open — this stage is waiting on {openItems.length === 1 ? "it" : "them"}.
          </p>
        ) : null}
      </div>

      {raising ? (
        <RequestFormModal
          opportunity={opp}
          stage={stage}
          kind={raising.kind}
          department={raising.department}
          people={peopleFor(raising.kind, raising.department)}
          onClose={() => setRaising(null)}
          onSubmit={async (body) => {
            try {
              await submitNew(body);
            } catch (err) {
              notifyError(errText(err, "Could not raise the request."));
              throw err;
            }
          }}
        />
      ) : null}

      {open ? <RequestDetail request={open} timeZone={unit?.timezone} onClose={() => setOpen(null)} /> : null}
    </>
  );
}
