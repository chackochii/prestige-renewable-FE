// Estimation Input — the ten items an estimator works through before BOQ
// preparation can start (see constants/estimationInput.js for the field list
// and who owns each one).
//
// It opens with a read-only review of what sales already captured on the lead
// (contact, install address, service requirement, house type, roof type and
// electrical phase) so the estimator confirms the minimum information is
// complete rather than re-typing it.
//
// Everything is buffered locally and committed with "Save estimation input",
// the same as the estimator checklist — typing doesn't fire a request per
// keystroke.

import { useEffect, useMemo, useState } from "react";
import {
  BatteryCharging,
  ClipboardCheck,
  FileStack,
  Gauge,
  ListChecks,
  Plug,
  ScrollText,
  Sun,
  TriangleAlert,
} from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Field from "@/components/Field";
import FileDropzone from "@/components/FileDropzone";
import NumberInput from "@/components/NumberInput";
import SectionHead from "@/components/SectionHead";
import {
  BACKUP_OPTIONS,
  OWNERS,
  PERMIT_OPTIONS,
  SITE_TYPES,
  SWITCHBOARD_CONDITIONS,
  VPP_OPTIONS,
  estimationInputFromOpp,
  estimationInputMissing,
  systemSizeKw,
} from "@/constants/estimationInput";
import { leadTypeLabel } from "@/features/leads/leadSourceOptions";
import {
  electricalPhaseLabel,
  roofTypeLabel,
  serviceRequirementLabel,
  storeyLabel,
} from "@/features/leads/propertyOptions";
import { joinAddress } from "@/utils/text";
import { useAppDispatch } from "@/store";
import { submitEstimationInput } from "@/slices/leadsSlice";
import { useNotifications } from "@/hooks/useNotifications";

const errText = (err, fallback) => (typeof err === "string" ? err : err?.message || fallback);
const MISSING = "Not captured on the lead";

/** One numbered item of the section, with its owner shown. */
function InputItem({ index, title, owner, icon, children }) {
  return (
    <div className="estimation-item">
      <div className="estimation-item-head">
        <SectionHead icon={icon} title={`${index}. ${title}`} />
        <Badge tone={owner === OWNERS.sales ? "info" : "neutral"}>{owner}</Badge>
      </div>
      {children}
    </div>
  );
}

function LeadFact({ label, value }) {
  const missing = !String(value ?? "").trim();
  return (
    <div className="list-row">
      <span className="row-title">{label}</span>
      <span className="row-meta" style={{ textAlign: "right" }}>
        {missing ? MISSING : value}
      </span>
    </div>
  );
}

