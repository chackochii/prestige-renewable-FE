// Stage stepper for an opportunity. Stages the unit does not run are shown
// dimmed; stages at or before the current one can be opened for review. A stage
// the viewer's role does not cover is shown locked and cannot be opened —
// `viewableStageIds` comes from helpers/stageAccess, and the API refuses its
// work endpoints regardless.

import { Check, Lock } from "lucide-react";
import { STAGES } from "@/constants/stages";

export default function StageStepper({ stage, viewStage, enabledStageIds, viewableStageIds, onSelect }) {
  const current = Number(stage) || 1;
  const viewing = Number(viewStage) || current;
  const enabled = enabledStageIds?.length ? enabledStageIds.map(Number) : STAGES.map((s) => s.id);
  const viewable = viewableStageIds?.length ? viewableStageIds.map(Number) : null;

  return (
    <div className="stepper" aria-label="Opportunity stages">
      {STAGES.map((s, index) => {
        const runs = enabled.includes(s.id);
        const allowed = viewable === null || viewable.includes(s.id);
        const reachable = runs && allowed && s.id <= current;
        const classes = [
          "step",
          s.id < current && runs ? "done" : "",
          s.id === current ? "current" : "",
          viewing === s.id && s.id !== current ? "viewing" : "",
          reachable ? "clickable" : "",
          runs ? "" : "skipped",
          allowed ? "" : "locked",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={s.id}
            type="button"
            className={classes}
            disabled={!reachable}
            onClick={() => reachable && onSelect?.(s.id)}
            aria-current={viewing === s.id ? "step" : undefined}
            title={
              !allowed
                ? `${s.label} (worked by another team)`
                : runs
                  ? s.label
                  : `${s.label} (not run by this unit)`
            }
          >
            <div className="step-dot">
              {!allowed ? (
                <Lock size={12} strokeWidth={2.5} />
              ) : s.id < current && runs ? (
                <Check size={13} strokeWidth={3} />
              ) : (
                index + 1
              )}
            </div>
            <div className="step-label">{s.short}</div>
          </button>
        );
      })}
    </div>
  );
}
