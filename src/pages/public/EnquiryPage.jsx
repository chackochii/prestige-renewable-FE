// Public enquiry form at /enquiry — no sign-in. Name, email and phone are
// required; the site address and a message are optional. Submits to
// POST /api/public/leads, which files a normal stage-1 lead for the team.
//
// Visitors never choose a business unit and are never shown the list of them:
// `?unit=PRS` on a link staff share routes the enquiry, and a bare /enquiry
// goes to the default unit the server is configured with. Either way the
// sender just fills in their details and sends.

import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import Field from "@/components/Field";
import Alert from "@/components/Alert";
import BrandMark from "@/components/BrandMark";
import { AU_STATES } from "@/constants/stages";
import { submitPublicLead } from "@/services/api/publicLeadsApi";
import { getErrorMessage } from "@/services/api/client";
import { isBlank, isEmail } from "@/utils/validators";

// These mirror the server's rules in prestige-be/modules/opportunity/service/
// publicLeadService.js. The server is the authority; this just saves a round
// trip and points at the right field.
const LIMITS = { name: 100, email: 254, phone: 30, siteLine1: 200, siteSuburb: 100, sitePostcode: 4, message: 2000 };
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}\s'.-]*$/u;
const PHONE_CHARS_RE = /^\+?[\d\s().-]+$/;
const POSTCODE_RE = /^\d{4}$/;
const countDigits = (value) => (String(value).match(/\d/g) || []).length;

const emptyForm = () => ({
  name: "",
  email: "",
  phone: "",
  siteLine1: "",
  siteSuburb: "",
  siteState: "",
  sitePostcode: "",
  message: "",
  website: "", // honeypot — hidden from people, filled by bots
});

function validate(form) {
  const errors = {};
  const name = form.name.trim();
  if (!name) errors.name = "Enter your name.";
  else if (name.length < 2) errors.name = "Enter your full name.";
  else if (name.length > LIMITS.name) errors.name = `Your name is too long (${LIMITS.name} characters max).`;
  else if (!NAME_RE.test(name)) errors.name = "Your name can only contain letters, spaces, apostrophes and hyphens.";

  const email = form.email.trim();
  if (!email) errors.email = "Enter your email.";
  else if (email.length > LIMITS.email) errors.email = `Your email is too long (${LIMITS.email} characters max).`;
  else if (!isEmail(email)) errors.email = "Enter a valid email address.";

  const phone = form.phone.trim();
  if (!phone) errors.phone = "Enter your phone number.";
  else if (phone.length > LIMITS.phone) errors.phone = "That phone number is too long.";
  else if (!PHONE_CHARS_RE.test(phone))
    errors.phone = "A phone number can only contain digits, spaces and + ( ) - characters.";
  else if (countDigits(phone) < 8 || countDigits(phone) > 15)
    errors.phone = "Enter a valid phone number (8 to 15 digits).";

  // Optional fields: only checked when the visitor filled them in.
  if (!isBlank(form.siteLine1) && form.siteLine1.trim().length > LIMITS.siteLine1)
    errors.siteLine1 = `That address is too long (${LIMITS.siteLine1} characters max).`;
  if (!isBlank(form.siteSuburb) && form.siteSuburb.trim().length > LIMITS.siteSuburb)
    errors.siteSuburb = `That suburb is too long (${LIMITS.siteSuburb} characters max).`;
  if (!isBlank(form.sitePostcode) && !POSTCODE_RE.test(form.sitePostcode.trim()))
    errors.sitePostcode = "Postcode must be 4 digits.";
  return errors;
}

