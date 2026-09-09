// New lead capture.

import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Clock, MessageSquarePlus, Save, X } from "lucide-react";
import PageHeader from "@/components/PageHeader";
import Alert from "@/components/Alert";
import FileDropzone from "@/components/FileDropzone";
import SectionHead from "@/components/SectionHead";
import LeadForm from "@/features/leads/LeadForm";
import { emptyLeadForm, formToPayload, idOrNull, validateLeadForm } from "@/features/leads/leadFormModel";
import { useAppDispatch, useAppSelector } from "@/store";
import {
  addOpportunityHistoryEntry,
  assignCoordinator,
  assignEstimator,
  assignSalesperson,
  createLead,
  notifyBusinessOwner,
  uploadOpportunityAttachment,
} from "@/slices/leadsSlice";
import { fetchReferrers } from "@/slices/referralsSlice";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { useUnitUsers } from "@/hooks/useUnitUsers";
import { useNotifications } from "@/hooks/useNotifications";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { isBlank } from "@/utils/validators";

export default function NewLeadPage() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { unit, unitId } = useBusinessUnit();
  const { estimators, sales, siteOps } = useUnitUsers();
  const referrers = useAppSelector((s) => s.referrals.items);
  const referrersStatus = useAppSelector((s) => s.referrals.status);
  const { notify } = useNotifications();
  const [form, setForm] = useState(emptyLeadForm);
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [saving, setSaving] = useState(false);
  const [photoFiles, setPhotoFiles] = useState([]);
  const [sketchFiles, setSketchFiles] = useState([]);
  const [billFiles, setBillFiles] = useState([]);
  const [historyNotes, setHistoryNotes] = useState([]);
  const [noteDraft, setNoteDraft] = useState("");

  useEffect(() => {
    if (referrersStatus === "idle") dispatch(fetchReferrers({ status: "active" }));
  }, [referrersStatus, dispatch]);

  const set = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => {
      if (!e[field]) return e;
      const next = { ...e };
      delete next[field];
      return next;
    });
  };

  const addPhotos = (files) => setPhotoFiles((prev) => [...prev, ...files]);
  const addSketches = (files) => setSketchFiles((prev) => [...prev, ...files]);
  const addBills = (files) => setBillFiles((prev) => [...prev, ...files]);

  const addNote = () => {
    const text = noteDraft.trim();
    if (!text) return;
    setHistoryNotes((prev) => [...prev, text]);
    setNoteDraft("");
  };
  const removeNote = (i) => setHistoryNotes((prev) => prev.filter((_, idx) => idx !== i));

  const submit = async (e) => {
    e.preventDefault();
    const found = validateLeadForm(form);
    if (Object.keys(found).length) {
      setErrors(found);
      return;
    }
    setSaving(true);
    setSubmitError("");
    try {
      const created = await dispatch(createLead({ ...formToPayload(form), businessUnitId: unitId })).unwrap();

      // Best-effort — the lead is already saved regardless of whether the
      // owner notification goes through.
      try {
        await dispatch(notifyBusinessOwner(created.id)).unwrap();
      } catch {
        notify("Lead saved, but the business owner could not be notified.", "danger");
      }

      // Assignment fields go through their own endpoints, best-effort —
      // the lead itself is already saved by this point.
      try {
        await dispatch(
          assignSalesperson({
            id: created.id,
            body: {
              salespersonId: idOrNull(form.salespersonId),
              reason: isBlank(form.salespersonId) ? form.unassignedReason.trim() : undefined,
            },
          }),
        ).unwrap();
        if (isBlank(form.salespersonId) && !isBlank(form.unassignedReason)) {
          try {
            await dispatch(
              addOpportunityHistoryEntry({
                id: created.id,
                body: { note: `Lead left unassigned — ${form.unassignedReason.trim()}` },
              }),
            ).unwrap();
          } catch {
            notify("Lead saved, but the unassigned reason could not be added to job history.", "danger");
          }
        }
      } catch {
        notify("Lead saved, but the salesperson assignment could not be recorded.", "danger");
      }

      // Every attempt where the client wasn't reached must have its reason
      // recorded in Job History.
      for (const attempt of form.contactAttempts.filter((a) => a.reached === false)) {
        try {
          await dispatch(
            addOpportunityHistoryEntry({
              id: created.id,
              body: {
                note: `Client not contacted (${attempt.method}, ${formatDate(attempt.contactedAt)}) — ${attempt.reason}`,
              },
            }),
          ).unwrap();
        } catch {
          notify("Lead saved, but a not-contacted reason could not be added to job history.", "danger");
        }
      }

      if (form.potential === "yes" && !isBlank(form.estimatorId)) {
        try {
          await dispatch(
            assignEstimator({ id: created.id, body: { estimatorId: idOrNull(form.estimatorId) } }),
          ).unwrap();
        } catch {
          notify("Lead saved, but the estimator assignment could not be recorded.", "danger");
        }
      }
      if (form.needsClientVisit && !isBlank(form.operationalCoordinatorId)) {
        try {
          await dispatch(
            assignCoordinator({ id: created.id, body: { operationalCoordinatorId: idOrNull(form.operationalCoordinatorId) } }),
          ).unwrap();
        } catch {
          notify("Lead saved, but the operational coordinator assignment could not be recorded.", "danger");
        }
      }

      // Photos/sketches are captured before the lead exists — upload them
      // best-effort once it's saved, without blocking navigation.
      const uploads = [
        ...photoFiles.map((file) => ({ file, category: "photo" })),
        ...sketchFiles.map((file) => ({ file, category: "sketch" })),
        ...billFiles.map((file) => ({ file, category: "bill" })),
      ];
      for (const { file, category } of uploads) {
        try {
          await dispatch(uploadOpportunityAttachment({ id: created.id, category, file })).unwrap();
        } catch {
          notify(`Lead saved, but "${file.name}" could not be uploaded.`, "danger");
        }
      }

      // Job history notes are captured before the lead exists — save them
      // best-effort once it's saved, so they're the first thing an admin
      // sees on the History tab.
      for (const note of historyNotes) {
        try {
          await dispatch(addOpportunityHistoryEntry({ id: created.id, body: { note } })).unwrap();
        } catch {
          notify("Lead saved, but a history note could not be added.", "danger");
        }
      }

      notify(`Lead ${created.number} saved`);
      navigate(`/opportunities/${created.id}`);
    } catch (err) {
      setSubmitError(typeof err === "string" ? err : err?.message || "Could not save the lead.");
    } finally {
      setSaving(false);
    }
  };

  const errorList = [...new Set(Object.values(errors))];

  const clientMeetingSlot = (
    <div>
      <p className="eyebrow">Site photos</p>
      <p className="lede" style={{ marginBottom: 12 }}>
        Photos from the site visit — access, electrical conditions, constraints.
      </p>
      <FileDropzone
        files={photoFiles.map((f, i) => ({ id: `photo-${i}`, filename: f.name }))}
        onSelect={addPhotos}
        disabled={saving}
      />

      <p className="eyebrow">Sketches &amp; drawings</p>
      <p className="lede" style={{ marginBottom: 12 }}>
        Hand sketches, plans or design outputs from the site visit.
      </p>
      <FileDropzone
        files={sketchFiles.map((f, i) => ({ id: `sketch-${i}`, filename: f.name }))}
        onSelect={addSketches}
        disabled={saving}
      />
    </div>
  );

  return (
    <>
      <Link to="/leads" className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}>
        Back
      </Link>
      <PageHeader
        title="New lead"
        description={`Capture the lead in ${unit?.name ?? "this unit"}. Set a salesperson to unlock the mandatory checklist.`}
      />
      <form onSubmit={submit} className="card card-pad" noValidate>
        <LeadForm
          form={form}
          set={set}
          errors={errors}
          estimators={estimators}
          sales={sales}
          siteOps={siteOps}
          referrers={referrers}
          unit={unit}
          clientMeetingSlot={clientMeetingSlot}
          billFiles={billFiles.map((f, i) => ({ id: `bill-${i}`, filename: f.name }))}
          onUploadBills={addBills}
        />

        <div className="section">
          <SectionHead icon={<Clock size={13} />} title="Job history" />
          <p className="lede" style={{ marginBottom: 16 }}>
            Add context now — these notes land on the History tab as soon as the lead is saved, visible to anyone
            who can view it.
          </p>
          <div style={{ display: "flex", gap: 8, alignItems: "flex-start", marginBottom: 16 }}>
            <div className="field" style={{ flex: 1 }}>
              <textarea
                rows={2}
                placeholder="Add to the job history…"
                value={noteDraft}
                disabled={saving}
                onChange={(e) => setNoteDraft(e.target.value)}
              />
            </div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              disabled={saving || !noteDraft.trim()}
              onClick={addNote}
            >
              <MessageSquarePlus size={14} /> Add
            </button>
          </div>

          {historyNotes.length ? (
            <div className="list-stack">
              {historyNotes.map((note, i) => (
                <div key={i} className="list-row">
                  <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
                    <span className="status-icon current">
                      <Clock size={16} />
                    </span>
                    <div className="row-title">{note}</div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    disabled={saving}
                    onClick={() => removeNote(i)}
                    aria-label="Remove note"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          ) : null}
        </div>

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
        {submitError ? <Alert tone="danger">{submitError}</Alert> : null}
        <button className="btn btn-primary" type="submit" disabled={saving} style={{ marginTop: 16 }}>
          <Save size={16} /> {saving ? "Saving…" : "Save lead"}
        </button>
      </form>
    </>
  );
}
