// Public site-visit form at /site-visit/:token — no sign-in, the way /enquiry
// works. A coordinator raises a pre-site visit, says what has to come back,
// and hands this link to whoever is attending: an electrician, a site member,
// a contractor's crew.
//
// They say who they are, answer exactly what was asked, and upload the photos
// that were asked for. Photos upload as they are chosen, so a dropped
// connection on site costs one file rather than the whole visit. Submitting
// notifies the coordinator; until then the task stays pending.

import { useCallback, useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CheckCircle2, MapPin } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import BrandMark from "@/components/BrandMark";
import Field from "@/components/Field";
import FileDropzone from "@/components/FileDropzone";
import LoadingState from "@/components/LoadingState";
import NumberInput from "@/components/NumberInput";
import SignaturePad from "@/components/SignaturePad";
import { documentTypeLabel } from "@/constants/collaboration";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { getErrorMessage } from "@/services/api/client";
import { getSiteVisitTask, submitSiteVisit, uploadSiteVisitPhoto } from "@/services/api/publicSiteVisitApi";
import { isBlank, isEmail } from "@/utils/validators";

const LIMITS = { name: 100, email: 254, phone: 30, answer: 2000 };
const PHONE_CHARS_RE = /^\+?[\d\s().-]+$/;
const countDigits = (value) => (String(value).match(/\d/g) || []).length;

const asList = (value) => (Array.isArray(value) ? value : []);

function validate(form, fields) {
  const errors = {};
  const name = form.name.trim();
  if (!name) errors.name = "Enter your name.";
  else if (name.length > LIMITS.name) errors.name = `That name is too long (${LIMITS.name} characters max).`;

  const email = form.email.trim();
  const phone = form.phone.trim();
  if (!email && !phone) {
    errors.email = "Give an email or a phone number so we can reach you.";
  } else {
    if (email && !isEmail(email)) errors.email = "Enter a valid email address.";
    if (phone) {
      if (!PHONE_CHARS_RE.test(phone))
        errors.phone = "A phone number can only contain digits, spaces and + ( ) - characters.";
      else if (countDigits(phone) < 8 || countDigits(phone) > 15) errors.phone = "Enter a valid phone number.";
    }
  }

  for (const field of fields) {
    // Every item was asked for on purpose, so each needs an answer — but a
    // checkbox answers "no" by staying unticked, so it is never missing.
    if (field.kind === "checkbox") continue;
    if (isBlank(form.fields[field.key])) errors[`field:${field.key}`] = `${field.label} is needed.`;
  }
  return errors;
}

