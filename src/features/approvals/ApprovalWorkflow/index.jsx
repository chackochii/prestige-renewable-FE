// One job's passage through approvals: the overview (its approvals and the
// "All approved?" gate, and which approvals it needs), the Operations
// Coordinator's checklists for the ones that have one — CL-07 DNSP, CL-08 DA,
// CL-09 finance — and the history. Once every approval is through the job
// goes to procurement by itself.
//
// `job` comes from useApprovalJob (its checklist-driven approvals already read
// from their answers); `onChecklistChange(sectionKey, patch)`,
// `onUpdateItem(type, body)` and `onSetRequired(keys)` change it.
// `canEdit` — the person may work the approvals (approvals.update).
//
// `embedded` drops the card chrome for use inside another card — the
// opportunity page's stage-5 panel already has a heading of its own.

import { useEffect, useState } from "react";
import { Building2, ClipboardCheck, Clock, Landmark, ListChecks, Plug, SquareCheckBig } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Card from "@/components/Card";
import ChecklistOverview from "@/components/ChecklistOverview";
import SectionHead from "@/components/SectionHead";
import Tabs from "@/components/Tabs";
import ApprovalBoard from "@/features/approvals/ApprovalBoard";
import ApprovalChecklist from "@/features/approvals/ApprovalChecklist";
import RequiredApprovalsPicker from "@/features/approvals/RequiredApprovalsPicker";
import ProcurementHistory from "@/features/procurement/ProcurementHistory";
import { APPROVALS_STAGE } from "@/constants/approvals";
import { approvalContext, checklistOf, sectionOf } from "@/helpers/approvalChecklist";
import { approvalItems, approvalStatus, isOverdue } from "@/helpers/approvals";
import { checklistSummary } from "@/helpers/checklist";
import { formatDate, slaStatus } from "@/helpers/dateTimeHelpers";
import { formatCurrency } from "@/utils/formatCurrency";

const CHECKLIST_ICONS = { dnsp: Plug, da: Building2, finance: Landmark };

export default function ApprovalWorkflow({ job, canEdit = false, onChecklistChange, onUpdateItem, onSetRequired, embedded = false }) {
  const [tab, setTab] = useState("overview");
  const [choosing, setChoosing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // A different job opens on its overview, not wherever the last one was.
  useEffect(() => {
    setTab("overview");
    setChoosing(false);
  }, [job?.id]);

  if (!job) return null;

  const status = approvalStatus(job);
  const checklist = checklistOf(job);
  const ctx = approvalContext(checklist);
  const movedOn = Number(job.stage) > APPROVALS_STAGE.id;
  // Only the checklists this job's approvals call for.
  const checklists = approvalItems(job)
    .map(sectionOf)
    .filter(Boolean)
    .map((section) => ({ section, summary: checklistSummary(section, checklist[section.key] ?? {}, ctx) }));
  const tabs = [
    { key: "overview", label: "Overview", icon: <ClipboardCheck size={14} /> },
    ...checklists.map(({ section, summary }) => {
      const Icon = CHECKLIST_ICONS[section.key] ?? ClipboardCheck;
      return { key: section.key, label: section.tab, icon: <Icon size={14} />, count: `${summary.done}/${summary.total}` };
    }),
    { key: "history", label: "History", icon: <Clock size={14} />, count: (job.history ?? []).length || undefined },
  ];
  const section = checklists.find(({ section: candidate }) => candidate.key === tab)?.section ?? null;

  const saveRequired = async (keys) => {
    setSaving(true);
    setError("");
    try {
      await onSetRequired?.(keys);
    } catch (err) {
      setError(typeof err === "string" ? err : err?.message || "The approvals required could not be changed.");
    } finally {
      setSaving(false);
    }
  };

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
            <ApprovalBoard job={job} canEdit={canEdit} onOpenChecklist={setTab} onUpdateItem={onUpdateItem} />

            <div style={{ marginTop: 20 }}>
              <SectionHead icon={<ListChecks size={13} />} title="Approvals required" />
              <p className="row-meta" style={{ whiteSpace: "normal", marginBottom: 8 }}>
                Ticked by sales on the lead or by estimation — the approvals tracked above.
                {canEdit && !movedOn ? " Change it here if the job needs another one, or one less." : ""}
              </p>
              {choosing ? (
                <>
                  <RequiredApprovalsPicker unit={{ approvalTypes: job.catalogue }} value={job.requiredApprovals} onChange={saveRequired} disabled={saving} />
                  {error ? (
                    <Alert tone="danger" style={{ marginTop: 10 }}>
                      {error}
                    </Alert>
                  ) : null}
                  <button type="button" className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => setChoosing(false)} disabled={saving}>
                    Done
                  </button>
                </>
              ) : (
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  {job.requiredApprovals?.length ? (
                    job.requiredApprovals.map((key) => (
                      <Badge key={key} tone="neutral">
                        {job.catalogue?.find((type) => type.key === key)?.label ?? key}
                      </Badge>
                    ))
                  ) : (
                    <span className="row-meta">None marked as required.</span>
                  )}
                  {canEdit && !movedOn ? (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setChoosing(true)}>
                      Change
                    </button>
                  ) : null}
                </div>
              )}
            </div>

            {checklists.length ? (
              <div style={{ marginTop: 20 }}>
                <div className="row-title" style={{ marginBottom: 8 }}>
                  Checklists
                </div>
                <ChecklistOverview rows={checklists} onOpen={setTab} />
              </div>
            ) : null}
          </>
        ) : section ? (
          <ApprovalChecklist section={section} job={job} canEdit={canEdit && !movedOn} onChange={(patch) => onChecklistChange?.(section.key, patch)} />
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
            {job.number} · {job.customer}
            {job.acceptedValue !== null && job.acceptedValue !== undefined ? ` · ${formatCurrency(job.acceptedValue)} accepted` : ""}
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
      sub={[job.site, job.acceptedValue !== null && job.acceptedValue !== undefined ? `${formatCurrency(job.acceptedValue)} accepted` : null, job.salesperson?.name ? `${job.salesperson.name} (sales)` : null]
        .filter(Boolean)
        .join(" · ")}
      actions={<Badge tone={status.tone}>{status.label}</Badge>}
    >
      {body}
    </Card>
  );
}