export default function EnquiryPage() {
  const [searchParams] = useSearchParams();
  // Set by the link, never by the visitor. An unknown code is rejected by the
  // server, so there is nothing to validate here.
  const linkedUnit = (searchParams.get("unit") || "").trim().toUpperCase();
  const [form, setForm] = useState(emptyForm);
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(null); // { number, businessUnit }

  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (fieldErrors[key]) setFieldErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = async (e) => {
    e.preventDefault();
    const errors = validate(form);
    setFieldErrors(errors);
    if (Object.keys(errors).length) return;
    setError("");
    setSubmitting(true);
    try {
      const payload = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, typeof v === "string" ? v.trim() : v]));
      // Only present when the link carried one; otherwise the server decides.
      if (linkedUnit) payload.businessUnit = linkedUnit;
      const result = await submitPublicLead(payload);
      setDone(result || {});
    } catch (err) {
      // Server-side field errors come back as [{ field, message }].
      if (Array.isArray(err?.errors) && err.errors.length) {
        setFieldErrors(Object.fromEntries(err.errors.map((x) => [x.field, x.message])));
      }
      setError(getErrorMessage(err, "We couldn't send your enquiry. Please try again."));
    } finally {
      setSubmitting(false);
    }
  };

  const input = (key, props = {}) => (
    <input id={`enq-${key}`} value={form[key]} onChange={(ev) => set(key, ev.target.value)} disabled={submitting} {...props} />
  );

  return (
    <div className="login-wrap">
      <section className="login-art">
        <div>
          <Link to="/" className="brand" style={{ width: "fit-content" }}>
            <BrandMark size={40} />
            <div>
              <div className="brand-name">Prestige Renewable</div>
              <div className="brand-sub">Sales &amp; delivery</div>
            </div>
          </Link>
          <h2>Tell us about your project.</h2>
          <p>
            Leave your details and a little about the site. One of our team will be in touch to talk through options and
            next steps.
          </p>
        </div>
        <p>Prestige Business Units · Enquiries</p>
      </section>

      <section className="login-panel">
        {done ? (
          <div className="login-card route-fade">
            <Link to="/" className="brand login-brand">
              <BrandMark size={34} />
              <div>
                <div className="brand-name">Prestige Renewable</div>
                <div className="brand-sub">Sales &amp; delivery</div>
              </div>
            </Link>
            <div style={{ color: "var(--brand)", marginBottom: 12 }}>
              <CheckCircle2 size={40} strokeWidth={1.6} />
            </div>
            <h1>Thanks, we've got it.</h1>
            <p className="lede">
              Your enquiry has been sent to our team. We'll contact you on the details you gave us.
            </p>
            {done.number ? (
              <Alert tone="success" style={{ marginTop: 16 }}>
                Your reference is <strong>{done.number}</strong>. Keep it handy if you need to follow up.
              </Alert>
            ) : null}
            <div style={{ marginTop: 24 }}>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setDone(null);
                  setForm(emptyForm());
                }}
              >
                Send another enquiry
              </button>
            </div>
          </div>
        ) : (
          <form className="login-card route-fade" onSubmit={submit} noValidate>
            <Link to="/" className="brand login-brand">
              <BrandMark size={34} />
              <div>
                <div className="brand-name">Prestige Renewable</div>
                <div className="brand-sub">Sales &amp; delivery</div>
              </div>
            </Link>
            <h1>Get in touch</h1>
            <p className="lede">Name, email and phone are all we need to get started. The rest is optional.</p>

            <div className="section">
              <h3>Your details</h3>
              <div className="form-grid">
                <Field className="span-2" label="Full name" hint="required" error={fieldErrors.name} htmlFor="enq-name">
                  {input("name", { autoComplete: "name", autoFocus: true, maxLength: LIMITS.name, required: true })}
                </Field>
                <Field label="Email" hint="required" error={fieldErrors.email} htmlFor="enq-email">
                  {input("email", {
                    type: "email",
                    autoComplete: "email",
                    inputMode: "email",
                    maxLength: LIMITS.email,
                    required: true,
                  })}
                </Field>
                <Field label="Phone" hint="required" error={fieldErrors.phone} htmlFor="enq-phone">
                  {input("phone", {
                    type: "tel",
                    autoComplete: "tel",
                    inputMode: "tel",
                    maxLength: LIMITS.phone,
                    required: true,
                  })}
                </Field>
              </div>
            </div>

            <div className="section">
              <h3>Site address <span className="hint">· optional</span></h3>
              <div className="form-grid">
                <Field className="span-2" error={fieldErrors.siteLine1} htmlFor="enq-siteLine1">
                  {input("siteLine1", {
                    placeholder: "Street address",
                    autoComplete: "street-address",
                    maxLength: LIMITS.siteLine1,
                  })}
                </Field>
                <Field error={fieldErrors.siteSuburb} htmlFor="enq-siteSuburb">
                  {input("siteSuburb", { placeholder: "Suburb", autoComplete: "address-level2", maxLength: LIMITS.siteSuburb })}
                </Field>
                <Field error={fieldErrors.siteState} htmlFor="enq-siteState">
                  <select
                    id="enq-siteState"
                    value={form.siteState}
                    onChange={(ev) => set("siteState", ev.target.value)}
                    disabled={submitting}
                  >
                    <option value="">State</option>
                    {AU_STATES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field error={fieldErrors.sitePostcode} htmlFor="enq-sitePostcode">
                  {input("sitePostcode", {
                    placeholder: "Postcode",
                    inputMode: "numeric",
                    autoComplete: "postal-code",
                    maxLength: LIMITS.sitePostcode,
                  })}
                </Field>
                <Field className="span-2" label="Anything else?" htmlFor="enq-message">
                  <textarea
                    id="enq-message"
                    rows={3}
                    value={form.message}
                    onChange={(ev) => set("message", ev.target.value)}
                    disabled={submitting}
                    maxLength={LIMITS.message}
                    placeholder="What are you looking to do?"
                  />
                </Field>
              </div>
            </div>

            {/* Honeypot: off-screen, not focusable, ignored by real visitors. */}
            <div aria-hidden="true" style={{ position: "absolute", left: -9999, width: 1, height: 1, overflow: "hidden" }}>
              <label htmlFor="enq-website">Website</label>
              <input id="enq-website" tabIndex={-1} autoComplete="off" value={form.website} onChange={(ev) => set("website", ev.target.value)} />
            </div>

            {error ? <Alert tone="danger">{error}</Alert> : null}

            <button
              className="btn btn-primary"
              type="submit"
              disabled={submitting}
              style={{ width: "100%", justifyContent: "center" }}
            >
              {submitting ? "Sending…" : "Send enquiry"} <ArrowRight size={16} />
            </button>
          </form>
        )}
      </section>
    </div>
  );
}
