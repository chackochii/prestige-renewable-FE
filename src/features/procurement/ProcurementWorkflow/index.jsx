// One job's passage through procurement & delivery: the step strip across the
// top says where it is, the tabs open each step's records with the
// checklist that belongs to it — CL-11 BOQ vs site with the BOQ table and the
// coordinator's completed pre-site inspections and the order-list PDF, CL-12
// supplier quote with the quotes received and the per-line pricing taken
// from them, the price variation and its
// approvals, CL-13 PO release with the purchase orders, CL-14 material
// receipt with the deliveries, and CL-10 job creation in Green Deal, which
// opens once the variation approval and the material receipt are complete.
//
// `job` comes from useProcurementJob (it carries `checklist`, and what the
// answers settle is already applied); the `on…` handlers are that hook's
// writes. `canEdit` — may work the stage (procurement.update); `canApprove` —
// may sign the Procurement Manager's items (procurement.approve). Price-
// variation approvals are not decided here: the coordinator requests them and
// the approver answers on the request (see ApprovalsPanel).
//
// `tabKeys` — only these tabs (the rest of the workflow is worked elsewhere):
// procurement stops at PO release; construction shows the material receipt
// and job creation. `showSteps` — the step strip across the top.
//
// `requests` — the stage's Request / Response panel, shown as the last tab
// when given (the opportunity page passes it; the procurement page does not).
//
// `embedded` drops the card chrome for use inside another card — the
// opportunity page's stage-6 panel already has a heading of its own.

import { useEffect, useState } from "react";
import { BellRing, ClipboardCheck, Clock, FileText, HandHelping, Leaf, PackageCheck, PackageSearch, Percent, Truck } from "lucide-react";
import Alert from "@/components/Alert";
import ContinueButton from "@/components/ContinueButton";
import Badge from "@/components/Badge";
import Card from "@/components/Card";
import Tabs from "@/components/Tabs";
import ApprovalsPanel from "@/features/procurement/ApprovalsPanel";
import BoqOrderList from "@/features/procurement/BoqOrderList";
import BoqPricing from "@/features/procurement/BoqPricing";
import BoqVerification from "@/features/procurement/BoqVerification";
import Deliveries from "@/features/procurement/Deliveries";
import PriceVariationCheck from "@/features/procurement/PriceVariationCheck";
import ProcurementChecklist from "@/features/procurement/ProcurementChecklist";
import ProcurementHistory from "@/features/procurement/ProcurementHistory";
import PurchaseOrders from "@/features/procurement/PurchaseOrders";
import SiteInspectionLinks from "@/features/procurement/SiteInspectionLinks";
import SupplierQuotes from "@/features/procurement/SupplierQuotes";
import WorkflowSteps from "@/features/procurement/WorkflowSteps";
import { PROCUREMENT_CHECKLISTS, procurementChecklistOf } from "@/constants/procurementChecklists";
import { checklistSummary, itemDone } from "@/helpers/checklist";
import { approvalsComplete, currentRound, currentStep, procurementStatus, quotesReceived, requiredApprovers, tierFor } from "@/helpers/procurement";
import { jobCreationBlocker, procurementContext } from "@/helpers/procurementChecklist";
import { formatCurrency } from "@/utils/formatCurrency";
import { useNotifications } from "@/hooks/useNotifications";

// Which tab each step of the strip opens, and which step a tab sits in. The
// BOQ table and the matching decision are one screen; getting quotes is part
// of matching; releasing orders and receiving them are both "delivery"; "done"
// opens on the Green Deal record, where a finished job's evidence lives.
const TAB_FOR_STEP = { boq: "boq", matching: "boq", variation: "variation", approvals: "approvals", delivery: "po", green_deal: "green_deal", done: "green_deal" };
const STEP_FOR_TAB = { quote: "matching", variation: "variation", approvals: "approvals", po: "delivery", receipt: "delivery", green_deal: "green_deal" };
const SECTION_FOR_TAB = { boq: "boq", quote: "quote", po: "po", receipt: "receipt", green_deal: "jobCreation" };
const tabForStep = (step) => TAB_FOR_STEP[step] ?? "boq";
const stepForTab = (tab, step) => (tab === "boq" ? (step === "matching" ? "matching" : "boq") : (STEP_FOR_TAB[tab] ?? null));

