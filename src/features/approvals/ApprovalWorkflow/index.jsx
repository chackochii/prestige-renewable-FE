// One job's passage through approvals: the overview (the four tracks and the
// "All approved?" gate), the Operations Coordinator's checklists — CL-07 DNSP
// application, CL-08 DA applicability and CL-09 finance application — the
// notifications raised and the history. Once every approval is through the
// job goes to procurement, where it is created in Green Deal (CL-10).
//
// `job` comes from useApprovalChecklists: its tracks are driven by its
// checklist answers, and `onChecklistChange(sectionKey, patch)` changes them.
// `canEdit` — the person may complete the checklists (approvals.update).
//
// `embedded` drops the card chrome for use inside another card — the
// opportunity page's stage-5 panel already has a heading of its own.

import { useEffect, useState } from "react";
import { BellRing, Building2, ClipboardCheck, Clock, Landmark, Plug, SquareCheckBig } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Card from "@/components/Card";
import ChecklistOverview from "@/components/ChecklistOverview";
import Tabs from "@/components/Tabs";
import ApprovalBoard from "@/features/approvals/ApprovalBoard";
import ApprovalChecklist from "@/features/approvals/ApprovalChecklist";
import ApprovalNotifications from "@/features/approvals/ApprovalNotifications";
import ProcurementHistory from "@/features/procurement/ProcurementHistory";
import { APPROVAL_CHECKLISTS } from "@/constants/approvalChecklists";
import { approvalContext } from "@/helpers/approvalChecklist";
import { approvalStatus, isOverdue } from "@/helpers/approvals";
import { checklistSummary } from "@/helpers/checklist";
import { formatDate, slaStatus } from "@/helpers/dateTimeHelpers";
import { formatCurrency } from "@/utils/formatCurrency";

const CHECKLIST_ICONS = { dnsp: Plug, da: Building2, finance: Landmark };

export default function ApprovalWorkflow({ job, canEdit = false, onChecklistChange, embedded = false }) {
  const [tab, setTab] = useState("overview");

  // A different job opens on its overview, not wherever the last one was.
  useEffect(() => {
    setTab("overview");
  }, [job?.id]);

  if (!job) return null;

  const status = approvalStatus(job);
  const checklist = job.checklist ?? {};
  const ctx = approvalContext(checklist);
  const checklists = APPROVAL_CHECKLISTS.map((section) => ({ section, summary: checklistSummary(section, checklist[section.key] ?? {}, ctx) }));
  const tabs = [
    { key: "overview", label: "Overview", icon: <ClipboardCheck size={14} /> },
    ...checklists.map(({ section, summary }) => {
      const Icon = CHECKLIST_ICONS[section.key] ?? ClipboardCheck;
      return { key: section.key, label: section.tab, icon: <Icon size={14} />, count: summary.applies ? `${summary.done}/${summary.total}` : undefined };
    }),
    { key: "notifications", label: "Notifications", icon: <BellRing size={14} />, count: (job.notifications ?? []).length || undefined },
    { key: "history", label: "History", icon: <Clock size={14} />, count: (job.history ?? []).length },
  ];
  const section = APPROVAL_CHECKLISTS.find((candidate) => candidate.key === tab) ?? null;

  const body = (
    <>
      {isOverdue(job) ? (
        <Alert tone="danger" style={{ marginBottom: 14 }}>
          Past the approvals timeline — due {formatDate(job.slaDueAt, { withTime: true })} ({slaStatus(job.slaDueAt).label}).
        </Alert>
      ) : null}
      <Tabs items={tabs} value={tab} onChange={setTab} />
      <div className="panel">
        {tab === "overview" ? (
          <>
            <ApprovalBoard job={job} />
            <div style={{ marginTop: 20 }}>
              <div className="row-title" style={{ marginBottom: 8 }}>
                Checklists
              </div>
              <ChecklistOverview rows={checklists} onOpen={setTab} />
            </div>
          </>
        ) : section ? (
          <ApprovalChecklist section={section} job={job} canEdit={canEdit} onChange={(patch) => onChecklistChange?.(section.key, patch)} />
        ) : tab === "notifications" ? (
          <ApprovalNotifications job={job} />
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
      icon={<SquareCheckBig size={16} />}
      sub={`${job.site} · ${formatCurrency(job.acceptedValue)} accepted · ${job.salesperson} (sales)`}
      actions={<Badge tone={status.tone}>{status.label}</Badge>}
    >
      {body}
    </Card>
  );
}