export default function SiteVisitPage() {
  const { token } = useParams();
  const [task, setTask] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", email: "", phone: "", fields: {} });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(null);
  const [done, setDone] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError("");
    try {
      const result = await getSiteVisitTask(token);
      setTask(result);
      setForm((f) => ({ ...f, name: f.name || result?.assigneeName || "" }));
      if (result?.status === "submitted" || result?.submittedAt) setDone(true);
    } catch (err) {
      setLoadError(getErrorMessage(err, "This link is not valid, or it has already been used."));
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    load();
  }, [load]);

  const fields = asList(task?.requestedFields);
  const documents = asList(task?.requestedDocuments);
  const photos = asList(task?.photos);
  const photosFor = (documentKey) => photos.filter((p) => p.documentKey === documentKey);

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((e) => {
      if (!e[key]) return e;
      const next = { ...e };
      delete next[key];
      return next;
    });
  };

  const setAnswer = (key, value) => {
    setForm((f) => ({ ...f, fields: { ...f.fields, [key]: value } }));
    setFieldErrors((e) => {
      if (!e[`field:${key}`]) return e;
      const next = { ...e };
      delete next[`field:${key}`];
      return next;
    });
  };

  const upload = (documentKey) => async (files) => {
    setUploading(documentKey || "other");
    setError("");
    try {
      for (const file of files) {
        await uploadSiteVisitPhoto(token, file, documentKey);
      }
      // Re-read so what is on screen is what the coordinator will see.
      const fresh = await getSiteVisitTask(token);
      setTask(fresh);
    } catch (err) {
      setError(getErrorMessage(err, "That file could not be uploaded. Try again."));
    } finally {
      setUploading(null);
    }
  };

  /**
   * One answer, rendered as the kind of control it was asked for. Anything
   * unrecognised falls back to a text box, so an older or hand-built request
   * still works.
   */
  const answerControl = (field) => {
    const current = form.fields[field.key] ?? "";
    const id = `sv-f-${field.key}`;
    if (field.kind === "checkbox")
      return (
        <label className="check" style={{ margin: 0 }}>
          <input
            id={id}
            type="checkbox"
            checked={Boolean(current)}
            disabled={submitting}
            onChange={(e) => setAnswer(field.key, e.target.checked)}
          />
          {field.label}
        </label>
      );
    if (field.kind === "textarea")
      return (
        <textarea
          id={id}
          rows={3}
          value={current}
          disabled={submitting}
          maxLength={LIMITS.answer}
          onChange={(e) => setAnswer(field.key, e.target.value)}
        />
      );
    if (field.kind === "number")
      return <NumberInput value={current} min={0} disabled={submitting} onChange={(v) => setAnswer(field.key, v)} />;
    if (field.kind === "date")
      return (
        <input
          id={id}
          type="date"
          value={current}
          disabled={submitting}
          onChange={(e) => setAnswer(field.key, e.target.value)}
        />
      );
    if (field.kind === "signature")
      return <SignaturePad value={current} disabled={submitting} onChange={(v) => setAnswer(field.key, v)} />;
    return (
      <input
        id={id}
        value={current}
        disabled={submitting}
        maxLength={LIMITS.answer}
        onChange={(e) => setAnswer(field.key, e.target.value)}
      />
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = validate(form, fields);
    setFieldErrors(found);
    if (Object.keys(found).length) return;
    setError("");
    setSubmitting(true);
    try {
      await submitSiteVisit(token, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        fields: form.fields,
      });
      setDone(true);
    } catch (err) {
      if (Array.isArray(err?.errors) && err.errors.length) {
        setFieldErrors(Object.fromEntries(err.errors.map((x) => [x.field, x.message])));
      }
      setError(getErrorMessage(err, "We couldn't send your report. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const brand = (
    <div className="brand login-brand">
      <BrandMark size={34} />
      <div>
        <div className="brand-name">Prestige Renewable</div>
        <div className="brand-sub">Site visit</div>
      </div>
    </div>
  );

  return (
    <div className="login-wrap">
      <section className="login-art">
        <div>
          <div className="brand" style={{ width: "fit-content" }}>
            <BrandMark size={40} />
            <div>
              <div className="brand-name">Prestige Renewable</div>
              <div className="brand-sub">Site visit</div>
            </div>
          </div>
          <h2>What did you find on site?</h2>
          <p>
            Answer what the coordinator asked for and upload the photos. Nothing else about the job is shown here, and
            you don&apos;t need an account.
          </p>
        </div>
        <p>Prestige Business Units · Site visits</p>
      </section>

      <section className="login-panel">
        {loading ? (
          <div className="login-card route-fade">
            {brand}
            <LoadingState label="Loading your visit…" />
          </div>
        ) : loadError ? (
          <div className="login-card route-fade">
            {brand}
            <h1>This link doesn&apos;t work</h1>
            <Alert tone="danger" style={{ marginTop: 12 }}>
              {loadError}
            </Alert>
            <p className="lede" style={{ marginTop: 12 }}>
              Ask the coordinator who sent it to you for a new link.
            </p>
          </div>
        ) : done ? (
          <div className="login-card route-fade">
            {brand}
            <div style={{ color: "var(--brand)", marginBottom: 12 }}>
              <CheckCircle2 size={40} strokeWidth={1.6} />
            </div>
            <h1>Thanks, that&apos;s been sent.</h1>
            <p className="lede">
              Your answers and {photos.length ? `${photos.length} file${photos.length === 1 ? "" : "s"}` : "photos"} have
              gone to the coordinator. They&apos;ll be in touch if anything else is needed.
            </p>
            {task?.submittedAt ? (
              <Alert tone="success" style={{ marginTop: 16 }}>
                Submitted {formatDate(task.submittedAt, { withTime: true })}.
              </Alert>
            ) : null}
          </div>
        ) : (
          <form className="login-card route-fade" onSubmit={submit} noValidate>
            {brand}
            <h1>{task?.title || "Site visit"}</h1>
            {task?.description ? <p className="lede">{task.description}</p> : null}

            {task?.siteAddress || task?.scheduledFor ? (
              <div className="section">
                <div className="list-stack">
                  {task.siteAddress ? (
                    <div className="list-row">
                      <span className="row-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <MapPin size={14} /> Site
                      </span>
                      <span className="row-meta">{task.siteAddress}</span>
                    </div>
                  ) : null}
                  {task.scheduledFor ? (
                    <div className="list-row">
                      <span className="row-title">Scheduled for</span>
                      <span className="row-meta">{formatDate(task.scheduledFor)}</span>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="section">
              <h3>Who you are</h3>
              <div className="form-grid">
                <Field className="span-2" label="Your name" hint="required" error={fieldErrors.name} htmlFor="sv-name">
                  {/* Pre-filled with the name the coordinator assigned, when they used one. */}
                  <input
                    id="sv-name"
                    value={form.name}
                    disabled={submitting}
                    maxLength={LIMITS.name}
                    autoComplete="name"
                    onChange={(e) => set("name", e.target.value)}
                  />
                </Field>
                <Field label="Email" hint="email or phone" error={fieldErrors.email} htmlFor="sv-email">
                  <input
                    id="sv-email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    value={form.email}
                    disabled={submitting}
                    maxLength={LIMITS.email}
                    onChange={(e) => set("email", e.target.value)}
                  />
                </Field>
                <Field label="Phone" hint="email or phone" error={fieldErrors.phone} htmlFor="sv-phone">
                  <input
                    id="sv-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={form.phone}
                    disabled={submitting}
                    maxLength={LIMITS.phone}
                    onChange={(e) => set("phone", e.target.value)}
                  />
                </Field>
              </div>
            </div>

            {fields.length ? (
              <div className="section">
                <h3>What was asked for</h3>
                <div className="form-grid">
                  {fields.map((field) => (
                    <Field
                      key={field.key}
                      className="span-2"
                      label={field.kind === "checkbox" ? undefined : field.label}
                      hint={field.hint}
                      error={fieldErrors[`field:${field.key}`]}
                      htmlFor={`sv-f-${field.key}`}
                    >
                      {answerControl(field)}
                    </Field>
                  ))}
                </div>
              </div>
            ) : null}

            {documents.length ? (
              <div className="section">
                <h3>Photos &amp; documents</h3>
                {documents.map((doc) => {
                  const files = photosFor(doc.key);
                  return (
                    <div key={doc.key} className="document-slot">
                      <div className="document-slot-head">
                        <span className="row-title">
                          {doc.label} <Badge tone="neutral">{documentTypeLabel(doc.type)}</Badge>
                        </span>
                        <Badge tone={files.length ? "success" : "warning"}>
                          {files.length ? `${files.length} uploaded` : "Not supplied"}
                        </Badge>
                      </div>
                      {doc.comment ? (
                        <p className="lede" style={{ margin: "0 0 8px" }}>
                          {doc.comment}
                        </p>
                      ) : null}
                      <FileDropzone files={files} onSelect={upload(doc.key)} uploading={uploading === doc.key} />
                    </div>
                  );
                })}
              </div>
            ) : null}

            <div className="section">
              <h3>
                Anything else you photographed <span className="hint">· optional</span>
              </h3>
              <FileDropzone
                files={photos.filter((p) => !p.documentKey)}
                onSelect={upload(null)}
                uploading={uploading === "other"}
              />
            </div>

            {error ? (
              <Alert tone="danger" style={{ marginTop: 4 }}>
                {error}
              </Alert>
            ) : null}

            <button type="submit" className="btn btn-primary" style={{ marginTop: 16 }} disabled={submitting}>
              {submitting ? "Sending…" : "Send my report"}
            </button>
            <p className="lede" style={{ marginTop: 10, marginBottom: 0 }}>
              Photos are uploaded as you add them. Sending the report tells the coordinator you are finished.
            </p>
          </form>
        )}
      </section>
    </div>
  );
}
