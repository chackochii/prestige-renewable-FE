// One approvals checklist on a job — CL-07 DNSP application, CL-08 DA
// applicability or CL-09 finance application — drawn by the shared
// ChecklistForm. This file supplies what comes from the job record: the rows
// the auto-filled items show, and the conditions the rules need.
//
// `job` comes from useApprovalChecklists (it carries `checklist`);
// `onChange(patch)` merges answers into this section.

import ChecklistForm from "@/components/ChecklistForm";
import { approvalContext, recordedNmi } from "@/helpers/approvalChecklist";
import { formatCurrency } from "@/utils/formatCurrency";

/** What an auto-filled item shows, as [label, value, missingText?] rows from the job record. */
function approvalAutoRows(source, job, checklist) {
  const system = job.system ?? {};
  const systemRows = [
    ["System size", system.sizeKw ? `${system.sizeKw} kW` : null],
    ["Panels", system.panels],
    ["Inverter", system.inverter],
    ["Battery", system.battery ?? "None"],
  ];
  switch (source) {
    case "customer":
      return [
        ["Customer", job.customer],
        ["Installation address", job.site],
        ["Phase", job.phase],
        ["Existing system", job.existingSystem],
      ];
    case "system":
      return systemRows;
    case "council":
      return [
        ["Property address", job.site],
        ["Local council", job.council],
      ];
    case "contact":
      return [
        ["Full name", job.contact?.name],
        ["Email", job.contact?.email],
        ["Contact number", job.contact?.phone],
      ];
    case "proposal":
      return [...systemRows, ["Total quoted amount", formatCurrency(job.acceptedValue)]];
    case "nmi":
      return [["NMI", recordedNmi(checklist), "Not recorded yet — item 2 on the DNSP application"]];
    default:
      return [];
  }
}

export default function ApprovalChecklist({ section, job, canEdit = false, onChange }) {
  const checklist = job.checklist ?? {};
  return (
    <ChecklistForm
      section={section}
      answers={checklist[section.key] ?? {}}
      ctx={approvalContext(checklist)}
      canEdit={canEdit}
      autoRows={(source) => approvalAutoRows(source, job, checklist)}
      onChange={onChange}
    />
  );
}
