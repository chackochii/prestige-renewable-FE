// The admin team behind procurement and delivery, as the process chart names
// them: who coordinates, who buys and schedules, who handles Green Deal.
// Other stages pass their own team, title and subtitle.

import { Users } from "lucide-react";
import Card from "@/components/Card";
import { ADMIN_TEAM } from "@/lib/mockData/procurement";
import { initials } from "@/utils/text";

export default function ProcurementTeam({ team = ADMIN_TEAM, title = "Admin team", sub = "Who runs this stage day to day." }) {
  return (
    <Card title={title} icon={<Users size={16} />} sub={sub}>
      <div className="list-stack">
        {team.map((member) => (
          <div className="list-row" key={member.name}>
            <div style={{ display: "flex", gap: 12, alignItems: "flex-start", minWidth: 0 }}>
              <span className="avatar" aria-hidden="true">
                {initials(member.name)}
              </span>
              <div style={{ minWidth: 0 }}>
                <div className="row-title">{member.name}</div>
                <div className="row-meta">{member.title}</div>
                <div className="row-meta" style={{ marginTop: 4, whiteSpace: "normal" }}>
                  {member.duties.join(" · ")}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
