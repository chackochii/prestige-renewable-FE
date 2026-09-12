// "Share the enquiry form" — one public link per business unit, so a lead
// that arrives through a unit's own link is filed straight into that unit.
// Shown to anyone who can create leads; every unit the signed-in person has
// access to is listed, not just the one they are currently working in.

import { Link2 } from "lucide-react";
import Card from "@/components/Card";
import Badge from "@/components/Badge";
import CopyLinkButton from "@/components/CopyLinkButton";
import { enquiryLink } from "@/features/leads/enquiryLink";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";

export default function EnquiryLinkCard({ style }) {
  const { unit: currentUnit, units } = useBusinessUnit();
  const rows = units.length ? units : currentUnit ? [currentUnit] : [];

  return (
    <Card
      title="Share the enquiry form"
      icon={<Link2 size={16} />}
      sub="Anyone with these links can send an enquiry without signing in. The link decides which business unit the lead lands in — the sender never picks, and never sees the list."
      style={style}
    >
      <div className="table-wrap">
        <table className="table stack">
          <thead>
            <tr>
              <th>Goes to</th>
              <th>Link</th>
              <th aria-label="Copy" />
            </tr>
          </thead>
          <tbody>
            {rows.map((u) => {
              const url = enquiryLink(u.code);
              return (
                <tr key={u.id ?? u.code}>
                  <td data-label="Goes to">
                    <strong>{u.name}</strong>{" "}
                    <Badge tone={u.id === currentUnit?.id ? "success" : "neutral"}>{u.code}</Badge>
                  </td>
                  <td data-label="Link">
                    <a href={url} target="_blank" rel="noopener noreferrer" className="enquiry-link">
                      {url}
                    </a>
                  </td>
                  <td data-label="" style={{ textAlign: "right" }}>
                    <CopyLinkButton value={url} toast={`Enquiry link for ${u.name} copied`} />
                  </td>
                </tr>
              );
            })}
            <tr>
              <td data-label="Goes to">
                <strong>Default unit</strong> <Badge tone="neutral">No unit in link</Badge>
                <div className="hint">Set by PUBLIC_LEAD_UNIT_CODE on the server.</div>
              </td>
              <td data-label="Link">
                <a href={enquiryLink()} target="_blank" rel="noopener noreferrer" className="enquiry-link">
                  {enquiryLink()}
                </a>
              </td>
              <td data-label="" style={{ textAlign: "right" }}>
                <CopyLinkButton value={enquiryLink()} toast="General enquiry link copied" />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </Card>
  );
}
