// Opportunity detail: hero, stage stepper, stage work and history.

import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, Clock, FileStack, Send } from "lucide-react";
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
import EstimationPanel from "@/features/pipeline/EstimationPanel";
import StagePanel from "@/features/pipeline/StagePanel";
import ProcurementStagePanel from "@/features/procurement/ProcurementStagePanel";
import ApprovalsStagePanel from "@/features/approvals/ApprovalsStagePanel";
import { APPROVALS_STAGE } from "@/constants/approvals";
import ProposalStagePanel from "@/features/proposals/ProposalStagePanel";
import { PROPOSAL_STAGE_ID } from "@/helpers/proposals";
import { PROCUREMENT_STAGE } from "@/lib/mockData/procurement";
import { enabledStagesFor, lifecycleMeta, nextStageFor, stageById } from "@/constants/stages";
import { PERMISSIONS } from "@/constants/permissions";
import { canAdvanceFrom, stageHiddenReason, viewableStages } from "@/helpers/stageAccess";
import { advanceState } from "@/helpers/stageTransition";
import { slaStatus } from "@/helpers/dateTimeHelpers";
import { formatCurrency } from "@/utils/formatCurrency";
import { joinAddress } from "@/utils/text";
import { useAppDispatch, useAppSelector } from "@/store";
import { advanceStage, clearSelected, deleteLead, fetchOpportunity, fetchOpportunityQuote } from "@/slices/leadsSlice";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { useNotifications } from "@/hooks/useNotifications";

export default function OpportunityPage() {
  const { id } = useParams();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { user, hasPermission, isSuperAdmin } = useAuth();
  const { unit, units, switchUnit } = useBusinessUnit();
  const { notify } = useNotifications();
  const { selected: opp, selectedStatus, selectedError, quote } = useAppSelector((s) => s.leads);
  const [tab, setTab] = useState("work");
  const [viewStage, setViewStage] = useState(null);
  const [advanceError, setAdvanceError] = useState("");
  const [advancing, setAdvancing] = useState(false);
  // Bumped by the header's "Send to Proposal" to open estimation's hand-over step.
  const [handoverAsk, setHandoverAsk] = useState(0);
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    dispatch(fetchOpportunity(id));
    dispatch(fetchOpportunityQuote(id));
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

  // Depends only on the person and the unit, so it belongs with the other
  // hooks — the early returns below mean anything after them runs on some
  // renders and not others.
  const viewableStageIds = useMemo(
    () => viewableStages(user, enabledStagesFor(unit)).map((s) => s.id),
    [user, unit],
  );

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
  const canEditEstimation = hasPermission(PERMISSIONS.ESTIMATION_UPDATE);
  const canDelete = isSuperAdmin && Number(opp.stage) === 1;
  const current = Number(opp.stage);
  const viewing = viewStage ?? current;
  const stage = stageById(current);
  const next = nextStageFor(current, unit);
  const gate = advanceState(opp, { quote, user });
  const stageHidden = stageHiddenReason(user, viewing);
  const sla = slaStatus(opp.slaDueAt);
  const life = lifecycleMeta(opp.lifecycle);
  const value = Number(opp.acceptedValue) || Number(opp.estimatedValue) || 0;
  const timeZone = unit?.timezone;

  // Leaving estimation is a hand-over, not a bare stage move: the header
  // button opens estimation's "Send to proposal" step, which saves the quote
  // version and takes a note to sales.
  const openHandover = () => {
    setTab("work");
    setViewStage(null);
    setHandoverAsk((n) => n + 1);
    requestAnimationFrame(() => document.querySelector(".tabs [role='tab'][aria-selected='true']")?.scrollIntoView({ behavior: "smooth", block: "center" }));
  };

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
        <div className="opp-hero-actions">
          {canDelete ? (
            <button type="button" className="btn btn-danger" onClick={() => setDeleteOpen(true)}>
              Delete
            </button>
          ) : null}
          {canAdvanceFrom(user, current) && next !== null && opp.lifecycle === "Active" ? (
            current === 2 ? (
              <button type="button" className="btn btn-primary" onClick={openHandover}>
                <Send size={16} /> Send to {stageById(next).short} <ArrowRight size={16} />
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary"
                onClick={advance}
                disabled={!gate.canAdvance || advancing}
                title={gate.canAdvance ? undefined : gate.missing.join(", ")}
              >
                {advancing ? "Moving…" : `Proceed to ${stageById(next).short}`} <ArrowRight size={16} />
              </button>
            )
          ) : null}
        </div>
      </div>

      <StageStepper
        stage={current}
        viewStage={viewing}
        enabledStageIds={unit?.enabledStages}
        viewableStageIds={viewableStageIds}
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
      {/* The lead panel says this in its own words, against its own checklist,
          so saying it twice here is noise. The Advance button still carries
          the detail in its tooltip at every stage. */}
      {!gate.canAdvance && viewing !== 1 && opp.lifecycle === "Active" && next !== null && !advanceError ? (
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
          {stageHidden ? (
            // The record stays reachable — it may well be this person's deal —
            // but the stage another team is working is not theirs to read.
            <div className="card card-pad">
              <EmptyState
                title={`${stageById(viewing).label} is not visible to your role`}
                body={stageHidden}
              />
            </div>
          ) : viewing === 1 ? (
            <LeadPackPanel key={opp.id} opp={opp} unit={unit} canEdit={canEdit} />
          ) : viewing === 2 ? (
            <EstimationPanel key={opp.id} opp={opp} unit={unit} canEdit={canEditEstimation} onViewLead={() => setViewStage(1)} focusHandover={handoverAsk} onSent={() => setViewStage(null)} />
          ) : viewing === PROPOSAL_STAGE_ID ? (
            <ProposalStagePanel key={opp.id} opp={opp} unit={unit} canEdit={canEdit} onMoved={() => dispatch(fetchOpportunity(opp.id))} />
          ) : viewing === APPROVALS_STAGE.id ? (
            <ApprovalsStagePanel key={opp.id} opp={opp} unit={unit} canEdit={canEdit} />
          ) : viewing === PROCUREMENT_STAGE.id ? (
            <ProcurementStagePanel key={opp.id} opp={opp} unit={unit} canEdit={canEdit} />
          ) : (
            <StagePanel stageId={viewing} opp={opp} unit={unit} canEdit={canEdit} />
          )}
        </div>
      ) : (
        <HistoryTab opp={opp} timeZone={timeZone} canEdit={canEdit} />
      )}


      {deleteOpen ? (
        <Modal
          title="Delete lead"
          confirmClose={false}
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
