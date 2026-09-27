// The stage's own steps as a strip, in the same idiom as the pipeline's
// StageStepper: done steps ticked, the current one highlighted, later ones
// dimmed until the job reaches them. The stage that follows sits at the end
// so the flow reads through to where the job goes next.

import { ArrowRight, Check } from "lucide-react";
import { PROCUREMENT_STAGE, PROCUREMENT_STEPS } from "@/lib/mockData/procurement";
import { stepIndex } from "@/helpers/procurement";

export default function WorkflowSteps({ current, viewing, round = 1, onSelect }) {
  const at = stepIndex(current);
  // A revised BOQ has been through matching more than once; the strip says so.
  const labelFor = (step) => (step.key === "matching" && round > 1 ? `${step.short} · R${round}` : step.short);

  return (
    <div className="stepper" aria-label="Procurement steps">
      {PROCUREMENT_STEPS.map((step, index) => {
        const done = index < at;
        const isCurrent = index === at;
        const reachable = index <= at;
        const classes = [
          "step",
          done ? "done" : "",
          isCurrent ? "current" : "",
          viewing === step.key && !isCurrent ? "viewing" : "",
          reachable ? "clickable" : "",
        ]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={step.key}
            type="button"
            className={classes}
            disabled={!reachable}
            onClick={() => reachable && onSelect?.(step.key)}
            aria-current={viewing === step.key ? "step" : undefined}
            title={step.label}
          >
            <div className="step-dot">{done ? <Check size={13} strokeWidth={3} /> : index + 1}</div>
            <div className="step-label">{labelFor(step)}</div>
          </button>
        );
      })}
      <div className={`step ${current === "done" ? "current" : ""}`.trim()} title={`Next stage: ${PROCUREMENT_STAGE.next.label}`}>
        <div className="step-dot">
          <ArrowRight size={13} />
        </div>
        <div className="step-label">{PROCUREMENT_STAGE.next.short}</div>
      </div>
    </div>
  );
}