export default function EstimationInput({ opp, canEdit, drawings = [], onUploadDrawings, uploadingDrawings = false }) {
  const dispatch = useAppDispatch();
  const { notify, error: notifyError } = useNotifications();
  const [input, setInput] = useState(() => estimationInputFromOpp(opp));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setInput(estimationInputFromOpp(opp));
  }, [opp]);

  const set = (field, value) => setInput((i) => ({ ...i, [field]: value }));
  const togglePermit = (key) =>
    set("permits", input.permits.includes(key) ? input.permits.filter((k) => k !== key) : [...input.permits, key]);

  const missing = useMemo(
    () => estimationInputMissing(input, { drawingsCount: drawings.length }),
    [input, drawings.length],
  );
  const sizeKw = systemSizeKw(input);
  const retrofit = input.isRetrofit === "yes";

  const save = async (patch = {}) => {
    const body = { ...input, ...patch };
    setSaving(true);
    try {
      await dispatch(submitEstimationInput({ id: opp.id, body: { input: body } })).unwrap();
      setInput(body);
      notify("Estimation input saved");
    } catch (err) {
      notifyError(errText(err, "Could not save the estimation input."));
    } finally {
      setSaving(false);
    }
  };

  const leadName = [opp.customerFirstName, opp.customerLastName].filter(Boolean).join(" ") || opp.customerLegalName;
  const siteAddress = joinAddress(
    opp.siteLine1,
    `${opp.siteSuburb || ""} ${opp.siteState || ""} ${opp.sitePostcode || ""}`.trim(),
  );

  const text = (field, props = {}) => (
    <textarea
      rows={3}
      value={input[field]}
      disabled={!canEdit}
      onChange={(e) => set(field, e.target.value)}
      {...props}
    />
  );
  const line = (field, props = {}) => (
    <input type="text" value={input[field]} disabled={!canEdit} onChange={(e) => set(field, e.target.value)} {...props} />
  );
  const select = (field, options, placeholder) => (
    <select value={input[field]} disabled={!canEdit} onChange={(e) => set(field, e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.key} value={o.key}>
          {o.label}
        </option>
      ))}
    </select>
  );

  return (
    <div className="section">
      <SectionHead icon={<ClipboardCheck size={13} />} title="Estimation input" />
      <p className="lede" style={{ marginBottom: 16 }}>
        Everything needed before BOQ preparation can start. Each item shows who owns it.
      </p>

      <InputItem index={1} title="Lead & qualification review" owner={OWNERS.estimator} icon={<ClipboardCheck size={13} />}>
        <p className="lede" style={{ marginBottom: 10 }}>
          What sales captured on the lead. Check it is complete and correct before estimating.
        </p>
        <div className="list-stack">
          <LeadFact label="Customer" value={leadName} />
          <LeadFact label="Type of lead" value={opp.leadType ? leadTypeLabel(opp.leadType) : ""} />
          <LeadFact label="Phone" value={opp.customerPhone} />
          <LeadFact label="Email" value={opp.customerEmail} />
          <LeadFact label="Installation address" value={siteAddress} />
          <LeadFact
            label="Service requirement"
            value={opp.serviceRequirement ? serviceRequirementLabel(opp.serviceRequirement) : ""}
          />
          <LeadFact label="House type" value={opp.propertyStoreys ? storeyLabel(opp.propertyStoreys) : ""} />
          <LeadFact label="Roof type" value={opp.roofType ? roofTypeLabel(opp.roofType) : ""} />
          <LeadFact
            label="Electrical phase"
            value={opp.electricalPhase ? electricalPhaseLabel(opp.electricalPhase) : ""}
          />
        </div>
        <label className="check" style={{ marginTop: 12 }}>
          <input
            type="checkbox"
            checked={input.leadReviewConfirmed}
            disabled={!canEdit}
            onChange={(e) => set("leadReviewConfirmed", e.target.checked)}
          />
          The minimum information needed to begin estimation is complete
        </label>
        <Field label="Anything still needed from sales" hint="optional">
          {text("leadReviewNotes", { rows: 2 })}
        </Field>
      </InputItem>

      <InputItem index={2} title="Customer scope & requirements" owner={OWNERS.sales} icon={<ScrollText size={13} />}>
        <Field hint="what the customer asked for, in their words">
          {text("customerScope", { placeholder: "Scope and requirements as discussed with the customer" })}
        </Field>
      </InputItem>

      <InputItem index={3} title="Site & existing electrical" owner={OWNERS.estimator} icon={<Plug size={13} />}>
        <div className="form-grid">
          <Field label="Site type">{select("siteType", SITE_TYPES, "Select site type")}</Field>
          <Field label="Switchboard / DB">
            {select("switchboardCondition", SWITCHBOARD_CONDITIONS, "Select condition")}
          </Field>
          <Field label="Switchboard / DB location" className="span-2">
            {line("switchboardLocation", { placeholder: "e.g. garage wall, external meter box" })}
          </Field>
          <Field label="Existing electrical system" className="span-2" hint="mains, cabling, metering, known issues">
            {text("existingElectrical", { rows: 2 })}
          </Field>
        </div>
      </InputItem>

      <InputItem index={4} title="Existing solar, inverter & battery" owner={OWNERS.estimator} icon={<Sun size={13} />}>
        <Field label="Is this a retrofit to an existing system?">
          <select value={input.isRetrofit} disabled={!canEdit} onChange={(e) => set("isRetrofit", e.target.value)}>
            <option value="">Select</option>
            <option value="yes">Yes — existing system on site</option>
            <option value="no">No — new installation</option>
          </select>
        </Field>
        {retrofit ? (
          <div className="form-grid" style={{ marginTop: 12 }}>
            <Field label="Existing solar (kW)">
              <NumberInput
                value={input.existingSolarKw}
                min={0}
                step="0.1"
                disabled={!canEdit}
                onChange={(v) => set("existingSolarKw", v)}
              />
            </Field>
            <Field label="Existing inverter">{line("existingInverter", { placeholder: "Brand and model" })}</Field>
            <Field label="Existing battery">{line("existingBattery", { placeholder: "Brand, model and kWh" })}</Field>
            <Field label="Notes" className="span-2" hint="age, condition, warranty, what stays">
              {text("existingSystemNotes", { rows: 2 })}
            </Field>
          </div>
        ) : null}
      </InputItem>

      <InputItem index={5} title="New system specification" owner={OWNERS.estimator} icon={<BatteryCharging size={13} />}>
        <div className="form-grid">
          <Field label="Panel quantity">
            <NumberInput value={input.panelQty} min={0} disabled={!canEdit} onChange={(v) => set("panelQty", v)} />
          </Field>
          <Field label="Panel capacity (W)" hint={sizeKw ? `System size ${sizeKw.toFixed(2)} kW` : "per panel"}>
            <NumberInput
              value={input.panelCapacityW}
              min={0}
              disabled={!canEdit}
              onChange={(v) => set("panelCapacityW", v)}
            />
          </Field>
          <Field label="Panel brand & model" className="span-2">{line("panelBrandModel")}</Field>
          <Field label="Inverter brand & model" className="span-2">{line("inverterBrandModel")}</Field>
          <Field label="Battery brand & model">{line("batteryBrandModel", { placeholder: "If applicable" })}</Field>
          <Field label="Battery capacity (kWh)">
            <NumberInput
              value={input.batteryCapacityKwh}
              min={0}
              step="0.1"
              disabled={!canEdit}
              onChange={(v) => set("batteryCapacityKwh", v)}
            />
          </Field>
          <Field label="Backup requirement">{select("backupRequirement", BACKUP_OPTIONS, "Select backup")}</Field>
          <Field label="Backup notes" hint="circuits to keep live">{line("backupNotes")}</Field>
        </div>
      </InputItem>

      <InputItem index={6} title="Site constraints & install requirements" owner={OWNERS.estimator} icon={<TriangleAlert size={13} />}>
        <Field hint="mounting or roof structure, shading or orientation, switchboard upgrade, cabling">
          {text("siteConstraints", { placeholder: "Anything that changes how the system is installed or priced" })}
        </Field>
      </InputItem>

      <InputItem index={7} title="Permits, approvals & VPP" owner={OWNERS.estimator} icon={<ListChecks size={13} />}>
        <div className="choice-grid">
          {PERMIT_OPTIONS.map((permit) => (
            <label key={permit.key} className="choice">
              <input
                type="checkbox"
                checked={input.permits.includes(permit.key)}
                disabled={!canEdit}
                onChange={() => togglePermit(permit.key)}
              />
              <span>{permit.label}</span>
            </label>
          ))}
        </div>
        <div className="form-grid" style={{ marginTop: 12 }}>
          <Field label="VPP eligibility">{select("vppEligibility", VPP_OPTIONS, "Select eligibility")}</Field>
          <Field label="Permit / approval notes">{line("permitNotes")}</Field>
        </div>
      </InputItem>

      <InputItem index={8} title="Utility, meter & drawings" owner={OWNERS.estimator} icon={<Gauge size={13} />}>
        <Field label="Utility or meter requirements" hint="NMI, meter change, network limits">
          {line("meterRequirements")}
        </Field>
        <Field label="Drawings & layouts" className="span-2" hint="single line diagrams, roof layouts, site plans">
          {onUploadDrawings ? (
            <FileDropzone
              files={drawings}
              onSelect={onUploadDrawings}
              disabled={!canEdit}
              uploading={uploadingDrawings}
            />
          ) : (
            <p className="dropzone-empty" style={{ margin: 0 }}>
              Uploads are unavailable here.
            </p>
          )}
        </Field>
        <Field label="Drawing notes" hint="optional">{line("drawingsNotes")}</Field>
      </InputItem>

      <InputItem index={9} title="Inclusions & exclusions" owner={OWNERS.estimator} icon={<FileStack size={13} />}>
        <div className="form-grid">
          <Field label="Inclusions" hint="what the price covers">{text("inclusions")}</Field>
          <Field label="Exclusions" hint="what it does not cover">{text("exclusions")}</Field>
        </div>
      </InputItem>

      <InputItem index={10} title="Ready for BOQ preparation" owner={OWNERS.estimator} icon={<ClipboardCheck size={13} />}>
        {missing.length ? (
          <Alert tone="info">
            Still needed before this can be confirmed: {missing.join(", ")}.
          </Alert>
        ) : null}
        <label className="check">
          <input
            type="checkbox"
            checked={input.readyForBoq}
            disabled={!canEdit || missing.length > 0}
            onChange={(e) => set("readyForBoq", e.target.checked)}
          />
          All required information, including pre-site inspection findings where applicable, is available to begin BOQ
          preparation
        </label>
      </InputItem>

      {canEdit ? (
        <button type="button" className="btn btn-primary btn-sm" disabled={saving} onClick={() => save()}>
          {saving ? "Saving…" : "Save estimation input"}
        </button>
      ) : (
        <p className="lede">You have read access to this record. Editing needs the “Update Estimation” permission.</p>
      )}
    </div>
  );
}