export default function ProcurementWorkflow({
  job,
  canEdit = false,
  canApprove = false,
  error = null,
  onClearError,
  onChecklistChange,
  onUpload,
  onSaveBoq,
  onAddQuote,
  onRemoveQuote,
  onCreatePurchaseOrder,
  onUpdatePurchaseOrder,
  onDeletePurchaseOrder,
  requests = null,
  tabKeys = null,
  showSteps = true,
  // Submit a checklist tab now (useProcurementJob.submitChecklist).
  onSubmitChecklist = null,
  // The stage's way out, from its last checklist tab: `proceedLabel` names the
  // next stage, `canProceed` — may this person move the job on.
  onProceed = null,
  proceedLabel = "",
  canProceed = false,
  embedded = false,
}) {
  const { notify, error: notifyError } = useNotifications();
  const step = currentStep(job);
  const [pickedTab, setTab] = useState(tabForStep(step));
  const [submitting, setSubmitting] = useState(false);

  // A different job opens on its own current step, not wherever the last one was.
  useEffect(() => {
    setTab(tabForStep(currentStep(job)));
  }, [job?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!job) return null;

  const status = procurementStatus(job);
  const checklist = job.checklist ?? {};
  const ctx = procurementContext(job, checklist);
  const summaries = Object.fromEntries(
    PROCUREMENT_CHECKLISTS.map((section) => [
      section.key,
      checklistSummary(section, checklist[section.key] ?? {}, ctx, { locked: Boolean(section.afterMaterials && jobCreationBlocker(job, checklist)) }),
    ]),
  );
  const count = (key) => (summaries[key].locked ? undefined : `${summaries[key].done}/${summaries[key].total}`);
  const tabs = [
    { key: "boq", label: "BOQ vs site", icon: <ClipboardCheck size={14} />, count: count("boq") },
    { key: "quote", label: "Supplier quote", icon: <FileText size={14} />, count: count("quote") },
    { key: "variation", label: "Price variation", icon: <Percent size={14} /> },
    { key: "approvals", label: "Approvals", icon: <BellRing size={14} />, count: requiredApprovers(job).length || undefined },
    { key: "po", label: "PO release", icon: <Truck size={14} />, count: count("po") },
    { key: "receipt", label: "Material receipt", icon: <PackageCheck size={14} />, count: count("receipt") },
    { key: "green_deal", label: "Job creation", icon: <Leaf size={14} />, count: count("jobCreation") },
    { key: "history", label: "History", icon: <Clock size={14} />, count: (job.history ?? []).length || undefined },
    ...(requests ? [{ key: "requests", label: "Request / Response", icon: <HandHelping size={14} /> }] : []),
  ].filter((item) => !tabKeys || tabKeys.includes(item.key));
  // The step strip can point at a tab this view does not carry: open the first one instead.
  const tab = tabs.some((item) => item.key === pickedTab) ? pickedTab : tabs[0]?.key;

  const section = procurementChecklistOf(SECTION_FOR_TAB[tab]);

  // Each step leads to the next: a "Continue to <tab>" button under it, named
  // for the tab it opens — always shown, and disabled (what is missing on
  // hover) until the step is done. No variation skips approvals.
  const complete = (key) => summaries[key].applies !== false && !summaries[key].locked && summaries[key].done === summaries[key].total;
  const left = (key) => (complete(key) ? [] : [`${summaries[key].total - summaries[key].done} checklist item${summaries[key].total - summaries[key].done === 1 ? "" : "s"} on this tab`]);
  const noApprovals = tierFor(job)?.key === "none";
  const priced = quotesReceived(job) ? [] : ["a price on every BOQ / BOS line (Supplier quote)"];
  const NEXT = {
    boq: { to: "quote", blockers: left("boq") },
    quote: { to: "variation", blockers: [...left("quote"), ...priced] },
    variation: { to: noApprovals ? "po" : "approvals", blockers: priced },
    approvals: { to: "po", blockers: [...priced, ...(noApprovals || approvalsComplete(job) ? [] : ["every required approval approved"])] },
    po: { to: "receipt", blockers: left("po") },
    receipt: { to: "green_deal", blockers: left("receipt") },
  };
  const nextStep = NEXT[tab] ?? null;
  const nextTab = nextStep ? (tabs.find((item) => item.key === nextStep.to) ?? null) : null;

  // The open tab's checklist, submitted on its own; and — on the tab where the
  // stage ends (no next tab here) — Proceed, once every item on it is done.
  const tabSection = section && !["history", "requests"].includes(tab) ? section : null;
  const tabLabel = tabs.find((item) => item.key === tab)?.label ?? "";
  const submitTab = async () => {
    if (!tabSection || !onSubmitChecklist) return true;
    setSubmitting(true);
    try {
      await onSubmitChecklist(tabSection.key);
      notify(`${tabLabel} submitted`);
      return true;
    } catch (err) {
      notifyError(typeof err === "string" ? err : err?.message || `${tabLabel} could not be submitted.`);
      return false;
    } finally {
      setSubmitting(false);
    }
  };
  const openItems = tabSection
    ? tabSection.items.filter((item) => !itemDone(tabSection, item, checklist[tabSection.key] ?? {}, ctx)).map((item) => item.label)
    : [];
  const proceedHere = Boolean(onProceed && tabSection && !nextTab);
  const proceedBlockers = [...openItems, ...(canProceed ? [] : ["permission to move the job on"])];
  const checklistFor = (key, intro = null) => {
    const entry = procurementChecklistOf(key);
    return (
      <ProcurementChecklist
        section={entry}
        job={job}
        canEdit={canEdit}
        canApprove={canApprove}
        onChange={(patch) => onChecklistChange?.(entry.key, patch)}
        upload={canEdit || canApprove ? onUpload : null}
        intro={intro}
      />
    );
  };

  const body = (
    <>
      {showSteps ? (
        <WorkflowSteps current={step} viewing={stepForTab(tab, step)} round={currentRound(job)} onSelect={(key) => setTab(tabForStep(key))} />
      ) : null}
      {error ? (
        <Alert tone="danger" style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
            <span>{error}</span>
            {onClearError ? (
              <button type="button" className="btn btn-ghost btn-sm" style={{ marginLeft: "auto" }} onClick={onClearError}>
                Dismiss
              </button>
            ) : null}
          </div>
        </Alert>
      ) : null}
      <Tabs items={tabs} value={tab} onChange={setTab} />
      <div className="panel">
        {tab === "boq" ? (
          <>
            <BoqVerification job={job} canEdit={canEdit} onSave={onSaveBoq} />
            <div className="cl-divider" />
            {checklistFor("boq", <SiteInspectionLinks job={job} />)}
            <BoqOrderList job={job} />
          </>
        ) : tab === "quote" ? (
          <>
            <SupplierQuotes job={job} canEdit={canEdit} onAdd={onAddQuote} onRemove={onRemoveQuote} />
            <BoqPricing job={job} canEdit={canEdit} onSave={onSaveBoq} />
            <div className="cl-divider" />
            {checklistFor("quote")}
          </>
        ) : tab === "variation" ? (
          <PriceVariationCheck job={job} />
        ) : tab === "approvals" ? (
          <ApprovalsPanel job={job} canEdit={canEdit} />
        ) : tab === "po" ? (
          <>
            <PurchaseOrders job={job} canEdit={canEdit} onCreate={onCreatePurchaseOrder} onUpdate={onUpdatePurchaseOrder} onDelete={onDeletePurchaseOrder} />
            <div className="cl-divider" />
            {checklistFor("po")}
          </>
        ) : tab === "receipt" ? (
          <>
            <Deliveries job={job} />
            {checklistFor("receipt")}
          </>
        ) : tab === "requests" && requests ? (
          requests
        ) : section ? (
          checklistFor(section.key)
        ) : (
          <ProcurementHistory job={job} />
        )}
        {nextTab || (tabSection && canEdit && onSubmitChecklist) || proceedHere ? (
          <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {tabSection && canEdit && onSubmitChecklist ? (
              <button type="button" className="btn btn-ghost btn-sm" onClick={submitTab} disabled={submitting}>
                {submitting ? "Submitting…" : `Submit ${tabLabel}`}
              </button>
            ) : null}
            {nextTab ? (
              <ContinueButton nextLabel={nextTab.label} blockers={nextStep.blockers} onContinue={canEdit && onSubmitChecklist ? submitTab : undefined} onDone={() => setTab(nextTab.key)} />
            ) : null}
            {proceedHere ? (
              <ContinueButton
                verb="Proceed"
                nextLabel={proceedLabel}
                blockers={proceedBlockers}
                onContinue={async () => (canEdit && onSubmitChecklist ? (await submitTab()) && onProceed() : onProceed())}
              />
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );

  const people = [job.salesperson ? `${job.salesperson} (sales)` : null, job.coordinator ? `${job.coordinator} (coordinator)` : null].filter(Boolean);
  const accepted = job.acceptedValue !== null && job.acceptedValue !== undefined ? `${formatCurrency(job.acceptedValue)} inc GST accepted` : null;

  if (embedded) {
    return (
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 6 }}>
          <span className="row-meta">{[job.number, job.customer, accepted].filter(Boolean).join(" · ")}</span>
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
      sub={[job.site, accepted, ...people].filter(Boolean).join(" · ")}
      actions={<Badge tone={status.tone}>{status.label}</Badge>}
    >
      {body}
    </Card>
  );
}
