// The pre-site inspection form (CL-04) at /site-visit/:token — no sign-in.
// The Operations Coordinator assigns the visit and sends this link to the
// site crew member (EST-06); they fill it in on site, most likely on a phone
// with patchy signal, so:
//
//   - the whole form is one column, numbered as CL-04 is, with the job details
//     filled in from the job record and the inspection date defaulting to today;
//   - photos upload as they are taken (camera straight from the form), so a
//     dropped connection costs one photo rather than the visit;
//   - answers are kept on the phone as they are typed, so a reload or a lost
//     signal does not lose them;
//   - the items the requester or coordinator marked are required, the rest
//     optional; the signature always is. The submission date is recorded when
//     the form is sent, and sending notifies the coordinator and estimation.

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Camera, CheckCircle2, ImagePlus, Loader2 } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import BrandMark from "@/components/BrandMark";
import Field from "@/components/Field";
import FileDropzone from "@/components/FileDropzone";
import LoadingState from "@/components/LoadingState";
import NumberInput from "@/components/NumberInput";
import SignaturePad from "@/components/SignaturePad";
import { documentTypeLabel } from "@/constants/collaboration";
import { FORM_KEYS, INSPECTION_SECTIONS, ITEM_NUMBERS, SITE_PHOTOS_KEY } from "@/constants/inspectionReport";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { getErrorMessage } from "@/services/api/client";
import { getSiteVisitTask, submitSiteVisit, uploadSiteVisitPhoto } from "@/services/api/publicSiteVisitApi";
import { isBlank, isEmail } from "@/utils/validators";

const LIMITS = { name: 100, email: 254, phone: 30, answer: 2000 };
const PHONE_CHARS_RE = /^\+?[\d\s().-]+$/;
const countDigits = (value) => (String(value).match(/\d/g) || []).length;
const asList = (value) => (Array.isArray(value) ? value : []);
/** Filled in by the form itself, never asked for. */
const AUTO_KEYS = ["submittedOn", "signedBy"];

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

// Answers kept on the phone between reloads. Storage can be unavailable
// (private browsing, full), so every access is allowed to fail quietly.
const draftKey = (token) => `site-visit-draft:${token}`;
const readDraft = (token) => {
  try {
    return JSON.parse(localStorage.getItem(draftKey(token)) || "null");
  } catch {
    return null;
  }
};
const writeDraft = (token, form) => {
  try {
    localStorage.setItem(draftKey(token), JSON.stringify(form));
  } catch {
    // Not kept — the form still works.
  }
};
const clearDraft = (token) => {
  try {
    localStorage.removeItem(draftKey(token));
  } catch {
    // Nothing to clear.
  }
};

function validate(form, required, contactKnown) {
  const errors = {};
  const name = form.name.trim();
  if (!name) errors.name = "Enter your name.";
  else if (name.length > LIMITS.name) errors.name = `That name is too long (${LIMITS.name} characters max).`;

  const email = form.email.trim();
  const phone = form.phone.trim();
  if (!email && !phone && !contactKnown) errors.email = "Give an email or a phone number so we can reach you.";
  if (email && !isEmail(email)) errors.email = "Enter a valid email address.";
  if (phone) {
    if (!PHONE_CHARS_RE.test(phone)) errors.phone = "A phone number can only contain digits, spaces and + ( ) - characters.";
    else if (countDigits(phone) < 8 || countDigits(phone) > 15) errors.phone = "Enter a valid phone number.";
  }

  for (const field of required) {
    // A checkbox answers "no" by staying unticked, so it is never missing.
    if (field.kind === "checkbox") continue;
    if (isBlank(form.fields[field.key])) errors[`field:${field.key}`] = field.kind === "signature" ? "Sign here to finish." : `${field.label} is needed.`;
  }
  return errors;
}

