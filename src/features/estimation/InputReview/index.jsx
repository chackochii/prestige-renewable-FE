// Estimation input review / acceptance.
//
// The estimator does not re-enter what sales captured — the Lead → Estimation
// Input Checklist arrives filled in (constants/estimationInput.js) and this
// screen is where it is read, then either accepted or sent back.
//
// Accepting is the estimation-side gate: it confirms everything needed to
// start BOQ preparation is here.

import { useMemo, useState } from "react";
import { Check, Paperclip, Undo2 } from "lucide-react";
import Alert from "@/components/Alert";
import Badge from "@/components/Badge";
import Field from "@/components/Field";
import SectionHead from "@/components/SectionHead";
import {
  BACKUP_OPTIONS,
  ESTIMATOR_ACCEPTANCE,
  PERMIT_OPTIONS,
  SITE_TYPES,
  SWITCHBOARD_CONDITIONS,
  VPP_OPTIONS,
  estimationInputFromOpp,
  estimationInputMissing,
  systemSizeKw,
} from "@/constants/estimationInput";
import { electricalPhaseLabel, roofTypeLabel, serviceRequirementLabel, storeyLabel } from "@/features/leads/propertyOptions";
import { formatDate } from "@/helpers/dateTimeHelpers";
import { joinAddress } from "@/utils/text";
import { useNotifications } from "@/hooks/useNotifications";
import { useUnitUsers } from "@/hooks/useUnitUsers";
import { useAppDispatch } from "@/store";
import { acceptEstimationInputs, notifySalesManager, submitEstimationRequirements } from "@/slices/leadsSlice";

const errText = (err, fallback) => (typeof err === "string" ? err : err?.message || fallback);
const optionLabel = (options, key) => options.find((o) => o.key === key)?.label || "";

function Row({ label, value }) {
  const empty = !String(value ?? "").trim();
  return (
    <div className="rr-row">
      <span className="rr-label">{label}</span>
      <span className={`rr-value${empty ? " is-missing" : ""}`}>{empty ? "Not supplied" : value}</span>
    </div>
  );
}

function Group({ title, children }) {
  return (
    <div className="rr-block">
      <h4>{title}</h4>
      {children}
    </div>
  );
}

