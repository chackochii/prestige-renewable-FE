// Green Deal job creation — the last step of procurement, and the handover to
// construction & commissioning. Until the Green Deal service is connected the
// button here is inert; the state it shows is real to the job record.

import { ArrowRight, Leaf } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import { PROCUREMENT_STAGE } from "@/lib/mockData/procurement";
import { currentStep, greenDealCreated, procurementStatus } from "@/helpers/procurement";
import { formatDate } from "@/helpers/dateTimeHelpers";

export default function GreenDealJobCreation({ job }) {
  const step = currentStep(job);

  if (greenDealCreated(job)) {
    return (
      <>
        <Alert tone="success">
          Green Deal job created — this record is ready for {PROCUREMENT_STAGE.next.label.toLowerCase()}.
        </Alert>
        <div className="list-stack" style={{ marginTop: 20 }}>
          <div className="list-row">
            <div>
              <div className="row-title">Green Deal job</div>
              <div className="row-meta">
                Created {formatDate(job.greenDeal.createdAt, { withTime: true })} by {job.greenDeal.by}
              </div>
            </div>
            <Badge tone="success">{job.greenDeal.jobId}</Badge>
          </div>
          <div className="list-row">
            <div>
              <div className="row-title">Next stage</div>
              <div className="row-meta">{PROCUREMENT_STAGE.next.label}</div>
            </div>
            <button type="button" className="btn btn-primary btn-sm" disabled title="Stage progression is driven from the opportunity record">
              Move to construction <ArrowRight size={14} />
            </button>
          </div>
        </div>
      </>
    );
  }

  if (step === "green_deal") {
    return (
      <>
        <Alert tone="info">
          Approvals are in and the purchase orders are out. Create the Green Deal job to hand this to construction.
        </Alert>
        <div style={{ marginTop: 16, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button type="button" className="btn btn-primary" disabled title="Available once the Green Deal service is connected">
            <Leaf size={15} /> Create Green Deal job
          </button>
          <span className="row-meta">Recorded in the history tab when done.</span>
        </div>
      </>
    );
  }

  const status = procurementStatus(job);
  return (
    <Alert tone="info">
      Not yet — the job is still at <strong>{status.label.toLowerCase()}</strong>. The Green Deal job is created once every
      required approval is received.
    </Alert>
  );
}
