// The chart's "Identified issues & solution" box, as the rules this stage
// follows: what triggers each notification and who it goes to. With a job
// given, the rules that have already fired on it are marked.

import { Workflow } from "lucide-react";
import Badge from "@/components/Badge";
import Card from "@/components/Card";
import { APPROVAL_RULES, APPROVALS_STAGE, INTEGRATIONS } from "@/lib/mockData/approvals";
import { firedRules } from "@/helpers/approvals";

export default function ApprovalRules({ job = null }) {
  const fired = new Set(job ? firedRules(job).map((rule) => rule.key) : []);

  return (
    <Card
      title="How this stage works"
      icon={<Workflow size={16} />}
      sub={`Timeline: same day or +${APPROVALS_STAGE.slaDays} day. These notifications go out on their own.`}
    >
      <div className="list-stack">
        {APPROVAL_RULES.map((rule) => (
          <div className="list-row" key={rule.key}>
            <div style={{ minWidth: 0 }}>
              <div className="row-title">{rule.when}</div>
              <div className="row-meta" style={{ whiteSpace: "normal" }}>
                {rule.then}
              </div>
              <div className="row-meta">Notifies: {rule.notifies}</div>
            </div>
            {job ? fired.has(rule.key) ? <Badge tone="info">Fired</Badge> : <span className="row-meta">—</span> : null}
          </div>
        ))}
        {INTEGRATIONS.map((integration) => (
          <div className="list-row" key={integration.key}>
            <div>
              <div className="row-title">{integration.label} integration</div>
              <div className="row-meta">{integration.status}</div>
            </div>
            <Badge tone="neutral">Planned</Badge>
          </div>
        ))}
      </div>
    </Card>
  );
}
