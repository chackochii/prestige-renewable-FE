// Stage-1 work: the lead pack. The lead fields, the client-meeting log and
// the site evidence (photos, sketches) that unlock the Qualified outcome, plus
// any intake documents. Editable while the record lives.

import { useEffect, useState } from "react";
import { ArrowRight, ClipboardCheck, Handshake } from "lucide-react";
import Alert from "@/components/Alert";
import Field from "@/components/Field";
import SectionHead from "@/components/SectionHead";
import FileDropZone from "@/components/FileDropZone";
import LeadForm from "@/features/leads/LeadForm";
import { formToPayload, leadToForm, validateLeadForm } from "@/features/leads/leadFormModel";
import { leadCompletenessItems, leadGateItems, qualificationGateItems, SITE_EVIDENCE_TYPES } from "@/helpers/stageTransition";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { nextStageFor, stageById } from "@/constants/stages";
import { useAppDispatch, useAppSelector } from "@/store";
import { addMeeting, advanceStage, removeDocument, removeMeeting, updateLead, uploadDocuments } from "@/slices/leadsSlice";
import { fetchReferrers } from "@/slices/referralsSlice";
import { useUnitUsers } from "@/hooks/useUnitUsers";
import { useNotifications } from "@/hooks/useNotifications";

const errMessage = (err, fallback) => (typeof err === "string" ? err : err?.message || fallback);
const EMPTY_MEETING = { attendees: "", outcome: "", nextStep: "" };

