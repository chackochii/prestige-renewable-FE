// One job's passage through approvals: the overview (which approvals it
// needs, then one card per approval), the Operations Coordinator's checklists
// for the ones that have one — network connection (DNSP), council (DA) and
// finance — and the history. When every approval is in, the job is ready to
// send to procurement.
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
//
// Once the job is sent to procurement the approvals are read-only (UAT exit
// logic, Oct 2026): documents and notes can still be added
// (`onAddAddendum(type, { note, files })`, `canAddNotes`), restricted roles
// can reopen them (`onReopen(reason)`, `canReopen`), and an Approval Review
// Needed raised by a revised quote is cleared with `onMarkReviewed(note)`.

import { useEffect, useState } from "react";
import { Building2, ClipboardCheck, Clock, Landmark, ListChecks, Plug, Plus, Save, SquareCheckBig, X } from "lucide-react";
import Alert from "@/components/Alert";
import ContinueButton from "@/components/ContinueButton";
import HoldApprovals from "@/features/approvals/HoldApprovals";
import RejectionResolution from "@/features/approvals/RejectionResolution";
import ReopenApprovals from "@/features/approvals/ReopenApprovals";
import SendToProcurement from "@/features/approvals/SendToProcurement";
import Badge from "@/components/Badge";
import Card from "@/components/Card";
import Field from "@/components/Field";
import SectionHead from "@/components/SectionHead";
import Tabs from "@/components/Tabs";
import ApprovalBoard from "@/features/approvals/ApprovalBoard";
import ApprovalChecklist from "@/features/approvals/ApprovalChecklist";
import ProcurementHistory from "@/features/procurement/ProcurementHistory";
import { APPROVALS_STAGE } from "@/constants/approvals";
import { approvalContext, checklistOf, sectionOf } from "@/helpers/approvalChecklist";
import { approvalItems, approvalStatus, approvalTimers, idleFor, isOverdue, reviewNeeded, reviewReasons } from "@/helpers/approvals";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { HANDOVER_ONLY_TYPES, approvalLabel, catalogueOf } from "@/helpers/requiredApprovals";