/** Take a photo with the camera, or choose several from the phone; thumbnails of what is up. */
function PhotoCapture({ photos, onSelect, uploading, disabled }) {
  const cameraRef = useRef(null);
  const pickRef = useRef(null);
  const pick = (event) => {
    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (files.length) onSelect(files);
  };
  return (
    <div>
      <div className="site-form-photo-actions">
        <button type="button" className="btn btn-primary" onClick={() => cameraRef.current?.click()} disabled={disabled || uploading}>
          <Camera size={16} /> Take photo
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => pickRef.current?.click()} disabled={disabled || uploading}>
          <ImagePlus size={16} /> Choose photos
        </button>
        {uploading ? (
          <span className="row-meta" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Loader2 size={14} className="spin" /> Uploading…
          </span>
        ) : null}
      </div>
      {/* capture opens the rear camera on a phone; on a computer it is a file picker. */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
      <input ref={pickRef} type="file" accept="image/*" multiple hidden onChange={pick} />
      {photos.length ? (
        <div className="site-form-photos">
          {photos.map((photo) => (
            <a key={photo.id} href={photo.url} target="_blank" rel="noreferrer" title={photo.filename}>
              <img src={photo.url} alt={photo.filename} loading="lazy" />
            </a>
          ))}
        </div>
      ) : (
        <p className="row-meta" style={{ marginTop: 8 }}>
          No photos yet. Each one uploads as soon as it is taken.
        </p>
      )}
    </div>
  );
}

