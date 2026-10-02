// One approvals checklist on a job — CL-07 DNSP application, CL-08 DA
// applicability or CL-09 finance application — drawn by the shared
// ChecklistForm. This file supplies what comes from the job record: the rows
// the auto-filled items show, and the conditions the rules need.
//
// `job` comes from useApprovalJob (its items carry their checklist answers);
// `onChange(patch)` merges answers into this section.

import ChecklistForm from "@/components/ChecklistForm";
import { answersOf, approvalContext, checklistOf, recordedNmi } from "@/helpers/approvalChecklist";
import { formatCurrency } from "@/utils/formatCurrency";

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
        ["Phase", job.phase, NOT_RECORDED],
        ["Existing system", job.existingSystem],
      ];
    case "system":
      return systemRows;
    case "council":
      return [
        ["Property address", job.site, NOT_RECORDED],
        ["Local council", job.council, "Not captured on the lead — confirm it from the address"],
      ];
    case "contact":
      return [
        ["Full name", job.contact?.name, NOT_RECORDED],
        ["Email", job.contact?.email, NOT_RECORDED],
        ["Contact number", job.contact?.phone, NOT_RECORDED],
      ];
    case "proposal":
      return [...systemRows, ["Total quoted amount", job.acceptedValue !== null && job.acceptedValue !== undefined ? formatCurrency(job.acceptedValue) : null, "No accepted proposal on the job"]];
    case "nmi":
      return [["NMI", recordedNmi(checklist), "Not recorded yet — item 2 on the DNSP application"]];
    default:
      return [];
  }
}

export default function ApprovalChecklist({ section, job, canEdit = false, onChange }) {
  const checklist = checklistOf(job);
  return (
    <ChecklistForm
      section={section}
      answers={answersOf(checklist, section.key)}
      ctx={approvalContext(checklist)}
      canEdit={canEdit}
      autoRows={(source) => approvalAutoRows(source, job, checklist)}
      onChange={onChange}
    />
  );
}
