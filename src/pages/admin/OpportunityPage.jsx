// Opportunity detail: hero, stage stepper, stage work and history.

import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Clock, FileStack } from "lucide-react";
import Badge from "@/components/Badge";
import Alert from "@/components/Alert";
import Tabs from "@/components/Tabs";
import Modal from "@/components/Modal";
import LoadingState from "@/components/LoadingState";
import EmptyState from "@/components/EmptyState";
import StageStepper from "@/components/StageStepper";
import HistoryTab from "@/components/HistoryTab";
import { oppTitle } from "@/helpers/opportunity";
import LeadPackPanel from "@/features/leads/LeadPackPanel";
import StagePanel from "@/features/pipeline/StagePanel";
import LifecycleModal from "@/features/pipeline/LifecycleModal";
import { lifecycleMeta, nextStageFor, stageById } from "@/constants/stages";
import { PERMISSIONS } from "@/constants/permissions";
import { advanceState } from "@/helpers/stageTransition";
import { slaStatus } from "@/helpers/dateTimeHelpers";
import { formatCurrency } from "@/utils/formatCurrency";
import { joinAddress } from "@/utils/text";
import { useAppDispatch, useAppSelector } from "@/store";
import { advanceStage, clearSelected, deleteLead, fetchOpportunity, updateLead } from "@/slices/leadsSlice";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { useNotifications } from "@/hooks/useNotifications";