export default function LeadPackPanel({ opp, unit, canEdit }) {
  const dispatch = useAppDispatch();
  const { estimators, sales } = useUnitUsers();
  const referrers = useAppSelector((s) => s.referrals.items);
  const referrersStatus = useAppSelector((s) => s.referrals.status);
  const { notify } = useNotifications();
  const [form, setForm] = useState(() => leadToForm(opp));
  const [errors, setErrors] = useState({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);
  const [meeting, setMeeting] = useState(EMPTY_MEETING);
  const [meetingSaving, setMeetingSaving] = useState(false);

  // Only a different record resets the form. Attachments refresh the same
  // record in the store and must not wipe unsaved field edits.
  useEffect(() => {
    setForm(leadToForm(opp));
    setErrors({});
    setSaveError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opp.id]);

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

  const timeZone = unit?.timezone;
  const atLeadStage = Number(opp.stage) === 1;
  const nextStage = nextStageFor(opp.stage, unit);
  const meetings = Array.isArray(opp.meetings) ? opp.meetings : [];
  const documents = Array.isArray(opp.documents) ? opp.documents : [];
  const sitePhotos = documents.filter((d) => d.type === "site_photo");
  const drawings = documents.filter((d) => d.type === "drawing");
  const evidence = documents.filter((d) => !SITE_EVIDENCE_TYPES.includes(d.type) && (d.stage === 1 || d.stage == null));
  const qualifyMissing = qualificationGateItems(opp);
  const allowQualified = qualifyMissing.length === 0 || opp.qualification === "qualified";
  const gate = leadGateItems(opp);
  const completeness = leadCompletenessItems(opp);
  const errorList = [...new Set(Object.values(errors))];

  /** Saves the lead fields. Resolves to the refreshed record, or null. */
  const save = async () => {
    const found = validateLeadForm(form);
    if (Object.keys(found).length) {
      setErrors(found);
      return null;
    }
    setSaving(true);
    setSaveError("");
    try {
      const updated = await dispatch(updateLead({ id: opp.id, body: formToPayload(form) })).unwrap();
      setForm(leadToForm(updated));
      return updated;
    } catch (err) {
      setSaveError(errMessage(err, "Could not save the lead pack."));
      return null;
    } finally {
      setSaving(false);
    }
  };

  const saveOnly = async () => {
    if (await save()) notify("Lead pack saved");
  };

  // Save, then move on when the record is ready — otherwise say what is left.
  const saveAndContinue = async () => {
    const updated = await save();
    if (!updated) return;
    const missing = leadGateItems(updated);
    if (missing.length) {
      notify(`Lead pack saved. To continue: ${missing.join(" · ")}`, "info");
      return;
    }
    try {
      const moved = await dispatch(advanceStage(updated.id)).unwrap();
      notify(`Moved to ${stageById(moved.stage).label}`);
    } catch (err) {
      setSaveError(errMessage(err, "Saved, but the record could not advance."));
    }
  };

  const saveMeeting = async () => {
    if (!meeting.attendees.trim()) return;
    setMeetingSaving(true);
    try {
      await dispatch(addMeeting({ id: opp.id, body: meeting })).unwrap();
      setMeeting(EMPTY_MEETING);
      notify("Meeting logged");
    } catch (err) {
      notify(errMessage(err, "Could not log the meeting."), "danger");
    } finally {
      setMeetingSaving(false);
    }
  };

  const deleteMeeting = async (m) => {
    try {
      await dispatch(removeMeeting({ id: opp.id, meetingId: m.id })).unwrap();
      notify("Meeting removed", "info");
    } catch (err) {
      notify(errMessage(err, "Could not remove the meeting."), "danger");
    }
  };

  const upload = (type) => async (files) => {
    await dispatch(uploadDocuments({ id: opp.id, files, meta: { type, stage: 1 } })).unwrap();
    notify(`${files.length} file${files.length === 1 ? "" : "s"} attached`);
  };

  const remove = async (doc) => {
    await dispatch(removeDocument({ id: opp.id, docId: doc.id })).unwrap();
    notify(`${doc.name} removed`, "info");
  };

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
          ? "Every lead is not yet an opportunity. Log a client meeting and a site visit below, then mark this lead Qualified to attach it to the pipeline. Nurture and Disqualified stay here."
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
        allowQualified={allowQualified}
        qualifiedHint={qualifyMissing.length ? `${qualifyMissing.join(" and ").toLowerCase()} first` : undefined}
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

      {atLeadStage ? (
        <div className="section" style={{ marginTop: 24, marginBottom: 0 }}>
          <SectionHead icon={<Handshake size={13} />} title="Client meeting & site visit" />
          <p className="sub">
            Qualification is decided on the ground — after a client meeting and a site visit, with photos or sketches to back it up.
          </p>

          {meetings.length ? (
            <div className="meeting-list">
              {meetings.map((m) => (
                <div key={m.id} className="meeting-row">
                  <div className="meeting-body">
                    <div className="row-title">{m.attendees}</div>
                    <div className="row-meta">
                      {m.outcome || "No outcome recorded"}
                      {m.nextStep ? ` · Next: ${m.nextStep}` : ""}
                    </div>
                    <div className="meeting-when">
                      {formatDate(m.at, { withTime: true, timeZone })}
                      {m.actorName ? ` · logged by ${m.actorName}` : ""}
                    </div>
                  </div>
                  {canEdit ? (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => deleteMeeting(m)}>
                      Remove
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="lede" style={{ marginBottom: 14 }}>
              No meetings logged yet.
            </p>
          )}

          {canEdit ? (
            <>
              <div className="form-grid">
                <Field label="Attendees">
                  <input
                    value={meeting.attendees}
                    placeholder="e.g. Jane Doe (owner), our BDM"
                    onChange={(e) => setMeeting({ ...meeting, attendees: e.target.value })}
                  />
                </Field>
                <Field label="Outcome">
                  <input value={meeting.outcome} onChange={(e) => setMeeting({ ...meeting, outcome: e.target.value })} />
                </Field>
                <Field label="Next step" className="span-2">
                  <input value={meeting.nextStep} onChange={(e) => setMeeting({ ...meeting, nextStep: e.target.value })} />
                </Field>
              </div>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ marginTop: 10 }}
                disabled={!meeting.attendees.trim() || meetingSaving}
                onClick={saveMeeting}
              >
                {meetingSaving ? "Saving…" : "Save meeting"}
              </button>
            </>
          ) : null}

          <div style={{ marginTop: 20 }}>
            <FileDropZone
              title="Site photos"
              hint="Photos from the site visit — access, electrical conditions, constraints."
              accept="image/*"
              files={sitePhotos}
              canEdit={canEdit}
              timeZone={timeZone}
              onAdd={upload("site_photo")}
              onRemove={remove}
            />
          </div>
          <div style={{ marginTop: 20 }}>
            <FileDropZone
              title="Sketches & drawings"
              hint="Hand sketches, plans or design outputs from the site visit."
              files={drawings}
              canEdit={canEdit}
              timeZone={timeZone}
              onAdd={upload("drawing")}
              onRemove={remove}
            />
          </div>

          {!allowQualified ? (
            <Alert tone="info" style={{ marginTop: 16, marginBottom: 0 }}>
              {qualifyMissing[0]} to unlock the Qualified outcome above.
            </Alert>
          ) : null}
        </div>
      ) : null}

      <div style={{ marginTop: 24 }}>
        <FileDropZone
          title="Lead evidence"
          hint="Bills, emails or other intake documents."
          files={evidence}
          canEdit={canEdit}
          timeZone={timeZone}
          onAdd={upload("lead")}
          onRemove={remove}
        />
      </div>

      {saveError ? (
        <Alert tone="danger" style={{ marginTop: 16 }}>
          {saveError}
        </Alert>
      ) : null}

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
        <div style={{ marginTop: 16, display: "flex", gap: 8, flexWrap: "wrap" }}>
          {atLeadStage && opp.lifecycle === "Active" && nextStage !== null ? (
            <>
              <button type="button" className="btn btn-primary" onClick={saveAndContinue} disabled={saving}>
                {saving ? "Saving…" : `Save and continue to ${stageById(nextStage).short}`} <ArrowRight size={16} />
              </button>
              <button type="button" className="btn btn-ghost" onClick={saveOnly} disabled={saving}>
                Save lead details
              </button>
            </>
          ) : (
            <button type="button" className="btn btn-primary" onClick={saveOnly} disabled={saving}>
              {saving ? "Saving…" : "Save lead details"}
            </button>
          )}
        </div>
      ) : (
        <p className="lede" style={{ marginTop: 16 }}>
          You have read access to this lead. Editing needs the “Update Leads” permission.
        </p>
      )}
    </div>
  );
}
