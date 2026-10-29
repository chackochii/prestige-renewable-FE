// One approvals checklist on a job — network connection (DNSP), council (DA)
// or finance — drawn by the shared
// ChecklistForm. This file supplies what comes from the job record: the rows
// the auto-filled items show, and the conditions the rules need.
//
// The DNSP network dropdown (item 1 on the DNSP checklist) is filled from the list the
// system administrator keeps under Superadmin → DNSP networks.
//
// `job` comes from useApprovalJob (its items carry their checklist answers);
// `onChange(patch)` merges answers into this section. `actions` is the save
// bar the workflow puts at the top and bottom of the checklist.

import { useMemo } from "react";
import ChecklistForm from "@/components/ChecklistForm";
import { dnspNetworkOptions, useDnspNetworks } from "@/hooks/useDnspNetworks";
import { answersOf, approvalContext, checklistOf, financeNeedsReview, financeSummaryRows, paysByFinance, recordedNmi } from "@/helpers/approvalChecklist";
import { formatCurrency } from "@/utils/formatCurrency";
import { FINANCE_LODGED_STATUSES, financeProductsFor } from "@/constants/approvalChecklists";
import { approvalLabel } from "@/helpers/requiredApprovals";

const NOT_RECORDED = "Not recorded on the job";

/** What an auto-filled item shows, as [label, value, missingText?] rows from the job record. */
function approvalAutoRows(source, job, checklist) {
  const system = job.system ?? {};
  const systemRows = [
    ["System size", system.sizeKw ? `${system.sizeKw} kW` : null, NOT_RECORDED],
    ["Panels", system.panels, NOT_RECORDED],
    ["Inverter", system.inverter, NOT_RECORDED],
    ["Battery", system.battery ?? "None"],
  ];
  switch (source) {
    case "customer":
      return [
        ["Customer", job.customer],
        ["Installation address", job.site, NOT_RECORDED],
        ["Electrical Phase", job.phase, NOT_RECORDED],
        ["Existing system", job.existingSystem],
      ];
    case "system":
      return systemRows;
    case "council":
      return [["Property address", job.site, NOT_RECORDED]];
    case "financeSummary":
      // The customer and the accepted proposal, confirmed in one tick.
      return financeSummaryRows(job, checklist);
    case "contact":
      return [
        ["Full name", job.contact?.name, NOT_RECORDED],
        ["Email", job.contact?.email, NOT_RECORDED],
        ["Contact number", job.contact?.phone, NOT_RECORDED],
      ];
    case "proposal":
      return [...systemRows, ["Total quoted amount ($, inc GST)", job.acceptedValue !== null && job.acceptedValue !== undefined ? formatCurrency(job.acceptedValue) : null, "No accepted proposal on the job"]];
    case "nmi":
      return [["NMI", recordedNmi(checklist), "Not recorded yet - item 2 on the DNSP application"]];
    default:
      return [];
  }
}

/** The section with its API-backed dropdowns filled in. */
function withOptions(section, answers, networks) {
  if (!section.items.some((item) => item.optionsFrom === "dnspNetworks")) return section;
  return {
    ...section,
    items: section.items.map((item) =>
      item.optionsFrom === "dnspNetworks" ? { ...item, options: dnspNetworkOptions(networks, answers[item.key]) } : item,
    ),
  };
}

/**
 * The DA's status follows from the answers when they already say it: an
 * exemption applies and neither the solar nor the battery needs a DA, so
 * Exempt is chosen for the coordinator (while nothing else has been chosen).
 */
function withAutoExempt(section, answers, patch) {
  if (section.key !== "da") return patch;
  const next = { ...answers, ...patch };
  const exempt = next.exemptionApplies === "yes" && next.solarNeedsDa === "no" && ["no", "na"].includes(next.batteryNeedsDa);
  return exempt && (!next.status || next.status === "not_started") ? { ...patch, status: "exempt" } : patch;
}

/** The finance amount is worked out, not typed: the accepted quote less the deposit. */
function financeAmountFor(job, deposit) {
  const total = Number(job?.acceptedValue);
  if (!Number.isFinite(total) || deposit === "" || deposit === null || deposit === undefined || !Number.isFinite(Number(deposit))) return "";
  return String(Math.max(0, Math.round((total - Number(deposit)) * 100) / 100));
}

/**
 * What the finance details start from: a deposit of 0 (so the finance amount
 * is the quote total), and for a commercial lead the business on the lead.
 */
function financeDefaults(job) {
  const business = job?.business ?? null;
  return {
    deposit: "0",
    ...(job?.leadType === "commercial" ? { propertyType: "commercial" } : {}),
    ...(business?.name ? { businessName: business.name } : {}),
    ...(business?.abn ? { abn: business.abn } : {}),
  };
}

/** The defaults not answered yet, so they are saved with the first change. */
const unsaved = (defaults, saved) => Object.fromEntries(Object.entries(defaults).filter(([key]) => saved[key] === undefined));