export default function SiteVisitPage() {
  const { token } = useParams();
  const [task, setTask] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(() => readDraft(token) ?? { name: "", email: "", phone: "", fields: { inspectionDate: today() } });
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

  // Keep what has been typed, so a reload on a bad connection loses nothing.
  useEffect(() => {
    if (!done && task) writeDraft(token, form);
  }, [form, token, done, task]);

  const requested = asList(task?.requestedFields);
  const requestedKeys = new Set(requested.map((f) => f.key));
  // Questions the coordinator added that are not on the inspection form.
  const extraFields = requested.filter((f) => !FORM_KEYS.has(f.key) && !AUTO_KEYS.includes(f.key));
  const documents = asList(task?.requestedDocuments);
  const photos = asList(task?.photos);
  const sitePhotosKey = task?.sitePhotosKey || SITE_PHOTOS_KEY;
  const photosFor = (documentKey) => photos.filter((p) => p.documentKey === documentKey);

  const isRequired = (field) => Boolean(field.required) || requestedKeys.has(field.key);
  const answerable = INSPECTION_SECTIONS.flatMap((s) => s.fields).filter((f) => f.kind !== "auto" && f.kind !== "files");
  const required = [...answerable.filter(isRequired), ...extraFields];
  const answered = [...answerable, ...extraFields].filter((f) => (f.kind === "checkbox" ? form.fields[f.key] === true : !isBlank(form.fields[f.key]))).length;

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
    setUploading(documentKey);
    setError("");
    try {
      for (const file of files) {
        await uploadSiteVisitPhoto(token, file, documentKey);
      }
      // Re-read so what is on screen is what the coordinator will see.
      setTask(await getSiteVisitTask(token));
    } catch (err) {
      setError(getErrorMessage(err, "That file could not be uploaded. Try again."));
    } finally {
      setUploading(null);
    }
  };

  /** One answer, as the control its item needs. Anything unrecognised is a text box. */
  const answerControl = (field) => {
    const current = form.fields[field.key] ?? "";
    const id = `sv-f-${field.key}`;
    if (field.kind === "checkbox")
      return (
        <label className="check site-form-check">
          <input id={id} type="checkbox" checked={Boolean(current)} disabled={submitting} onChange={(e) => setAnswer(field.key, e.target.checked)} />
          <span>{field.label}</span>
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
          placeholder={field.placeholder}
          onChange={(e) => setAnswer(field.key, e.target.value)}
        />
      );
    if (field.kind === "number") return <NumberInput value={current} min={0} disabled={submitting} onChange={(v) => setAnswer(field.key, v)} />;
    if (field.kind === "date")
      return <input id={id} type="date" value={current} disabled={submitting} onChange={(e) => setAnswer(field.key, e.target.value)} />;
    if (field.kind === "signature") return <SignaturePad value={current} disabled={submitting} onChange={(v) => setAnswer(field.key, v)} />;
    return (
      <input
        id={id}
        value={current}
        disabled={submitting}
        maxLength={LIMITS.answer}
        placeholder={field.placeholder}
        onChange={(e) => setAnswer(field.key, e.target.value)}
      />
    );
  };

  /** What an auto item shows instead of a control. */
  const autoValue = (field) => {
    if (field.key === "__job")
      return (
        <div className="list-stack site-form-job">
          {[
            ["Customer", task?.customerName],
            ["Site address", task?.siteAddress],
            ["Job number", task?.jobNumber],
            ["Quote number", task?.quoteNumber],
            ["Site crew member", task?.assigneeName],
            ["Scheduled for", task?.scheduledFor ? formatDate(task.scheduledFor) : null],
          ]
            .filter(([, value]) => value)
            .map(([label, value]) => (
              <div className="list-row" key={label}>
                <span className="row-meta">{label}</span>
                <span className="row-title" style={{ textAlign: "right" }}>
                  {value}
                </span>
              </div>
            ))}
        </div>
      );
    if (field.key === "submittedOn") return <div className="site-form-auto">{formatDate(new Date())} — recorded when you send the form</div>;
    return null;
  };

  const renderItem = (field) => {
    const number = ITEM_NUMBERS[field.key];
    const needed = isRequired(field);
    const err = fieldErrors[`field:${field.key}`];
    const label =
      field.kind === "checkbox" ? null : (
        <div className="site-form-label">
          <label htmlFor={`sv-f-${field.key}`}>{field.label}</label>
          {needed && field.kind !== "auto" ? <Badge tone="warning">Required</Badge> : null}
        </div>
      );
    return (
      <div className={`site-form-item ${err ? "invalid" : ""}`.trim()} key={field.key} id={`item-${field.key}`}>
        <span className="site-form-no" aria-hidden="true">
          {number}
        </span>
        <div className="site-form-body">
          {label}
          {field.kind === "auto" ? (
            autoValue(field)
          ) : field.kind === "files" ? (
            <PhotoCapture photos={photosFor(sitePhotosKey)} onSelect={upload(sitePhotosKey)} uploading={uploading === sitePhotosKey} disabled={submitting} />
          ) : (
            <>
              {answerControl(field)}
              {field.kind === "checkbox" && needed ? (
                <div style={{ marginTop: 4 }}>
                  <Badge tone="warning">Required</Badge>
                </div>
              ) : null}
            </>
          )}
          {field.hint ? <div className="row-meta site-form-hint">{field.hint}</div> : null}
          {err ? <span className="field-error">{err}</span> : null}
        </div>
      </div>
    );
  };

  const submit = async (e) => {
    e.preventDefault();
    const found = validate(form, required, task?.contactKnown);
    setFieldErrors(found);
    if (Object.keys(found).length) {
      // Take them to the first thing that needs fixing.
      const first = Object.keys(found)[0];
      const target = first.startsWith("field:") ? document.getElementById(`item-${first.slice(6)}`) : document.getElementById("sv-name");
      target?.scrollIntoView({ behavior: "smooth", block: "center" });
      setError(`${Object.keys(found).length === 1 ? "One item needs" : `${Object.keys(found).length} items need`} attention before sending.`);
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      await submitSiteVisit(token, { name: form.name.trim(), email: form.email.trim(), phone: form.phone.trim(), fields: form.fields });
      clearDraft(token);
      setDone(true);
      window.scrollTo({ top: 0 });
    } catch (err) {
      if (Array.isArray(err?.errors) && err.errors.length) setFieldErrors(Object.fromEntries(err.errors.map((x) => [x.field, x.message])));
      setError(getErrorMessage(err, "We couldn't send your report. Please try again — your answers are kept on this phone."));
    } finally {
      setSubmitting(false);
    }
  };

  const header = (
    <header className="site-form-head">
      <div className="site-form-inner site-form-head-row">
        <div className="brand" style={{ width: "fit-content" }}>
          <BrandMark size={30} />
          <div>
            <div className="brand-name">Pre-site inspection</div>
            <div className="brand-sub">{task?.jobNumber || "Site visit"}</div>
          </div>
        </div>
        {task && !done ? (
          <span className="row-meta">
            {answered} of {answerable.length + extraFields.length} answered
          </span>
        ) : null}
      </div>
    </header>
  );

  if (loading || loadError || done) {
    return (
      <div className="site-form">
        {header}
        <main className="site-form-inner site-form-main">
          <section className="site-form-card">
            {loading ? (
              <LoadingState label="Loading your inspection…" />
            ) : loadError ? (
              <>
                <h1>This link doesn&apos;t work</h1>
                <Alert tone="danger" style={{ marginTop: 12 }}>
                  {loadError}
                </Alert>
                <p className="lede" style={{ marginTop: 12 }}>
                  Ask the coordinator who sent it to you for a new link.
                </p>
              </>
            ) : (
              <>
                <div style={{ color: "var(--success)", marginBottom: 12 }}>
                  <CheckCircle2 size={40} strokeWidth={1.6} />
                </div>
                <h1>Thanks — the inspection has been sent.</h1>
                <p className="lede">
                  Your findings{photos.length ? ` and ${photos.length} photo${photos.length === 1 ? "" : "s"}` : ""} have gone to the coordinator and the
                  estimation team.
                </p>
                {task?.submittedAt ? (
                  <Alert tone="success" style={{ marginTop: 16 }}>
                    Submitted {formatDate(task.submittedAt, { withTime: true })}.
                  </Alert>
                ) : null}
              </>
            )}
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="site-form">
      {header}
      <form className="site-form-inner site-form-main" onSubmit={submit} noValidate>
        <section className="site-form-card">
          <h1>{task?.title || "Pre-site inspection"}</h1>
          <p className="lede" style={{ marginBottom: 0 }}>
            {task?.description ||
              "Record what you find on site — roof, switchboard, cable pathway, access and anything that limits the install — so the estimator can finalise the quote against real site conditions."}
          </p>
        </section>

        {INSPECTION_SECTIONS.map((section) => (
          <section className="site-form-card" key={section.key}>
            <h2 className="site-form-h2">{section.title}</h2>
            {section.fields.map(renderItem)}

            {section.key === "job" ? (
              <div className="site-form-item">
                <span className="site-form-no" aria-hidden="true" />
                <div className="site-form-body">
                  <div className="form-grid">
                    <Field className="span-2" label="Your name" required error={fieldErrors.name} htmlFor="sv-name">
                      <input id="sv-name" value={form.name} disabled={submitting} maxLength={LIMITS.name} autoComplete="name" onChange={(e) => set("name", e.target.value)} />
                    </Field>
                    <Field
                      label="Email"
                      required={!task?.contactKnown}
                      hint={task?.contactKnown ? "optional" : "email or phone"}
                      error={fieldErrors.email}
                      htmlFor="sv-email"
                    >
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
                    <Field
                      label="Phone"
                      required={!task?.contactKnown}
                      hint={task?.contactKnown ? "optional" : "email or phone"}
                      error={fieldErrors.phone}
                      htmlFor="sv-phone"
                    >
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
              </div>
            ) : null}

            {section.key === "photos" && documents.length ? (
              <div className="site-form-requested">
                <h3>Photos &amp; documents the coordinator asked for</h3>
                {documents.map((doc) => {
                  const files = photosFor(doc.key);
                  return (
                    <div key={doc.key} className="document-slot">
                      <div className="document-slot-head">
                        <span className="row-title">
                          {doc.label} <Badge tone="neutral">{documentTypeLabel(doc.type)}</Badge>
                        </span>
                        <Badge tone={files.length ? "success" : "warning"}>{files.length ? `${files.length} uploaded` : "Not supplied"}</Badge>
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
          </section>
        ))}

        {extraFields.length ? (
          <section className="site-form-card">
            <h2 className="site-form-h2">Also asked by the coordinator</h2>
            {extraFields.map((field) => (
              <div className={`site-form-item ${fieldErrors[`field:${field.key}`] ? "invalid" : ""}`.trim()} key={field.key} id={`item-${field.key}`}>
                <span className="site-form-no" aria-hidden="true" />
                <div className="site-form-body">
                  {field.kind === "checkbox" ? null : (
                    <div className="site-form-label">
                      <label htmlFor={`sv-f-${field.key}`}>{field.label}</label>
                      <Badge tone="warning">Required</Badge>
                    </div>
                  )}
                  {answerControl(field)}
                  {field.hint ? <div className="row-meta site-form-hint">{field.hint}</div> : null}
                  {fieldErrors[`field:${field.key}`] ? <span className="field-error">{fieldErrors[`field:${field.key}`]}</span> : null}
                </div>
              </div>
            ))}
          </section>
        ) : null}

        <div className="site-form-submit">
          {error ? (
            <Alert tone="danger" style={{ marginBottom: 10 }}>
              {error}
            </Alert>
          ) : null}
          <button type="submit" className="btn btn-primary" disabled={submitting || Boolean(uploading)}>
            {submitting ? "Sending…" : "Sign and send inspection"}
          </button>
          <span className="row-meta">Photos are already uploaded. Sending notifies the coordinator and the estimation team.</span>
        </div>
      </form>
    </div>
  );
}
