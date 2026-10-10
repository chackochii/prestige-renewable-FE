// The approvals a price variation calls for — the sales manager below the
// threshold, the business owner as well from it — and where each stands.
//
// Nobody decides here. The coordinator (`canEdit`) sends an approval request
// to someone holding the role (the request modal, kind "approval"); that
// person approves or rejects it from the request, with notes, and the API
// records the decision on the job's approval. This tab then shows it —
// approved or declined, by whom, and their notes — with a link to the request.
// The notifications sent along the way are in the notifications module, not
// listed here; the decisions themselves are in the history tab.

import { useEffect, useRef, useState } from "react";
import { Send, ShieldCheck } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import SectionHead from "@/components/SectionHead";
import RequestDetail from "@/features/collaboration/RequestDetail";
import RequestFormModal from "@/features/collaboration/RequestFormModal";
import RequestStatusBadge from "@/features/collaboration/RequestStatusBadge";
import { APPROVAL_DEPARTMENT_FOR_ROLE, approvalRequestsFor, requestCode } from "@/constants/collaboration";
import { PROCUREMENT_STAGE } from "@/constants/procurement";
import {
  approvalFor,
  approvalsComplete,
  priceVariationPct,
  proposalTotal,
  quotedTotal,
  quotesReceived,
  requiredApprovers,
  roleLabel,
  tierFor,
} from "@/helpers/procurement";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { useNotifications } from "@/hooks/useNotifications";
import { useUnitUsers } from "@/hooks/useUnitUsers";
import { createRequest, fetchOpportunityRequests, selectOpportunityRequests } from "@/slices/collaborationSlice";
import { fetchProcurementJob } from "@/slices/procurementSlice";
import { useAppDispatch, useAppSelector } from "@/store";
import { formatCurrency, formatPercent } from "@/utils/formatCurrency";

const errText = (err, fallback) => (typeof err === "string" ? err : err?.message || fallback);