export default function OpportunityPage() {
  const { id } = useParams();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const { unit, units, switchUnit } = useBusinessUnit();
  const { notify } = useNotifications();
  const { selected: opp, selectedStatus, selectedError } = useAppSelector((s) => s.leads);
  const [tab, setTab] = useState("work");
  const [viewStage, setViewStage] = useState(null);
  const [advanceError, setAdvanceError] = useState("");
  const [advancing, setAdvancing] = useState(false);
  const [lifecycleOpen, setLifecycleOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    dispatch(fetchOpportunity(id));
    setViewStage(null);
    setTab("work");
    setAdvanceError("");
    return () => {
      dispatch(clearSelected());
    };
  }, [id, dispatch]);

  // The record belongs to a unit the person can work in but is not currently
  // in — switch the workspace so lists and pickers line up.
  useEffect(() => {
    if (opp && unit && opp.businessUnitId !== unit.id && units.some((u) => u.id === opp.businessUnitId))
      switchUnit(opp.businessUnitId);
  }, [opp, unit, units, switchUnit]);

  if (selectedStatus === "loading" || (selectedStatus === "idle" && !opp)) return <LoadingState label="Loading record…" />;

  if (!opp) {
    return (
      <div className="card card-pad">
        <EmptyState
          title="Opportunity not found"
          body={selectedError || "It may belong to another business unit, or you may not have access."}
          action={
            <Link to="/pipeline" className="btn btn-primary">
              Back to pipeline
            </Link>
          }
        />
      </div>
    );
  }

  const canEdit = hasPermission(PERMISSIONS.LEADS_UPDATE);
  const canDelete = hasPermission(PERMISSIONS.LEADS_DELETE) && Number(opp.stage) === 1;
  const current = Number(opp.stage);
  const viewing = viewStage ?? current;
  const stage = stageById(current);
  const next = nextStageFor(current, unit);
  const gate = advanceState(opp);
  const sla = slaStatus(opp.slaDueAt);
  const life = lifecycleMeta(opp.lifecycle);
  const value = Number(opp.acceptedValue) || Number(opp.estimatedValue) || 0;
  const timeZone = unit?.timezone;

  const advance = async () => {
    setAdvancing(true);
    setAdvanceError("");
    try {
      const updated = await dispatch(advanceStage(opp.id)).unwrap();
      setViewStage(null);
      notify(`Moved to ${stageById(updated.stage).label}`);
    } catch (err) {
      setAdvanceError(typeof err === "string" ? err : err?.message || "Could not advance the record.");
    } finally {
      setAdvancing(false);
    }
  };

  const saveLifecycle = async ({ lifecycle, notes }) => {
    await dispatch(updateLead({ id: opp.id, body: { lifecycle, notes } })).unwrap();
    notify(`Status set to ${lifecycleMeta(lifecycle).label}`);
  };

  const remove = async () => {
    try {
      await dispatch(deleteLead(opp.id)).unwrap();
      notify("Lead deleted", "info");
      navigate("/leads");
    } catch (err) {
      notify(typeof err === "string" ? err : err?.message || "Could not delete the lead.", "danger");
      setDeleteOpen(false);
    }
  };

  return (
    <>
      <Link to={current === 1 ? "/leads" : "/pipeline"} className="btn btn-ghost btn-sm" style={{ marginBottom: 16 }}>
        {current === 1 ? "Leads" : "Pipeline"}
      </Link>

      <div className="opp-hero">
        <div>
          <div className="kicker">{opp.number}</div>
          <h1>{oppTitle(opp)}</h1>
          <div className="meta-row">
            <span>{joinAddress(opp.siteLine1, `${opp.siteSuburb || ""} ${opp.siteState || ""} ${opp.sitePostcode || ""}`.trim()) || "No site yet"}</span>
            <span>{formatCurrency(value)}</span>
            <Badge tone={life.tone}>{life.label}</Badge>
            <Badge tone={sla.tone}>{sla.label}</Badge>
            {opp.variationPending ? <Badge tone="warning">Variation pending</Badge> : null}
            {opp.referrer?.organisation ? <Badge tone="neutral">Referred by {opp.referrer.organisation}</Badge> : null}
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "flex-end" }}>
          {canEdit ? (
            <button type="button" className="btn btn-ghost" onClick={() => setLifecycleOpen(true)}>
              {opp.lifecycle === "Active" ? "Mark won / lost" : "Change status"}
            </button>
          ) : null}
          {canDelete ? (
            <button type="button" className="btn btn-danger" onClick={() => setDeleteOpen(true)}>
              Delete
            </button>
          ) : null}
          {canEdit && next !== null && opp.lifecycle === "Active" ? (
            <button
              type="button"
              className="btn btn-primary"
              onClick={advance}
              disabled={!gate.canAdvance || advancing}
              title={gate.canAdvance ? undefined : gate.missing.join(", ")}
            >
              {advancing ? "Moving…" : `Advance to ${stageById(next).short}`} <ArrowRight size={16} />
            </button>
          ) : null}
        </div>
      </div>

      <StageStepper
        stage={current}
        viewStage={viewing}
        enabledStageIds={unit?.enabledStages}
        onSelect={(s) => {
          setTab("work");
          setViewStage(s);
        }}
      />

      {viewing !== current ? (
        <Alert tone="info" style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
          <span>
            Viewing {stageById(viewing).label}. Current stage is {stage.label}.
          </span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => setViewStage(null)}>
            Back to current stage
          </button>
        </Alert>
      ) : null}

      {advanceError ? <Alert tone="warning">{advanceError}</Alert> : null}
      {!gate.canAdvance && opp.lifecycle === "Active" && next !== null && !advanceError ? (
        <Alert tone="info">
          To leave {stage.label}: {gate.missing.join(" · ")}
        </Alert>
      ) : null}

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: "work", label: "Stage work", icon: <FileStack size={14} /> },
          { key: "history", label: "History", icon: <Clock size={14} /> },
        ]}
      />

      {tab === "work" ? (
        <div className="panel">
          {viewing === 1 ? (
            <LeadPackPanel key={opp.id} opp={opp} unit={unit} canEdit={canEdit} />
          ) : (
            <StagePanel stageId={viewing} opp={opp} unit={unit} />
          )}
        </div>
      ) : (
        <HistoryTab opp={opp} timeZone={timeZone} />
      )}

      {lifecycleOpen ? <LifecycleModal opp={opp} onClose={() => setLifecycleOpen(false)} onSave={saveLifecycle} /> : null}

      {deleteOpen ? (
        <Modal
          title="Delete lead"
          body={`Remove ${oppTitle(opp)} (${opp.number})? Only records still at lead capture can be deleted.`}
          onClose={() => setDeleteOpen(false)}
          actions={
            <>
              <button type="button" className="btn btn-ghost" onClick={() => setDeleteOpen(false)}>
                Cancel
              </button>
              <button type="button" className="btn btn-danger" onClick={remove}>
                Delete
              </button>
            </>
          }
        />
      ) : null}
    </>
  );
}
