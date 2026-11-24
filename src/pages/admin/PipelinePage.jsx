// Jobs Board: every job from Procurement onwards. Leads to Approvals are on
// the Lead Board (LeadsPage); both are the same StageBoard.

import StageBoard from "@/features/pipeline/StageBoard";
import { LEAD_BOARD_LAST_STAGE } from "@/constants/stages";

export default function PipelinePage() {
  return <StageBoard title="Jobs Board" minStage={LEAD_BOARD_LAST_STAGE + 1} />;
}