export default function InputReview({ opp, canEdit = false, drawings = [], sitePhotos = [], onViewLead }) {
  const dispatch = useAppDispatch();
  const { notify, error: notifyError } = useNotifications();
  const { userName } = useUnitUsers();
  const [returning, setReturning] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);

  const input = useMemo(() => estimationInputFromOpp(opp), [opp]);
  const missing = useMemo(
    () => estimationInputMissing(input, { drawingsCount: drawings.length, sitePhotoCount: sitePhotos.length }),
    [input, drawings.length, sitePhotos.length],
  );

  const accepted = Boolean(opp.estimationInputsAcceptedAt);
  const onHold = opp.estimationRequirementsReceived === false;
  const sizeKw = systemSizeKw(input);
  const customer = [opp.customerFirstName, opp.customerLastName].filter(Boolean).join(" ") || opp.customerLegalName;

  const accept = async () => {
    setBusy(true);
    try {
      await dispatch(acceptEstimationInputs(opp.id)).unwrap();
      notify("Inputs accepted — BOQ preparation can start");
    } catch (err) {
      notifyError(errText(err, "Could not accept the inputs."));
    } finally {
      setBusy(false);
    }
  };

  const returnToSales = async () => {
    if (!reason.trim()) return;
    setBusy(true);
    try {
      await dispatch(
        submitEstimationRequirements({ id: opp.id, body: { received: false, reason: reason.trim() } }),
      ).unwrap();
      await dispatch(notifySalesManager(opp.id)).unwrap();
      setReturning(false);
      setReason("");
      notify("Returned to sales — sales manager notified", "info");
    } catch (err) {
      notifyError(errText(err, "Could not return the lead to sales."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="section">
      <div className="estimation-item-head">
        <SectionHead icon={<Check size={13} />} title="Estimation input review" />
        <Badge tone={accepted ? "success" : "info"}>{accepted ? "Accepted" : "Awaiting review"}</Badge>
      </div>
      <p className="lede" style={{ marginBottom: 16 }}>
        What sales supplied on the Lead → Estimation Input Checklist. Review it, then accept it or send it back — there
        is nothing to re-enter here.
      </p>

      {onHold ? (
        <Alert tone="warning">Returned to sales and awaiting their update. {opp.estimationOnHoldReason}</Alert>
      ) : null}
      {missing.length ? (
        <Alert tone="danger">
          Missing or insufficient: {missing.join(", ")}.
        </Alert>
      ) : null}
      {input.noteForEstimator ? <Alert tone="info">From sales: {input.noteForEstimator}</Alert> : null}

      <Group title="Customer & site basics">
        <Row label="Customer" value={customer} />
        <Row label="Contact" value={[opp.customerPhone, opp.customerEmail].filter(Boolean).join(" · ")} />
        <Row
          label="Installation address"
          value={joinAddress(opp.siteLine1, `${opp.siteSuburb || ""} ${opp.siteState || ""} ${opp.sitePostcode || ""}`.trim())}
        />
        <Row label="Enquiry scope" value={opp.serviceRequirement ? serviceRequirementLabel(opp.serviceRequirement) : ""} />
        <Row label="House type" value={opp.propertyStoreys ? storeyLabel(opp.propertyStoreys) : ""} />
        <Row label="Roof type" value={opp.roofType ? roofTypeLabel(opp.roofType) : ""} />
        <Row label="Electrical phase" value={opp.electricalPhase ? electricalPhaseLabel(opp.electricalPhase) : ""} />
      </Group>

      <Group title="Pre-site inspection">
        <Row label="Site type" value={optionLabel(SITE_TYPES, input.siteType)} />
        <Row label="Pre-site inspection required" value={input.preSiteInspectionRequired} />
        {input.preSiteInspectionRequired === "yes" ? (
          <>
            <Row label="Site crew" value={input.siteCrewAssigneeId ? userName(input.siteCrewAssigneeId) : ""} />
            <Row label="Site visit completed" value={input.siteVisitCompleted ? "Yes" : "Not yet"} />
            <Row label="Site photos" value={sitePhotos.length ? `${sitePhotos.length} attached` : ""} />
          </>
        ) : null}
        <Row label="Roof / site measurements" value={input.roofMeasurements} />
      </Group>

      <Group title="Technical & electrical specification">
        <Row label="Main switchboard / DB" value={optionLabel(SWITCHBOARD_CONDITIONS, input.switchboardCondition)} />
        <Row label="Switchboard location" value={input.switchboardLocation} />
        <Row label="Switchboard upgrade required" value={input.switchboardUpgrade} />
        <Row label="Existing electrical system" value={input.existingElectrical} />
        <Row label="Electrical load requirements" value={input.loadRequirements} />
      </Group>

      {input.isRetrofit === "yes" ? (
        <Group title="Existing solar, inverter & battery">
          <Row label="Existing solar (kW)" value={input.existingSolarKw} />
          <Row label="Existing inverter" value={input.existingInverter} />
          <Row label="Existing battery" value={input.existingBattery} />
          <Row label="Notes" value={input.existingSystemNotes} />
        </Group>
      ) : (
        <Group title="Existing system">
          <Row label="Retrofit" value={input.isRetrofit === "no" ? "No — new installation" : ""} />
        </Group>
      )}

      <Group title="New system specification">
        <Row
          label="Panels"
          value={
            input.panelQty && input.panelCapacityW
              ? `${input.panelQty} × ${input.panelCapacityW} W${sizeKw ? ` · ${sizeKw.toFixed(2)} kW` : ""}`
              : ""
          }
        />
        <Row label="Preferred brands / models" value={input.preferredBrands} />
        <Row label="Inverter" value={input.inverterBrandModel} />
        <Row label="Battery" value={input.batteryBrandModel} />
        <Row label="Battery capacity (kWh)" value={input.batteryCapacityKwh} />
        <Row label="Backup requirement" value={optionLabel(BACKUP_OPTIONS, input.backupRequirement)} />
        <Row label="Backup duration" value={input.backupDuration} />
      </Group>

      <Group title="Mounting, shading & installation">
        <Row label="Mounting / roof structure" value={input.mountingRequirements} />
        <Row label="Cable, conduit & trunking" value={input.cableRequirements} />
        <Row label="Shading, orientation & constraints" value={input.siteConstraints} />
        <Row label="Special requirements" value={input.specialRequirements} />
      </Group>

      <Group title="Site constraints & compliance">
        <Row
          label="Permits & approvals"
          value={input.permits.map((key) => optionLabel(PERMIT_OPTIONS, key)).filter(Boolean).join(", ")}
        />
        <Row label="VPP discussed with customer" value={input.vppDiscussed ? "Yes" : ""} />
        <Row label="VPP incentive / eligibility" value={optionLabel(VPP_OPTIONS, input.vppEligibility)} />
        <Row label="VPP requirements" value={input.vppNotes} />
        <Row label="Permit notes" value={input.permitNotes} />
        <Row label="Utility / meter requirements" value={input.meterRequirements} />
        <Row
          label="Drawings, layouts & SLD"
          value={
            drawings.length ? (
              drawings.map((file) => (
                <a key={file.id} href={file.url} target="_blank" rel="noreferrer" className="rr-file">
                  <Paperclip size={12} /> {file.filename}
                </a>
              ))
            ) : (
              ""
            )
          }
        />
      </Group>

      <Group title="Customer-specific notes">
        <Row label="Inclusions" value={input.inclusions} />
        <Row label="Exclusions" value={input.exclusions} />
      </Group>

      <div className="decision-card">
        <SectionHead icon={<Check size={13} />} title="Estimator acceptance" />
        {accepted ? (
          <Alert tone="success" style={{ marginBottom: 0 }}>
            Accepted on {formatDate(opp.estimationInputsAcceptedAt, { withTime: true })}
            {opp.estimationInputsAcceptedByName ? ` by ${opp.estimationInputsAcceptedByName}` : ""}. BOQ preparation can
            proceed.
          </Alert>
        ) : (
          <>
            <p className="lede" style={{ marginBottom: 12 }}>
              {ESTIMATOR_ACCEPTANCE}
            </p>
            {returning ? (
              <Field label="What is missing or insufficient?" hint="sent to sales with the notification">
                <textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
              </Field>
            ) : null}
            {canEdit ? (
              <div className="decision-actions" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={accept}
                  disabled={busy || returning}
                  title={missing.length ? "Some inputs are still missing — accept only if you can work without them" : undefined}
                >
                  <Check size={14} /> Accept inputs
                </button>
                {returning ? (
                  <>
                    <button type="button" className="btn btn-danger" onClick={returnToSales} disabled={busy || !reason.trim()}>
                      Send back to sales
                    </button>
                    <button type="button" className="btn btn-ghost" onClick={() => setReturning(false)} disabled={busy}>
                      Cancel
                    </button>
                  </>
                ) : (
                  <button type="button" className="btn btn-ghost" onClick={() => setReturning(true)} disabled={busy}>
                    <Undo2 size={14} /> Return to sales
                  </button>
                )}
                {onViewLead ? (
                  <button type="button" className="btn btn-ghost" onClick={onViewLead}>
                    Open the lead pack
                  </button>
                ) : null}
              </div>
            ) : (
              <p className="lede" style={{ marginBottom: 0 }}>
                Accepting needs the “Update Estimation” permission.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}
