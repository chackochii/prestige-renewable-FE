// One job's passage through procurement & delivery: the step strip across the
// top says where it is, the tabs open each step's records. The tab opens on
// the job's current step, and steps the job has not reached yet say what has
// to happen first rather than showing an empty screen.
//
// `embedded` drops the card chrome for use inside another card — the
// opportunity page's stage-6 panel already has a heading of its own.

import { useEffect, useState } from "react";
import { BellRing, ClipboardCheck, Clock, Leaf, PackageSearch, Percent, Truck } from "lucide-react";
import Badge from "@/components/Badge";
import Card from "@/components/Card";
import Tabs from "@/components/Tabs";
import ApprovalsPanel from "@/features/procurement/ApprovalsPanel";
import BoqVerification from "@/features/procurement/BoqVerification";
import GreenDealJobCreation from "@/features/procurement/GreenDealJobCreation";
import PriceVariationCheck from "@/features/procurement/PriceVariationCheck";
import ProcurementHistory from "@/features/procurement/ProcurementHistory";
import PurchaseOrders from "@/features/procurement/PurchaseOrders";
import WorkflowSteps from "@/features/procurement/WorkflowSteps";
import { boqLines, currentRound, currentStep, procurementStatus, purchaseOrders, requiredApprovers } from "@/helpers/procurement";
import { formatCurrency } from "@/utils/formatCurrency";

// The BOQ table and the matching decision are one screen; "done" opens on
// the Green Deal record, which is where a finished job's evidence lives.
const tabForStep = (step) => (step === "matching" ? "boq" : step === "done" ? "green_deal" : step);
const stepForTab = (tab, step) => (tab === "boq" ? (step === "matching" ? "matching" : "boq") : tab === "history" ? null : tab);

export default function ProcurementWorkflow({ job, embedded = false }) {
  const step = currentStep(job);
  const [tab, setTab] = useState(tabForStep(step));

  // A different job opens on its own current step, not wherever the last one was.
  useEffect(() => {
    setTab(tabForStep(currentStep(job)));
  }, [job?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!job) return null;

  const status = procurementStatus(job);
  const tabs = [
    { key: "boq", label: "BOQ & matching", icon: <ClipboardCheck size={14} />, count: boqLines(job).length },
    { key: "variation", label: "Price variation", icon: <Percent size={14} /> },
    { key: "approvals", label: "Approvals", icon: <BellRing size={14} />, count: requiredApprovers(job).length || undefined },
    { key: "delivery", label: "POs & delivery", icon: <Truck size={14} />, count: purchaseOrders(job).length || undefined },
    { key: "green_deal", label: "Green Deal job", icon: <Leaf size={14} /> },
    { key: "history", label: "History", icon: <Clock size={14} />, count: (job.history ?? []).length },
  ];

  const body = (
    <>
      <WorkflowSteps current={step} viewing={stepForTab(tab, step)} round={currentRound(job)} onSelect={(key) => setTab(tabForStep(key))} />
      <Tabs items={tabs} value={tab} onChange={setTab} />
      <div className="panel">
        {tab === "boq" ? (
          <BoqVerification job={job} />
        ) : tab === "variation" ? (
          <PriceVariationCheck job={job} />
        ) : tab === "approvals" ? (
          <ApprovalsPanel job={job} />
        ) : tab === "delivery" ? (
          <PurchaseOrders job={job} />
        ) : tab === "green_deal" ? (
          <GreenDealJobCreation job={job} />
        ) : (
          <ProcurementHistory job={job} />
        )}
      </div>
    </>
  );

  if (embedded) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
          <span className="row-meta">
            {job.number} · {job.customer} · {formatCurrency(job.acceptedValue)} accepted
          </span>
          <Badge tone={status.tone}>{status.label}</Badge>
        </div>
        {body}
      </div>
    );
  }

  return (
    <Card
      title={`${job.number} · ${job.customer}`}
      icon={<PackageSearch size={16} />}
      sub={`${job.site} · ${formatCurrency(job.acceptedValue)} accepted · ${job.salesperson} (sales) · ${job.coordinator} (procurement)`}
      actions={<Badge tone={status.tone}>{status.label}</Badge>}
    >
      {body}
    </Card>
  );
}