function withFinanceAmount(section, job, saved, patch) {
  if (section.key !== "finance") return patch;
  const next = { ...unsaved(financeDefaults(job), saved), ...patch };
  // A product or term that does not fit the new provider or property type is cleared rather than kept.
  if ("financeProvider" in patch || "propertyType" in patch) {
    const merged = { ...saved, ...next };
    if (merged.financeOption && !financeProductsFor(merged).some((option) => option.value === merged.financeOption)) {
      next.financeOption = "";
      next.termMonths = "";
    }
  }
  if ("propertyType" in patch) next.occupancy = "";
  // The quote total the application went in against - a later change flags it Needs Review.
  if ("status" in patch) {
    const lodged = FINANCE_LODGED_STATUSES.includes(patch.status);
    if (lodged && !FINANCE_LODGED_STATUSES.includes(saved.status)) next.submittedQuoteTotal = job?.acceptedValue ?? null;
    if (!lodged) next.submittedQuoteTotal = null;
  }
  return { ...next, financeAmount: financeAmountFor(job, { ...saved, ...next }.deposit) };
}

/** Back to the start with another product: the lodgement and the decision are cleared. */
const RESUBMIT = {
  status: "not_started",
  financeOption: "",
  financeOptionOther: "",
  termMonths: "",
  reference: "",
  submittedOn: "",
  infoRequested: "",
  decidedOn: "",
  approvedAmount: "",
  shortfallNote: "",
  conditions: "",
  declineReason: "",
  notifiedOn: "",
  submittedQuoteTotal: null,
};

/**
 * `onOpenApproval(key)` - opens another approval on the job, adding it first
 * when it is not required yet (a finance flag: a tenant needs Landlord Consent).
 * `requiredKeys` - the approvals the job already has.
 */
export default function ApprovalChecklist({
  section,
  job,
  canEdit = false,
  onChange,
  actions = null,
  onOpenApproval = null,
  requiredKeys = [],
  onChangePaymentMethod = null,
  onResolveRejection = null,
  upload = null,
  lapseOnly = false,
}) {
  const checklist = checklistOf(job);
  const saved = answersOf(checklist, section.key);
  // The council comes from the job until the coordinator confirms or changes it.
  const answers = useMemo(() => {
    if (section.key === "da" && saved.council === undefined && job.council) return { ...saved, council: job.council };
    if (section.key === "finance") {
      // Defaults shown until saved; the amount always worked out, even where it was saved before the quote changed.
      const shown = { ...unsaved(financeDefaults(job), saved), ...saved };
      return { ...shown, financeAmount: financeAmountFor(job, shown.deposit) };
    }
    return saved;
  }, [section.key, saved, job]);
  const { networks } = useDnspNetworks();
  const resolved = useMemo(() => withOptions(section, answers, networks), [section, answers, networks]);
  return (
    <ChecklistForm
      section={resolved}
      answers={answers}
      ctx={approvalContext(checklist, job)}
      lapseOnly={lapseOnly}
      // Files go on the job, not just their names on the answers.
      upload={upload ? (_itemKey, files) => upload(files) : null}
      canEdit={canEdit}
      autoRows={(source) => approvalAutoRows(source, job, checklist)}
      // Section 1's gaps come from the accepted proposal: fixed in Estimation.
      autoFix={() => ({ href: `/opportunities/${job.id}?stage=2`, label: "Edit in Estimation" })}
      flagAction={(flag) =>
        flag.approval && onOpenApproval ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => onOpenApproval(flag.approval)} disabled={!canEdit && !requiredKeys.includes(flag.approval)}>
            {requiredKeys.includes(flag.approval) ? "Open" : "Add"} {approvalLabel(flag.approval)}
          </button>
        ) : null
      }
      statusActions={(status, current) => {
        if (!canEdit) return null;
        // Rejected (declined, refused): resubmit, return the job, change approach or close it - with a reason.
        const resolveButton =
          status.track === "rejected" && !["revoked", "expired"].includes(status.value) && onResolveRejection ? (
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onResolveRejection(section.key)}>
              Resolve Rejection
            </button>
          ) : null;
        if (section.key !== "finance")
          return resolveButton ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>{resolveButton}</div> : null;
        const changeMethod = onChangePaymentMethod ? (
          <button type="button" className="btn btn-ghost btn-sm" onClick={onChangePaymentMethod}>
            Change Payment Method
          </button>
        ) : null;
        const buttons =
          status.value === "declined" ? (
            // Declined: the resolution options (with a reason), or straight to another product or payment method.
            <>
              {resolveButton}
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange?.(RESUBMIT)}>
                Resubmit with a Different Product
              </button>
              {changeMethod}
            </>
          ) : status.value === "withdrawn" && paysByFinance(job) ? (
            changeMethod
          ) : financeNeedsReview(current, job) ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange?.({ submittedQuoteTotal: job.acceptedValue })}>
              Mark as Reviewed
            </button>
          ) : null;
        return buttons ? <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>{buttons}</div> : null;
      }}
      onChange={(patch) => onChange?.(withFinanceAmount(section, job, saved, withAutoExempt(section, answers, patch)))}
      actions={actions}
    />
  );
}
