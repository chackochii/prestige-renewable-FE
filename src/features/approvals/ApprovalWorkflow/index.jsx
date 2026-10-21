// One job's passage through approvals: the overview (its approvals and the
// "All approved?" gate, and which approvals it needs), the Operations
// Coordinator's checklists for the ones that have one — CL-07 DNSP, CL-08 DA,
// CL-09 finance — and the history. Once every approval is through the job
// goes to procurement by itself.
//
// `job` comes from useApprovalJob (its checklist-driven approvals already read
// from their answers); `onChecklistChange(sectionKey, patch)`,
// `onUpdateItem(type, body)` and `onSetRequired(keys, custom?)` change it —
// `custom` ([{ label }]) adds approvals the unit's list does not have.
// `canEdit` — the person may work the approvals (approvals.update).
//
// Checklist answers save by themselves a moment after they are given; the
// Save bar on each checklist (`onSaveChecklist(sectionKey)` +
// `checklistSaveState(sectionKey)` → { dirty, saving, savedAt }) sends them
// at once and shows "Unsaved changes" / "Saved just now", so nobody has to
// wonder whether what they typed is on the record.
//
// `embedded` drops the card chrome for use inside another card — the
// opportunity page's stage-5 panel already has a heading of its own.

import { useEffect, useState } from "react";
import { Building2, ClipboardCheck, Clock, Landmark, ListChecks, Plug, Plus, Save, SquareCheckBig } from "lucide-react";
import Alert from "@/components/Alert";
import ContinueButton from "@/components/ContinueButton";
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
import { applicableItems, approvalItems, approvalStatus, isOverdue } from "@/helpers/approvals";
import { catalogueOf } from "@/helpers/requiredApprovals";

// The "+ Add approval" choice that types a name instead of picking from the unit's list.
const CUSTOM_APPROVAL = "__custom";
import { checklistSummary } from "@/helpers/checklist";
import { formatDate, slaStatus, timeAgo } from "@/helpers/dateTimeHelpers";
import { useNotifications } from "@/hooks/useNotifications";
import { formatCurrency } from "@/utils/formatCurrency";

const CHECKLIST_ICONS = { dnsp: Plug, da: Building2, finance: Landmark };

/**
 * `saveError` is why the last checklist save was refused (useApprovalJob);
 * the answers on screen have already gone back to what the API holds, so the
 * reason has to stay up until it is dismissed or the next save goes through.
 */