export default function ApprovalsPanel({ job, canEdit = false }) {
  const dispatch = useAppDispatch();
  const { unit } = useBusinessUnit();
  const { active } = useUnitUsers();
  const { notify } = useNotifications();
  const loadedFor = useAppSelector((s) => s.collaboration.oppId);
  const requests = useAppSelector((s) => selectOpportunityRequests(s, job?.id));
  const [raising, setRaising] = useState(null); // the role an approval request is being raised for
  const [open, setOpen] = useState(null);
  const refreshed = useRef(new Set());

  useEffect(() => {
    if (job?.id && loadedFor !== Number(job.id)) dispatch(fetchOpportunityRequests(job.id));
  }, [job?.id, loadedFor, dispatch]);

  // A request decided elsewhere — by the approver, on their own screen — has
  // changed the job too; read it again once, so this tab shows the decision.
  useEffect(() => {
    if (!job?.id) return;
    const stale = requests.find(
      (r) =>
        r.kind === "approval" &&
        ["approved", "rejected"].includes(r.status) &&
        !refreshed.current.has(r.id) &&
        Number(approvalFor(job, roleForDepartment(r.department))?.requestId) !== Number(r.id),
    );
    if (stale) {
      refreshed.current.add(stale.id);
      dispatch(fetchProcurementJob(job.id));
    }
  }, [requests, job, dispatch]);

  if (!quotesReceived(job)) {
    return <Alert tone="info">Approvals open once every line is priced and the price-variation check has run.</Alert>;
  }
  const tier = tierFor(job);
  if (tier?.key === "none") {
    return <Alert tone="success">No approvals needed — the quoted cost matches the proposal.</Alert>;
  }

  const required = requiredApprovers(job);
  const complete = approvalsComplete(job);
  const pct = formatPercent(priceVariationPct(job));

  const send = async (body) => {
    try {
      await dispatch(createRequest({ opportunityId: job.id, body })).unwrap();
      notify(`Approval requested from the ${roleLabel(raising).toLowerCase()}`);
    } catch (err) {
      throw new Error(errText(err, "Could not send the approval request."));
    }
  };

  return (
    <>
      {complete ? (
        <Alert tone="success">All required approvals received — the purchase orders can be released.</Alert>
      ) : (
        <Alert tone="danger">
          Not every approval is in. Send each approver a request below — they approve or reject it, with notes, from the request
          itself, and the decision shows here.
        </Alert>
      )}

      <div style={{ marginTop: 20 }}>
        <SectionHead icon={<ShieldCheck size={13} />} title={`Required — ${tier.label}`} />
        <div className="list-stack">
          {required.map((role) => {
            const approval = approvalFor(job, role);
            const approved = approval?.status === "approved";
            const rejected = approval?.status === "rejected";
            const roleRequests = approvalRequestsFor(requests, role);
            const waiting = roleRequests.find((r) => r.status === "pending");
            const latest = roleRequests[0] ?? null;
            const decidedAt = (approved || rejected) && approval?.decidedAt ? formatDate(approval.decidedAt, { timeZone: unit?.timezone }) : null;
            return (
              <div className="list-row" key={role} style={{ alignItems: "flex-start" }}>
                <div style={{ minWidth: 0 }}>
                  <div className="row-title">{roleLabel(role)}</div>
                  <div className="row-meta" style={{ whiteSpace: "normal" }}>
                    {approved || rejected
                      ? `${approved ? "Approved" : "Declined"} by ${approval?.approver ?? "—"}${decidedAt ? ` on ${decidedAt}` : ""}`
                      : waiting
                        ? `Requested from ${waiting.assigneeName || "—"} on ${formatDate(waiting.createdAt, { timeZone: unit?.timezone })}`
                        : "Not requested yet"}
                  </div>
                  {approval?.note && (approved || rejected) ? (
                    <div className="row-meta" style={{ whiteSpace: "normal", marginTop: 4 }}>
                      <strong>Notes:</strong> {approval.note}
                    </div>
                  ) : null}
                  {latest ? (
                    <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 6 }} onClick={() => setOpen(latest)}>
                      {requestCode(latest)} · view request
                    </button>
                  ) : null}
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", justifyContent: "flex-end" }}>
                  {canEdit && !approved && !waiting ? (
                    <button type="button" className="btn btn-primary btn-sm" onClick={() => setRaising(role)}>
                      <Send size={14} /> {rejected ? "Request again" : "Request approval"}
                    </button>
                  ) : null}
                  {waiting && !approved && !rejected ? <RequestStatusBadge request={waiting} /> : null}
                  <Badge tone={approved ? "success" : rejected ? "danger" : "warning"}>{approved ? "Approved" : rejected ? "Declined" : "Pending"}</Badge>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {raising ? (
        <RequestFormModal
          opportunity={{ id: job.id, number: job.number }}
          stage={PROCUREMENT_STAGE.id}
          kind="approval"
          department={APPROVAL_DEPARTMENT_FOR_ROLE[raising]}
          approvalRole={raising}
          approvalRoleLabel={roleLabel(raising)}
          people={active}
          initial={{
            title: `${job.number}: approve price variation of ${pct}`,
            description: `${job.customer ? `${job.customer} — s` : "S"}uppliers quoted ${formatCurrency(quotedTotal(job))} against ${formatCurrency(
              proposalTotal(job),
            )} in the accepted proposal: a variation of ${pct} (${tier.label}). The purchase orders are held until it is approved.`,
          }}
          onClose={() => setRaising(null)}
          onSubmit={send}
        />
      ) : null}

      {open ? <RequestDetail request={open} timeZone={unit?.timezone} onClose={() => setOpen(null)} /> : null}
    </>
  );
}

/** The approver role an approval request's department stands for. */
function roleForDepartment(department) {
  return Object.keys(APPROVAL_DEPARTMENT_FOR_ROLE).find((role) => APPROVAL_DEPARTMENT_FOR_ROLE[role] === department) ?? null;
}
