// Stage-1 work: the lead pack, editable while the record lives.

import { useEffect, useState } from "react";
import { ClipboardCheck } from "lucide-react";
import Alert from "@/components/Alert";
import LeadForm from "@/features/leads/LeadForm";
import { formToPayload, idOrNull, leadToForm, validateLeadForm } from "@/features/leads/leadFormModel";
import { leadCompletenessItems, leadGateItems } from "@/helpers/stageTransition";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  addOpportunityHistoryEntry,
  assignEstimator,
  assignSalesperson,
  fetchOpportunityAttachments,
  updateLead,
  uploadOpportunityAttachment,
} from "@/slices/leadsSlice";
import { fetchReferrers } from "@/slices/referralsSlice";
import { useUnitUsers } from "@/hooks/useUnitUsers";
import { useNotifications } from "@/hooks/useNotifications";

export default function LeadPackPanel({ opp, unit, canEdit }) {
  const dispatch = useAppDispatch();
  const { estimators, sales } = useUnitUsers();
  const referrers = useAppSelector((s) => s.referrals.items);
  const referrersStatus = useAppSelector((s) => s.referrals.status);
  const attachments = useAppSelector((s) => s.leads.attachments);
  const { notify, error: notifyError } = useNotifications();
  const [form, setForm] = useState(() => leadToForm(opp));
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadingBills, setUploadingBills] = useState(false);

  // A fresh record (after fetch or save) replaces any unsaved edits.
  useEffect(() => {
    setForm(leadToForm(opp));
    setErrors({});
  }, [opp]);

  useEffect(() => {
    if (referrersStatus === "idle") dispatch(fetchReferrers({ status: "active" }));
  }, [referrersStatus, dispatch]);

  useEffect(() => {
    if (opp?.id) dispatch(fetchOpportunityAttachments(opp.id));
  }, [opp?.id, dispatch]);

  const billFiles = attachments.filter((a) => a.category === "bill");

  const uploadBills = async (files) => {
    setUploadingBills(true);
    try {
      for (const file of files) {
        await dispatch(uploadOpportunityAttachment({ id: opp.id, category: "bill", file })).unwrap();
      }
    } catch (err) {
      notifyError(typeof err === "string" ? err : err?.message || "Could not upload the file.");
    } finally {
      setUploadingBills(false);
    }
  };

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => {
      if (!e[field]) return e;
      const next = { ...e };
      delete next[field];
      return next;
    });
  };

  const save = async () => {
    const found = validateLeadForm(form);
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    // Baseline before this save — used to work out what's actually new,
    // so re-saving never re-writes the same job-history entry twice.
    const previousAttemptCount = (opp.contactAttempts || []).length;
    setSaving(true);
    setSaveError("");
    try {
      await dispatch(updateLead({ id: opp.id, body: formToPayload(form) })).unwrap();

      // Every attempt where the client wasn't reached must have its reason
      // recorded in Job History — write one entry per new attempt only.
      const newAttempts = form.contactAttempts.slice(previousAttemptCount);
      for (const attempt of newAttempts.filter((a) => a.reached === false)) {
        await dispatch(
          addOpportunityHistoryEntry({
            id: opp.id,
            body: {
              note: `Client not contacted (${attempt.method}, ${formatDate(attempt.contactedAt)}) — ${attempt.reason}`,
            },
          }),
        ).unwrap();
      }

      // Assignment fields are their own audited actions, not part of the
      // generic PATCH — only call each endpoint when that assignment
      // actually changed.
      const newSalespersonId = idOrNull(form.salespersonId);
      if (newSalespersonId !== (opp.salespersonId ?? null)) {
        await dispatch(
          assignSalesperson({
            id: opp.id,
            body: { salespersonId: newSalespersonId, reason: newSalespersonId ? undefined : form.unassignedReason.trim() },
          }),
        ).unwrap();
        if (!newSalespersonId) {
          await dispatch(
            addOpportunityHistoryEntry({
              id: opp.id,
              body: { note: `Lead left unassigned — ${form.unassignedReason.trim()}` },
            }),
          ).unwrap();
        }
      }

      if (form.potential === "yes") {
        const newEstimatorId = idOrNull(form.estimatorId);
        if (newEstimatorId && newEstimatorId !== (opp.estimatorId ?? null)) {
          await dispatch(assignEstimator({ id: opp.id, body: { estimatorId: newEstimatorId } })).unwrap();
        }
      }

      notify("Lead pack saved");
    } catch (err) {
      setSaveError(typeof err === "string" ? err : err?.message || "Could not save the lead pack.");
    } finally {
      setSaving(false);
    }
  };

  const atLeadStage = Number(opp.stage) === 1;
  const gate = leadGateItems(opp);
  const completeness = leadCompletenessItems(opp);
  const errorList = [...new Set(Object.values(errors))];

  return (
    <div className="card card-pad">
      <div className="card-head">
        <span className="card-icon">
          <ClipboardCheck size={16} />
        </span>
        <h2>Lead pack</h2>
      </div>
      <p className="sub">
        {atLeadStage
          ? "A lead becomes an opportunity once it's marked Potential with an estimator assigned."
          : "This lead has already moved on. You can still review and update the details."}
      </p>

      <LeadForm
        form={form}
        set={set}
        errors={errors}
        estimators={estimators}
        sales={sales}
        referrers={referrers}
        unit={unit}
        disabled={!canEdit}
        billFiles={billFiles}
        onUploadBills={canEdit ? uploadBills : undefined}
        uploadingBills={uploadingBills}
      />

      {errorList.length ? (
        <Alert tone="danger" style={{ marginTop: 16 }}>
          Fix {errorList.length} {errorList.length === 1 ? "field" : "fields"} before saving.
          <ul>
            {errorList.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      {saveError ? <Alert tone="danger">{saveError}</Alert> : null}

      {atLeadStage ? (
        gate.length ? (
          <Alert tone="info" style={{ marginTop: 16 }}>
            To leave lead capture: {gate.join(" · ")}
            {completeness.length ? ` · Also worth completing: ${completeness.join(", ")}` : ""}
          </Alert>
        ) : (
          <Alert tone="success" style={{ marginTop: 16 }}>
            Ready to advance{completeness.length ? ` — still worth completing: ${completeness.join(", ")}` : ""}.
          </Alert>
        )
      ) : null}

      {canEdit ? (
        <div style={{ marginTop: 16 }}>
          <button type="button" className="btn btn-primary" onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save lead details"}
          </button>
        </div>
      ) : (
        <p className="lede" style={{ marginTop: 16 }}>
          You have read access to this lead. Editing needs the “Update Leads” permission.
        </p>
      )}
    </div>
  );
}