export default function ApprovalWorkflow({
  job,
  canEdit = false,
  onChecklistChange,
  onSaveChecklist,
  checklistSaveState,
  onUpdateItem,
  onSetRequired,
  saveError = null,
  onDismissSaveError,
  embedded = false,
  // Proceed to procurement from the last approval form; `canProceed` — may this person move the job on.
  onProceed = null,
  canProceed = false,
}) {
  const { notify, error: notifyError } = useNotifications();
  const [tab, setTab] = useState("overview");
  const [choosing, setChoosing] = useState(false);
  // "+ Add approval": one approval from the unit's list, added to the job.
  const [adding, setAdding] = useState(false);
  const [addKey, setAddKey] = useState("");
  const [customName, setCustomName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingChecklist, setSavingChecklist] = useState(false);
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
  // The unit's approval types this job does not have yet — what "+ Add approval" offers.
  const catalogue = catalogueOf({ approvalTypes: job.catalogue });
  const requiredKeys = Array.isArray(job.requiredApprovals) ? job.requiredApprovals : [];
  const addable = catalogue.filter((type) => !requiredKeys.includes(type.key));

  const saveRequired = async (keys, custom) => {
    setSaving(true);
    setError("");
    try {
      await onSetRequired?.(keys, custom);
      return true;
    } catch (err) {
      setError(typeof err === "string" ? err : err?.message || "The approvals required could not be changed.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  // Proceed to procurement, from the last approval form: open once every
  // approval checklist is complete and every required approval is approved —
  // what the API's gate asks (a job that got there has usually moved on by
  // itself already; then this only opens procurement).
  const proceedBlockers = movedOn
    ? []
    : [
        ...checklists.filter(({ summary }) => summary.applies !== false && summary.done < summary.total).map(({ section: s, summary }) => `${s.tab} checklist (${summary.total - summary.done} left)`),
        ...applicableItems(job).filter((item) => item.status !== "approved").map((item) => `${item.label} approved`),
        ...(canProceed ? [] : ["permission to move jobs out of Approvals"]),
      ];
  const proceedButton = onProceed ? (
    <ContinueButton verb="Proceed" nextLabel={APPROVALS_STAGE.next.label} blockers={proceedBlockers} onContinue={onProceed} />
  ) : null;

  // The approval checklist after the open one, in tab order — each is independent, so it is always reachable.
  const checklistAt = checklists.findIndex(({ section: candidate }) => candidate.key === tab);
  const nextChecklist = checklistAt >= 0 ? (checklists[checklistAt + 1] ?? null) : null;
  /** Submit: send this approval's answers now. Resolves false when they could not be saved. */
  const submitChecklist = async () => {
    if (!section || !onSaveChecklist) return true;
    setSavingChecklist(true);
    try {
      await onSaveChecklist(section.key);
      notify(`${section.tab} submitted`);
      return true;
    } catch (err) {
      notifyError(typeof err === "string" ? err : err?.message || "The checklist could not be saved.");
      return false;
    } finally {
      setSavingChecklist(false);
    }
  };

  /** The open checklist's Save button: sends what is waiting and says so. */
  const saveChecklistNow = async () => {
    if (!section || !onSaveChecklist) return;
    setSavingChecklist(true);
    try {
      // true: answers were sent (now, or a save already on its way has landed).
      const sent = await onSaveChecklist(section.key);
      notify(sent ? `${section.tab} saved` : `${section.tab} saved — everything was already on the record`);
    } catch (err) {
      notifyError(typeof err === "string" ? err : err?.message || "The checklist could not be saved.");
    } finally {
      setSavingChecklist(false);
    }
  };

  // The save bar on the open checklist: where its answers stand, and Save.
  const checklistEditable = canEdit && !movedOn;
  const saveState = section && checklistSaveState ? checklistSaveState(section.key) : null;
  const saveBar =
    section && checklistEditable && onSaveChecklist ? (
      <span className="save-bar">
        <span className={`row-meta${saveState?.dirty ? " is-dirty" : ""}`}>
          {saveState?.dirty ? "Unsaved changes" : saveState?.saving ? "Saving…" : saveState?.savedAt ? `Saved ${timeAgo(saveState.savedAt)}` : "All changes saved"}
        </span>
        <button
          type="button"
          className={`btn btn-sm ${saveState?.dirty ? "btn-primary" : "btn-ghost"}`}
          onClick={saveChecklistNow}
          disabled={savingChecklist || saveState?.saving}
          title={saveState?.dirty ? "Save what you have entered" : "Everything is saved — save again anyway"}
        >
          <Save size={14} /> {savingChecklist || saveState?.saving ? "Saving…" : "Save"}
        </button>
      </span>
    ) : null;

  const body = (
    <>
      {saveError ? (
        <Alert tone="danger" style={{ marginBottom: 14, display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between" }}>
          <span>
            <strong>Your last checklist answers were not saved.</strong> {saveError} The checklist now shows what is on record — enter
            the answers again.
          </span>
          {onDismissSaveError ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onDismissSaveError}>
              Dismiss
            </button>
          ) : null}
        </Alert>
      ) : null}
      {isOverdue(job) ? (
        <Alert tone="danger" style={{ marginBottom: 14 }}>
          Past the approvals timeline — due {formatDate(job.slaDueAt, { withTime: true })} ({slaStatus(job.slaDueAt).label}).
        </Alert>
      ) : null}
      <Tabs items={tabs} value={tab} onChange={setTab} />
      <div className="panel">
        {tab === "overview" ? (
          <>
            {/* First on the overview, so adding an approval is the first thing in reach. */}
            <div>
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
                <>
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
                    <>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          setAddKey("");
                          setCustomName("");
                          setAdding(true);
                        }}
                        disabled={adding}
                      >
                        <Plus size={14} /> Add approval
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={() => setChoosing(true)}>
                        Change
                      </button>
                    </>
                  ) : null}
                </div>
                {adding ? (
                  <div className="decision-card" style={{ marginTop: 10, display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                    <select value={addKey} onChange={(e) => setAddKey(e.target.value)} disabled={saving} aria-label="Approval to add" style={{ minWidth: 220 }}>
                      <option value="">Choose an approval</option>
                      {addable.map((type) => (
                        <option key={type.key} value={type.key}>
                          {type.label}
                        </option>
                      ))}
                      <option value={CUSTOM_APPROVAL}>Other (custom approval)…</option>
                    </select>
                    {addKey === CUSTOM_APPROVAL ? (
                      <input
                        type="text"
                        value={customName}
                        maxLength={120}
                        placeholder="Name the approval, e.g. Strata approval"
                        aria-label="Custom approval name"
                        onChange={(e) => setCustomName(e.target.value)}
                        style={{ minWidth: 240 }}
                        autoFocus
                      />
                    ) : null}
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={!addKey || (addKey === CUSTOM_APPROVAL && !customName.trim()) || saving}
                      onClick={async () => {
                        const custom = addKey === CUSTOM_APPROVAL;
                        const keys = custom ? requiredKeys : catalogue.map((type) => type.key).filter((key) => key === addKey || requiredKeys.includes(key));
                        const added = await saveRequired(keys, custom ? [{ label: customName.trim() }] : undefined);
                        if (added) {
                          notify(`${custom ? customName.trim() : (catalogue.find((type) => type.key === addKey)?.label ?? "Approval")} added`);
                          setAdding(false);
                        }
                      }}
                    >
                      {saving ? "Adding…" : "Add"}
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding(false)} disabled={saving}>
                      Cancel
                    </button>
                    {error ? (
                      <Alert tone="danger" style={{ marginTop: 6, width: "100%" }}>
                        {error}
                      </Alert>
                    ) : null}
                  </div>
                ) : null}
                </>
              )}
            </div>

            <div style={{ marginTop: 20 }}>
              <ApprovalBoard job={job} canEdit={canEdit} onOpenChecklist={setTab} onUpdateItem={onUpdateItem} />
            </div>

            {checklists.length ? (
              <div style={{ marginTop: 20 }}>
                <div className="row-title" style={{ marginBottom: 8 }}>
                  Checklists
                </div>
                <ChecklistOverview rows={checklists} onOpen={setTab} />
              </div>
            ) : null}

            {checklists.length ? (
              <ContinueButton style={{ marginTop: 16 }} nextLabel={checklists[0].section.tab} onDone={() => setTab(checklists[0].section.key)} />
            ) : proceedButton ? (
              // No approval needs a checklist: the overview is the last form.
              <div style={{ marginTop: 16 }}>{proceedButton}</div>
            ) : null}
          </>
        ) : section ? (
          <>
            <ApprovalChecklist section={section} job={job} canEdit={checklistEditable} onChange={(patch) => onChecklistChange?.(section.key, patch)} actions={saveBar} />
            {/* Each approval is its own form: Submit sends it, and the next one
                opens whether or not this one is finished. */}
            <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {nextChecklist ? (
                <ContinueButton verb={checklistEditable ? "Submit & continue" : "Continue"} nextLabel={nextChecklist.section.tab} onContinue={checklistEditable ? submitChecklist : undefined} onDone={() => setTab(nextChecklist.section.key)} />
              ) : (
                <>
                  {checklistEditable ? (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={submitChecklist} disabled={savingChecklist}>
                      {savingChecklist ? "Submitting…" : `Submit ${section.tab}`}
                    </button>
                  ) : null}
                  {/* The last approval form: the stage's way out. */}
                  {proceedButton}
                </>
              )}
            </div>
          </>
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
            {job.acceptedValue !== null && job.acceptedValue !== undefined ? ` · ${formatCurrency(job.acceptedValue)} inc GST accepted` : ""}
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
      sub={[job.site, job.acceptedValue !== null && job.acceptedValue !== undefined ? `${formatCurrency(job.acceptedValue)} inc GST accepted` : null, job.salesperson?.name ? `${job.salesperson.name} (sales)` : null]
        .filter(Boolean)
        .join(" · ")}
      actions={<Badge tone={status.tone}>{status.label}</Badge>}
    >
      {body}
    </Card>
  );
}