// The "+ Add approval" choice that types a name instead of picking from the unit's list.
const CUSTOM_APPROVAL = "__custom";
import { checklistSummary, statusBlockers } from "@/helpers/checklist";
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
  // A declined or withdrawn finance application: the customer pays another way.
  onChangePaymentMethod = null,
  // A rejected approval resolved: (type, { option, reason, newKey?, newLabel?, lostReason? }) - RJ-01..05.
  onResolveRejection = null,
  // async (files) => [{ id, filename, url }]: files evidence on the job.
  onUpload = null,
  // After the send: documents and notes, reopening, and clearing a review (see above).
  onAddAddendum = null,
  canAddNotes = false,
  onReopen = null,
  canReopen = false,
  onMarkReviewed = null,
  // On Hold, with a reason (NF-21): onHold(reason), onResume().
  onHold = null,
  onResume = null,
}) {
  const { notify, error: notifyError } = useNotifications();
  const [tab, setTab] = useState("overview");
  // "Other Approvals": one approval from the unit's list (or a named one), added to the job.
  const [addKey, setAddKey] = useState("");
  const [customName, setCustomName] = useState("");
  const [saving, setSaving] = useState(false);
  const [savingChecklist, setSavingChecklist] = useState(false);
  const [error, setError] = useState("");
  const [reviewing, setReviewing] = useState(false);
  const [resolving, setResolving] = useState(null); // the key of the rejected approval being resolved
  const { unit } = useBusinessUnit();

  // A different job opens on its overview, not wherever the last one was.
  useEffect(() => {
    setTab("overview");
  }, [job?.id]);

  if (!job) return null;

  const status = approvalStatus(job);
  const checklist = checklistOf(job);
  const ctx = approvalContext(checklist, job);
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
  const requiredKeys = (Array.isArray(job.requiredApprovals) ? job.requiredApprovals : []).filter((key) => !HANDOVER_ONLY_TYPES.includes(key));
  // Finance is not listed while the customer is not paying by finance (it counts as not applicable).
  const notFinanced = job.financeAssistance === "no";
  const shownKeys = requiredKeys.filter((key) => !(notFinanced && key === "finance"));
  const addable = catalogue.filter((type) => !requiredKeys.includes(type.key) && !(notFinanced && type.key === "finance"));

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

  // The way out: Send to Procurement, on every approvals screen (in the header) - and once sent, the way back in.
  const sendButton = (
    <>
      <SendToProcurement job={job} onSend={onProceed} canSend={canProceed} />
      <HoldApprovals job={job} onHold={onHold} onResume={onResume} canHold={canEdit} />
      <ReopenApprovals job={job} onReopen={onReopen} canReopen={canReopen} />
    </>
  );
  // A revised quote's review, cleared by whoever works the approvals.
  const markReviewed = async () => {
    const note = window.prompt("Mark the approvals as reviewed against the revised quote. Add a note (optional):", "");
    if (note === null) return;
    setReviewing(true);
    try {
      await onMarkReviewed?.(note.trim() || undefined);
      notify("Approvals marked as reviewed");
    } catch (err) {
      notifyError(typeof err === "string" ? err : err?.message || "The review could not be recorded.");
    } finally {
      setReviewing(false);
    }
  };
  // Sent: the approvals are read-only, but an approval can still be recorded as revoked or expired.
  const editable = canEdit && !movedOn;
  const lapseOnly = canEdit && movedOn;

  // The approval checklist after the open one, in tab order — each is independent, so it is always reachable.
  const checklistAt = checklists.findIndex(({ section: candidate }) => candidate.key === tab);
  const nextChecklist = checklistAt >= 0 ? (checklists[checklistAt + 1] ?? null) : null;
  /**
   * Approvals the answers call for are added by themselves (UAT, Oct 2026):
   * Strata Approval when the property is in a strata scheme, Landlord Consent
   * when the occupant is a tenant. Only when the answer is given - one
   * removed by hand afterwards stays removed.
   */
  const autoAdd = async (patch) => {
    const wanted = [
      ...(patch.strataScheme === "yes" ? [{ key: "strata", why: "the property is in a strata scheme" }] : []),
      ...(["tenant", "business_tenant"].includes(patch.occupancy) ? [{ key: "landlord", why: "the occupant is a tenant" }] : []),
    ].filter(({ key }) => !requiredKeys.includes(key) && catalogue.some((type) => type.key === key));
    if (!wanted.length || !editable) return;
    if (await saveRequired([...requiredKeys, ...wanted.map(({ key }) => key)]))
      wanted.forEach(({ key, why }) => notify(`${approvalLabel(key)} added - ${why}`));
  };

  /** Open another approval from a checklist's flag - adding it to the job first when it is not on it. */
  const openApproval = async (key) => {
    if (!requiredKeys.includes(key)) {
      if (!(await saveRequired([...requiredKeys, key]))) return;
      notify(`${approvalLabel(key)} added`);
    }
    setTab(checklists.some(({ section: candidate }) => candidate.key === key) ? key : "overview");
  };

  // Why the open checklist's status cannot be saved yet ("Attach the approval evidence to mark this as Approved.").
  const statusProblems = section ? statusBlockers(section, checklist[section.key] ?? {}, ctx) : [];

  /** Submit: send this approval's answers now. Resolves false when they could not be saved. */
  const submitChecklist = async () => {
    if (!section || !onSaveChecklist) return true;
    if (statusProblems.length) {
      notifyError(statusProblems[0]);
      return false;
    }
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
    if (statusProblems.length) {
      notifyError(statusProblems[0]);
      return;
    }
    setSavingChecklist(true);
    try {
      // true: answers were sent (now, or a save already on its way has landed).
      const sent = await onSaveChecklist(section.key);
      notify(sent ? `${section.tab} saved` : `${section.tab} saved - everything was already on the record`);
    } catch (err) {
      notifyError(typeof err === "string" ? err : err?.message || "The checklist could not be saved.");
    } finally {
      setSavingChecklist(false);
    }
  };

  // The save bar on the open checklist: where its answers stand, and Save.
  // Approvals stay workable after the job has moved on - one can be added late.
  const checklistEditable = editable;
  const saveState = section && checklistSaveState ? checklistSaveState(section.key) : null;
  const saveBar =
    section && (checklistEditable || lapseOnly) && onSaveChecklist ? (
      <span className="save-bar">
        <span className={`row-meta${saveState?.dirty ? " is-dirty" : ""}`}>
          {saveState?.dirty ? "Unsaved changes" : saveState?.saving ? "Saving…" : saveState?.savedAt ? `Saved ${timeAgo(saveState.savedAt)}` : "All changes saved"}
        </span>
        <button
          type="button"
          className={`btn btn-sm ${saveState?.dirty ? "btn-primary" : "btn-ghost"}`}
          onClick={saveChecklistNow}
          disabled={savingChecklist || saveState?.saving}
          title={saveState?.dirty ? "Save what you have entered" : "Everything is saved - save again anyway"}
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
            <strong>Your last checklist answers were not saved.</strong> {saveError} The checklist now shows what is on record - enter
            the answers again.
          </span>
          {onDismissSaveError ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={onDismissSaveError}>
              Dismiss
            </button>
          ) : null}
        </Alert>
      ) : null}
      {reviewNeeded(job) ? (
        <Alert tone="warning" style={{ marginBottom: 14, display: "flex", gap: 12, alignItems: "flex-start", justifyContent: "space-between", flexWrap: "wrap" }}>
          <span>
            <strong>Approval Review Needed.</strong> {reviewReasons(job).join(" · ")}
          </span>
          {job.approvalReview && canEdit && onMarkReviewed ? (
            <button type="button" className="btn btn-ghost btn-sm" onClick={markReviewed} disabled={reviewing}>
              {reviewing ? "Saving…" : "Mark as Reviewed"}
            </button>
          ) : null}
        </Alert>
      ) : null}
      {movedOn ? (
        <Alert tone="info" style={{ marginBottom: 14 }}>
          Sent to Procurement
          {job.sentToProcurement?.by ? ` by ${job.sentToProcurement.by}` : ""}
          {job.sentToProcurement?.at ? ` on ${formatDate(job.sentToProcurement.at, { withTime: true })}` : ""} - the approvals are read-only.
          {job.sentToProcurement?.conditionsReviewed ? " Conditions reviewed before sending." : ""} Documents and notes can still be added; to change an approval,
          reopen the approvals.
        </Alert>
      ) : null}
      {job.onHold ? (
        <Alert tone="neutral" style={{ marginBottom: 14 }}>
          <strong>On Hold:</strong> {job.onHold.reason}
          {job.onHold.by ? ` - ${job.onHold.by}` : ""}
          {job.onHold.at ? `, ${formatDate(job.onHold.at)}` : ""}. Resume it to send the job to Procurement.
        </Alert>
      ) : null}
      {!movedOn && job.approvalsReopened?.at ? (
        <Alert tone="warning" style={{ marginBottom: 14 }}>
          Approvals reopened{job.approvalsReopened.by ? ` by ${job.approvalsReopened.by}` : ""} on {formatDate(job.approvalsReopened.at, { withTime: true })}
          {job.approvalsReopened.reason ? `: ${job.approvalsReopened.reason}` : ""}. Send the job to Procurement again once the changes are made.
        </Alert>
      ) : null}
      {idleFor(job, approvalTimers(unit)) ? (
        <Alert tone="warning" style={{ marginBottom: 14 }}>
          No activity on this job&apos;s approvals for {idleFor(job, approvalTimers(unit))} days - chase what it is waiting on.
        </Alert>
      ) : null}
      {isOverdue(job) ? (
        <Alert tone="danger" style={{ marginBottom: 14 }}>
          Past the approvals timeline - due {formatDate(job.slaDueAt, { withTime: true })} ({slaStatus(job.slaDueAt).label}).
        </Alert>
      ) : null}
      {resolving && approvalItems(job).some((item) => item.key === resolving) ? (
        <RejectionResolution
          item={approvalItems(job).find((item) => item.key === resolving)}
          job={job}
          onResolve={(body) => onResolveRejection(resolving, body)}
          onClose={() => setResolving(null)}
        />
      ) : null}
      {(job.closedItems ?? []).length ? (
        <p className="row-meta" style={{ whiteSpace: "normal", marginBottom: 10 }}>
          Closed after a change of approach:{" "}
          {job.closedItems.map((item) => `${item.label}${item.checklist?.closed?.replacedBy ? ` (replaced by ${item.checklist.closed.replacedBy})` : ""}`).join(" · ")}. Both
          stay in History.
        </p>
      ) : null}
      <Tabs items={tabs} value={tab} onChange={setTab} />
      <div className="panel">
        {tab === "overview" ? (
          <>
            {/* First on the overview: which approvals the job needs, and adding another. */}
            <div>
              <SectionHead icon={<ListChecks size={13} />} title="Required Approvals" />
              <p className="row-meta" style={{ whiteSpace: "normal", marginBottom: 8 }}>
                These approvals were selected by Sales or Estimation. Add or remove approvals here if this job needs a different set.
              </p>
              <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                {shownKeys.length ? (
                  shownKeys.map((key) => {
                    const label = approvalLabel(key, job.catalogue?.find((type) => type.key === key)?.label);
                    return (
                      <Badge key={key} tone="neutral">
                        {label}
                        {editable ? (
                          <button
                            type="button"
                            className="chip-remove"
                            aria-label={`Remove ${label}`}
                            title={`Remove ${label}`}
                            disabled={saving}
                            onClick={async () => {
                              if (!window.confirm(`Remove ${label} from this job's approvals?`)) return;
                              if (await saveRequired(requiredKeys.filter((candidate) => candidate !== key))) notify(`${label} removed`);
                            }}
                          >
                            <X size={11} />
                          </button>
                        ) : null}
                      </Badge>
                    );
                  })
                ) : (
                  <span className="row-meta">None selected.</span>
                )}
              </div>
              {editable ? (
                <div className="form-grid" style={{ marginTop: 12 }}>
                  <Field label="Other Approvals" htmlFor="other-approvals">
                    <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                      <select id="other-approvals" value={addKey} onChange={(e) => setAddKey(e.target.value)} disabled={saving} style={{ minWidth: 220, flex: "1 1 220px" }}>
                        <option value="">Select…</option>
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
                          placeholder="Name the approval"
                          aria-label="Custom approval name"
                          onChange={(e) => setCustomName(e.target.value)}
                          style={{ minWidth: 200, flex: "1 1 200px" }}
                          autoFocus
                        />
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={!addKey || (addKey === CUSTOM_APPROVAL && !customName.trim()) || saving}
                        onClick={async () => {
                          const custom = addKey === CUSTOM_APPROVAL;
                          const keys = custom ? requiredKeys : [...requiredKeys, addKey];
                          const added = await saveRequired(keys, custom ? [{ label: customName.trim() }] : undefined);
                          if (added) {
                            notify(`${custom ? customName.trim() : (catalogue.find((type) => type.key === addKey)?.label ?? "Approval")} added`);
                            setAddKey("");
                            setCustomName("");
                          }
                        }}
                      >
                        <Plus size={14} /> {saving ? "Adding…" : "Add"}
                      </button>
                    </div>
                  </Field>
                </div>
              ) : null}
              {error ? (
                <Alert tone="danger" style={{ marginTop: 10 }}>
                  {error}
                </Alert>
              ) : null}
            </div>

            <div style={{ marginTop: 20 }}>
              <ApprovalBoard
                job={job}
                canEdit={editable}
                lapseOnly={lapseOnly}
                onOpenChecklist={setTab}
                onUpdateItem={onUpdateItem}
                onAddAddendum={movedOn && canAddNotes ? onAddAddendum : null}
                onResolveRejection={onResolveRejection ? setResolving : null}
                upload={onUpload}
              />
            </div>

            {/* The way on: the first checklist still open, and - once every approval is in - procurement. */}
            <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
              {checklists.some(({ summary }) => summary.done < summary.total) ? (
                <ContinueButton
                  nextLabel={checklists.find(({ summary }) => summary.done < summary.total).section.tab}
                  onDone={() => setTab(checklists.find(({ summary }) => summary.done < summary.total).section.key)}
                />
              ) : null}
            </div>
          </>
        ) : section ? (
          <>
            <ApprovalChecklist
              section={section}
              job={job}
              canEdit={checklistEditable}
              onChange={(patch) => {
                onChecklistChange?.(section.key, patch);
                autoAdd(patch);
              }}
              actions={saveBar}
              requiredKeys={requiredKeys}
              onOpenApproval={openApproval}
              lapseOnly={lapseOnly}
              onChangePaymentMethod={onChangePaymentMethod}
              onResolveRejection={onResolveRejection ? setResolving : null}
              upload={onUpload}
            />
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
          <span style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <Badge tone={status.tone}>{status.label}</Badge>
            {sendButton}
          </span>
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
      actions={
        <>
          <Badge tone={status.tone}>{status.label}</Badge>
          {sendButton}
        </>
      }
    >
      {body}
    </Card>
  );
}
