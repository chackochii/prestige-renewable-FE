// Lead pack form: customer details, then the mandatory checklist — which
// folds in the optional client-visit capture and the potential-client
// decision, in that order.

import { useEffect, useState } from "react";
import { Building2, Check, ClipboardCheck, PhoneCall, Plus, Users, X } from "lucide-react";
import { formatDate } from "@/helpers/dateTimeHelpers";
import Field from "@/components/Field";
import SectionHead from "@/components/SectionHead";
import NumberInput from "@/components/NumberInput";
import FileDropzone from "@/components/FileDropzone";
import { AU_STATES } from "@/constants/stages";
import { commissionTiersFor, leadSourceLabel, MANUAL_LEAD_SOURCES } from "@/features/leads/leadSourceOptions";
import { isAutomatedSource } from "@/features/leads/leadFormModel";
import { isBlank } from "@/utils/validators";
import ChecklistRow from "./ChecklistRow";

const SECTIONS = [
  { id: "lf-customer", label: "Customer", icon: Building2 },
  { id: "lf-checklist", label: "Checklist", icon: ClipboardCheck },
];

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export default function LeadForm({
  form,
  set,
  errors = {},
  estimators = [],
  sales = [],
  siteOps = [],
  referrers = [],
  unit,
  disabled = false,
  showChecklist = true,
  clientMeetingSlot,
  billFiles = [],
  onUploadBills,
  uploadingBills = false,
}) {
  const err = (field) => errors[field];
  const hasSalesperson = !isBlank(form.salespersonId) && showChecklist;
  const visibleSections = SECTIONS.filter((s) => s.id !== "lf-checklist" || hasSalesperson);
  const [active, setActive] = useState(visibleSections[0].id);
  const automated = isAutomatedSource(form.leadSource);
  const tiers = commissionTiersFor(unit);

  useEffect(() => {
    const nodes = visibleSections.map((s) => document.getElementById(s.id)).filter(Boolean);
    if (!nodes.length || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: "-15% 0px -70% 0px", threshold: 0 },
    );
    nodes.forEach((n) => observer.observe(n));
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasSalesperson]);

  const input = (field, props = {}) => (
    <input
      value={form[field]}
      disabled={disabled}
      onChange={(e) => set(field, e.target.value)}
      autoComplete="off"
      {...props}
    />
  );

  const customFields = form.customFields || [];
  const setCustomField = (i, key, value) =>
    set(
      "customFields",
      customFields.map((f, idx) => (idx === i ? { ...f, [key]: value } : f)),
    );
  const addCustomField = () => set("customFields", [...customFields, { label: "", value: "" }]);
  const removeCustomField = (i) => set("customFields", customFields.filter((_, idx) => idx !== i));

  const contactAttempts = form.contactAttempts || [];
  const emptyAttemptDraft = { method: "", contactedAt: "", reached: true, reason: "" };
  const [attemptDraft, setAttemptDraft] = useState(emptyAttemptDraft);
  const attemptDraftValid =
    attemptDraft.method.trim() && attemptDraft.contactedAt && (attemptDraft.reached || attemptDraft.reason.trim());
  const addContactAttempt = () => {
    if (!attemptDraftValid) return;
    set("contactAttempts", [...contactAttempts, attemptDraft]);
    setAttemptDraft(emptyAttemptDraft);
  };
  const removeContactAttempt = (i) => set("contactAttempts", contactAttempts.filter((_, idx) => idx !== i));

  // One boolean per mandatory row — the single source of truth for both the
  // row ticks and the "Potential" gate/progress bar below.
  const doneContact = !form.needsClientContact || contactAttempts.length > 0;
  const doneType = !isBlank(form.leadType);
  const doneAddress = !isBlank(form.siteLine1) && !isBlank(form.siteSuburb) && !isBlank(form.sitePostcode);
  const doneEmail = !isBlank(form.customerEmail);
  const donePhone = !isBlank(form.customerPhone);
  const doneBills = form.energyHasBills || billFiles.length > 0;
  const doneUsage = !isBlank(form.energyAnnualKwh);
  const doneSource = !isBlank(form.leadSource) && (automated || !isBlank(form.leadSourceDetails));

  const requiredDone = [doneContact, doneType, doneAddress, doneEmail, donePhone, doneBills, doneUsage, doneSource];
  const doneCount = requiredDone.filter(Boolean).length;
  const checklistComplete = doneCount === requiredDone.length;

  return (
    <>
      <div className="form-nav">
        {visibleSections.map((s) => (
          <button
            key={s.id}
            type="button"
            className={active === s.id ? "active" : ""}
            onClick={() => {
              setActive(s.id);
              scrollTo(s.id);
            }}
          >
            <s.icon size={13} /> {s.label}
          </button>
        ))}
      </div>

      <div className="section" id="lf-customer">
        <SectionHead icon={<Building2 size={13} />} title="Customer" />
        <div className="form-grid">
          <Field label="Name" error={err("customerLegalName")}>
            {input("customerLegalName")}
          </Field>
          <Field label="ABN">{input("customerAbn")}</Field>
          <Field label="Phone" error={err("customerPhone")}>
            {input("customerPhone")}
          </Field>
          <Field label="Email" className="span-2" error={err("customerEmail")}>
            {input("customerEmail", { type: "email" })}
          </Field>
          <Field label="Billing address" className="span-2">
            {input("customerBillingAddress")}
          </Field>
          <Field label="Salesperson" hint="unlocks the mandatory checklist once set">
            <select value={form.salespersonId} disabled={disabled} onChange={(e) => set("salespersonId", e.target.value)}>
              <option value="">Later</option>
              {sales.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </Field>
          {isBlank(form.salespersonId) ? (
            <Field label="Reason no salesperson is assigned yet" className="span-2" error={err("unassignedReason")}>
              <textarea
                rows={2}
                value={form.unassignedReason}
                disabled={disabled}
                onChange={(e) => set("unassignedReason", e.target.value)}
              />
            </Field>
          ) : null}
        </div>
      </div>

      {hasSalesperson ? (
        <div className="section" id="lf-checklist">
          <SectionHead icon={<ClipboardCheck size={13} />} title="Mandatory checklist" />
          <p className="lede" style={{ marginBottom: 16 }}>
            What Estimation needs before this lead can move forward — enter it directly, or upload the document.
          </p>

          <div className="checklist-progress">
            <span className="cp-label">
              {doneCount} of {requiredDone.length} complete
            </span>
            <div className="cp-track">
              <i style={{ width: `${(doneCount / requiredDone.length) * 100}%` }} />
            </div>
          </div>

          <div className="checklist" style={{ marginBottom: 20 }}>
            <ChecklistRow done={doneContact} label="Contact client?">
              <label className="check" style={{ marginBottom: form.needsClientContact ? 10 : 0 }}>
                <input
                  type="checkbox"
                  checked={form.needsClientContact}
                  disabled={disabled}
                  onChange={(e) => set("needsClientContact", e.target.checked)}
                />
                Need to contact client to collect mandatory details
              </label>
              {form.needsClientContact ? (
                <div>
                  {contactAttempts.length ? (
                    <div className="list-stack" style={{ marginBottom: 10 }}>
                      {contactAttempts.map((a, i) => (
                        <div key={i} className="list-row">
                          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                            <span className={`status-icon ${a.reached === false ? "failed" : "done"}`}>
                              <PhoneCall size={14} />
                            </span>
                            <div>
                              <div className="row-title">
                                Attempt {i + 1} · {a.method} · {a.reached === false ? "Not reached" : "Reached"}
                              </div>
                              <div className="row-meta">
                                {formatDate(a.contactedAt)}
                                {a.reached === false && a.reason ? ` — ${a.reason}` : ""}
                              </div>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            disabled={disabled}
                            onClick={() => removeContactAttempt(i)}
                            aria-label="Remove attempt"
                          >
                            <X size={14} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : null}
                  {err("contactAttempts") ? (
                    <p className="field-error" style={{ marginBottom: 8 }}>
                      {err("contactAttempts")}
                    </p>
                  ) : null}
                  <p className="lede" style={{ marginBottom: 8 }}>
                    No response yet? Log another attempt — every attempt is kept.
                  </p>
                  <div className="form-grid" style={{ marginBottom: 8 }}>
                    <Field>
                      <input
                        value={attemptDraft.method}
                        disabled={disabled}
                        onChange={(e) => setAttemptDraft((a) => ({ ...a, method: e.target.value }))}
                        placeholder="e.g. Phone call, email"
                      />
                    </Field>
                    <Field>
                      <input
                        type="date"
                        value={attemptDraft.contactedAt}
                        disabled={disabled}
                        onChange={(e) => setAttemptDraft((a) => ({ ...a, contactedAt: e.target.value }))}
                      />
                    </Field>
                  </div>
                  <label className="check" style={{ marginBottom: attemptDraft.reached ? 0 : 10 }}>
                    <input
                      type="checkbox"
                      checked={attemptDraft.reached}
                      disabled={disabled}
                      onChange={(e) => setAttemptDraft((a) => ({ ...a, reached: e.target.checked }))}
                    />
                    Client was reached
                  </label>
                  {!attemptDraft.reached ? (
                    <Field label="Reason not reached">
                      <textarea
                        rows={2}
                        value={attemptDraft.reason}
                        disabled={disabled}
                        onChange={(e) => setAttemptDraft((a) => ({ ...a, reason: e.target.value }))}
                      />
                    </Field>
                  ) : null}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    style={{ marginTop: 10 }}
                    disabled={disabled || !attemptDraftValid}
                    onClick={addContactAttempt}
                  >
                    <Plus size={14} /> Add attempt
                  </button>
                </div>
              ) : null}
            </ChecklistRow>

            <ChecklistRow done={doneType} label="Type">
              <Field error={err("leadType")}>
                <select value={form.leadType} disabled={disabled} onChange={(e) => set("leadType", e.target.value)}>
                  <option value="">Select type</option>
                  <option value="residential">Residential</option>
                  <option value="commercial">Commercial</option>
                  <option value="industrial">Industrial</option>
                  <option value="other">Other</option>
                </select>
              </Field>
            </ChecklistRow>

            <ChecklistRow done={doneAddress} label="Address">
              <div className="form-grid">
                <Field className="span-2" error={err("siteLine1")}>
                  {input("siteLine1", { placeholder: "Street" })}
                </Field>
                <Field error={err("siteSuburb")}>{input("siteSuburb", { placeholder: "Suburb" })}</Field>
                <Field>
                  <select value={form.siteState} disabled={disabled} onChange={(e) => set("siteState", e.target.value)}>
                    {AU_STATES.map((s) => (
                      <option key={s}>{s}</option>
                    ))}
                  </select>
                </Field>
                <Field>{input("sitePostcode", { placeholder: "Postcode" })}</Field>
                <Field>{input("siteContact", { placeholder: "Site contact" })}</Field>
                <Field className="span-2" label="Access notes" hint="gate codes, parking, hours">
                  {input("siteAccessNotes")}
                </Field>
              </div>
            </ChecklistRow>

            <ChecklistRow done={!isBlank(form.siteMapUrl)} label="Map location">
              <Field error={err("siteMapUrl")}>
                {input("siteMapUrl", { placeholder: "Paste a Google Maps link" })}
              </Field>
            </ChecklistRow>

            <ChecklistRow done={doneEmail} label="Email">
              <Field error={err("customerEmail")}>{input("customerEmail", { type: "email", placeholder: "Email" })}</Field>
            </ChecklistRow>

            <ChecklistRow done={donePhone} label="Phone number">
              <Field error={err("customerPhone")}>{input("customerPhone", { placeholder: "Phone number" })}</Field>
            </ChecklistRow>

            <ChecklistRow done={doneBills} label="Electricity bills">
              <label className="check" style={{ marginBottom: 10 }}>
                <input
                  type="checkbox"
                  checked={form.energyHasBills}
                  disabled={disabled}
                  onChange={(e) => set("energyHasBills", e.target.checked)}
                />
                Bills available on file
              </label>
              {onUploadBills ? (
                <FileDropzone files={billFiles} onSelect={onUploadBills} disabled={disabled} uploading={uploadingBills} />
              ) : (
                <p className="dropzone-empty" style={{ margin: 0 }}>
                  Upload available once this lead is saved.
                </p>
              )}
            </ChecklistRow>

            <ChecklistRow done={doneUsage} label="Annual usage (kWh)">
              <Field error={err("energyAnnualKwh")}>
                <NumberInput
                  value={form.energyAnnualKwh}
                  disabled={disabled}
                  min={0}
                  onChange={(v) => set("energyAnnualKwh", v)}
                />
              </Field>
            </ChecklistRow>

            <ChecklistRow done={doneSource} label="Lead source">
              <Field error={err("leadSource")}>
                {automated ? (
                  <input value={leadSourceLabel(form.leadSource)} disabled />
                ) : (
                  <select value={form.leadSource} disabled={disabled} onChange={(e) => set("leadSource", e.target.value)}>
                    {MANUAL_LEAD_SOURCES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                )}
              </Field>
              {!automated && !isBlank(form.leadSource) ? (
                <div style={{ marginTop: 10 }}>
                  <Field label="Source details" error={err("leadSourceDetails")}>
                    <input
                      value={form.leadSourceDetails}
                      disabled={disabled}
                      onChange={(e) => set("leadSourceDetails", e.target.value)}
                      placeholder="Who referred, or where this lead came from"
                    />
                  </Field>
                </div>
              ) : null}
              {form.leadSource === "referrer" ? (
                <div className="form-grid" style={{ marginTop: 10 }}>
                  <Field label="Referrer" error={err("referrerId")}>
                    <select value={form.referrerId} disabled={disabled} onChange={(e) => set("referrerId", e.target.value)}>
                      <option value="">Select</option>
                      {referrers.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.organisation}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Involvement tier">
                    <select
                      value={form.involvementTier}
                      disabled={disabled}
                      onChange={(e) => set("involvementTier", e.target.value)}
                    >
                      {tiers.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              ) : null}
            </ChecklistRow>

            <ChecklistRow done label="Discount from business owner?">
              <label className="check" style={{ marginBottom: form.hasOwnerDiscount ? 10 : 0 }}>
                <input
                  type="checkbox"
                  checked={form.hasOwnerDiscount}
                  disabled={disabled}
                  onChange={(e) => set("hasOwnerDiscount", e.target.checked)}
                />
                Any discount provided by the business owner
              </label>
              {form.hasOwnerDiscount ? (
                <div className="form-grid">
                  <Field label="Owner name" error={err("ownerDiscountName")}>
                    <input
                      value={form.ownerDiscountName}
                      disabled={disabled}
                      onChange={(e) => set("ownerDiscountName", e.target.value)}
                    />
                  </Field>
                  <Field label="Discount amount" error={err("ownerDiscountAmount")}>
                    <NumberInput
                      value={form.ownerDiscountAmount}
                      disabled={disabled}
                      min={0}
                      onChange={(v) => set("ownerDiscountAmount", v)}
                    />
                  </Field>
                </div>
              ) : null}
            </ChecklistRow>
          </div>

          <label className="check">
            <input
              type="checkbox"
              checked={form.needsClientVisit}
              disabled={disabled}
              onChange={(e) => set("needsClientVisit", e.target.checked)}
            />
            Need client visit
          </label>
          {form.needsClientVisit ? (
            <div style={{ marginTop: 10, maxWidth: 480 }}>
              <Field label="Reason for client visit" error={err("clientVisitReason")}>
                <textarea
                  rows={2}
                  value={form.clientVisitReason}
                  disabled={disabled}
                  onChange={(e) => set("clientVisitReason", e.target.value)}
                />
              </Field>
            </div>
          ) : null}

          {form.needsClientVisit ? (
            <div className="decision-card">
              <SectionHead icon={<Users size={13} />} title="Client meeting & site visit" />

              <div style={{ maxWidth: 320, marginBottom: 16 }}>
                <Field label="Assign to operational coordinator" error={err("operationalCoordinatorId")}>
                  <select
                    value={form.operationalCoordinatorId}
                    disabled={disabled}
                    onChange={(e) => set("operationalCoordinatorId", e.target.value)}
                  >
                    <option value="">Select coordinator</option>
                    {siteOps.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                        {u.title ? ` · ${u.title}` : ""}
                      </option>
                    ))}
                  </select>
                  {siteOps.length === 0 ? (
                    <span className="field-error">No operational coordinator in this unit yet. Add one in Admin.</span>
                  ) : null}
                </Field>
              </div>

              {clientMeetingSlot}

              <p className="eyebrow">Custom fields</p>
              <div className="list-stack" style={{ marginBottom: 10 }}>
                {customFields.map((f, i) => (
                  <div key={i} className="form-grid" style={{ alignItems: "start" }}>
                    <Field>
                      <input
                        placeholder="Field name"
                        value={f.label}
                        disabled={disabled}
                        onChange={(e) => setCustomField(i, "label", e.target.value)}
                      />
                    </Field>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <Field>
                          <input
                            placeholder="Value"
                            value={f.value}
                            disabled={disabled}
                            onChange={(e) => setCustomField(i, "value", e.target.value)}
                          />
                        </Field>
                      </div>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={disabled}
                        onClick={() => removeCustomField(i)}
                        aria-label="Remove field"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button type="button" className="btn btn-ghost btn-sm" onClick={addCustomField} disabled={disabled}>
                <Plus size={14} /> Add custom field
              </button>
            </div>
          ) : null}

          <div className="decision-card">
            <SectionHead icon={<Check size={13} />} title="Potential client?" />
            {!checklistComplete ? (
              <p className="lede" style={{ marginBottom: 12 }}>
                Complete the checklist above before deciding.
              </p>
            ) : null}
            <div className="decision-actions">
              <button
                type="button"
                className={`btn ${form.potential === "yes" ? "btn-primary" : "btn-ghost"}`}
                disabled={disabled || !checklistComplete}
                onClick={() => set("potential", "yes")}
              >
                Potential
              </button>
              <button
                type="button"
                className={`btn ${form.potential === "no" ? "btn-danger" : "btn-ghost"}`}
                disabled={disabled}
                onClick={() => set("potential", "no")}
              >
                Not potential
              </button>
            </div>

            {form.potential === "no" ? (
              <div style={{ marginTop: 14, maxWidth: 480 }}>
                <Field label="Reason" error={err("notPotentialReason")}>
                  <textarea
                    rows={2}
                    value={form.notPotentialReason}
                    disabled={disabled}
                    onChange={(e) => set("notPotentialReason", e.target.value)}
                  />
                </Field>
              </div>
            ) : null}

            {form.potential === "yes" ? (
              <div style={{ marginTop: 14, maxWidth: 320 }}>
                <Field label="Assign estimator" error={err("estimatorId")}>
                  <select value={form.estimatorId} disabled={disabled} onChange={(e) => set("estimatorId", e.target.value)}>
                    <option value="">Select estimator</option>
                    {estimators.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name}
                        {u.title ? ` · ${u.title}` : ""}
                      </option>
                    ))}
                  </select>
                  {estimators.length === 0 ? (
                    <span className="field-error">No one in this unit can be assigned yet. Add users in Admin.</span>
                  ) : null}
                </Field>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
