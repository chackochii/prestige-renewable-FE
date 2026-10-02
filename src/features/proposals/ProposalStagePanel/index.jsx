// Stage 3 on an opportunity: the same proposal workflow the proposals page
// shows — send the customer their proposal and see their answer — with the
// cross-department requests on their own tab, as the estimation panel has
// them. An acceptance moves the job on (and a re-quote moves it back), so the
// record is reloaded when that happens.

import { useState } from "react";
import { HandHelping, Send } from "lucide-react";
import Tabs from "@/components/Tabs";
import ProposalWorkflow from "@/features/proposals/ProposalWorkflow";
import StageRequestsPanel from "@/features/collaboration/StageRequestsPanel";
import { stageById } from "@/constants/stages";
import { PROPOSAL_STAGE_ID } from "@/helpers/proposals";

export default function ProposalStagePanel({ opp, unit, canEdit = false, onMoved }) {
  const stage = stageById(PROPOSAL_STAGE_ID);
  const [tab, setTab] = useState("proposal");

  return (
    <div className="card card-pad">
      <div className="card-head">
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="card-icon">
            <Send size={16} />
          </span>
          <h2>{stage.label}</h2>
        </div>
      </div>
      <p className="sub">{stage.description}</p>

      <Tabs
        value={tab}
        onChange={setTab}
        items={[
          { key: "proposal", label: "Proposal", icon: <Send size={14} /> },
          { key: "requests", label: "Request / Response", icon: <HandHelping size={14} /> },
        ]}
      />

      {tab === "proposal" ? (
        <ProposalWorkflow
          opportunity={opp}
          canEdit={canEdit}
          embedded
          onChanged={(result) => {
            if (result?.opportunity && Number(result.opportunity.stage) !== Number(opp.stage)) onMoved?.();
          }}
        />
      ) : (
        <StageRequestsPanel opp={opp} stage={stage.id} unit={unit} canEdit={canEdit} />
      )}
    </div>
  );
}
