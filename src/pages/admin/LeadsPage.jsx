// Lead Board: every record from Leads to Approvals, laid out as the Jobs
// Board is (the same StageBoard: list or board, the same filters). A job
// leaves it for the Jobs Board when it reaches Procurement.

import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Inbox } from "lucide-react";
import CopyLinkButton from "@/components/CopyLinkButton";
import StageBoard from "@/features/pipeline/StageBoard";
import { LEAD_BOARD_LAST_STAGE } from "@/constants/stages";
import { PERMISSIONS } from "@/constants/permissions";
import { enquiryLink } from "@/features/leads/enquiryLink";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { listInboundLeads } from "@/services/api/inboundLeadsApi";

export default function LeadsPage() {
  const { hasPermission } = useAuth();
  const { unit, unitId } = useBusinessUnit();
  // How many ad-platform leads wait in the inbox, for the button. A failure
  // (no leads.read, say) just leaves the count off.
  const [pendingInbox, setPendingInbox] = useState(null);
  useEffect(() => {
    let alive = true;
    if (!unitId) return undefined;
    listInboundLeads({ businessUnitId: unitId, status: "pending", pageSize: 1 })
      .then((result) => alive && setPendingInbox(result.counts?.pending ?? result.total))
      .catch(() => alive && setPendingInbox(null));
    return () => {
      alive = false;
    };
  }, [unitId]);

  const actions = (
    <>
      <Link className="btn btn-ghost" to="/leads/inbox" title="Leads delivered by Meta and Google Ads">
        <Inbox size={16} /> Inbox
        {pendingInbox ? ` (${pendingInbox})` : ""}
      </Link>
      {hasPermission(PERMISSIONS.LEADS_CREATE) ? (
        <>
          {/* Hand this to a customer, a partner or a campaign: it files
              straight into this unit with no sign-in. */}
          <CopyLinkButton
            value={enquiryLink(unit?.code)}
            label="Copy enquiry link"
            copiedLabel="Link copied"
            className="btn btn-ghost"
            toast={unit?.name ? `Enquiry link for ${unit.name} copied` : "Enquiry link copied"}
          />
          <Link className="btn btn-primary" to="/leads/new">
            New lead
          </Link>
        </>
      ) : null}
    </>
  );

  return <StageBoard title="Lead Board" actions={actions} maxStage={LEAD_BOARD_LAST_STAGE} />;
}
