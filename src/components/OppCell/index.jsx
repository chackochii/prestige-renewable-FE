// Opportunity table cell: avatar, customer name, number and site.

import Avatar from "@/components/Avatar";
import { oppSite, oppTitle } from "@/helpers/opportunity";

export default function OppCell({ opp }) {
  const name = oppTitle(opp);
  const site = oppSite(opp);
  return (
    <div className="cell-with-avatar">
      <Avatar name={name} />
      <div>
        <div className="row-title">{name}</div>
        <div className="row-meta">
          {opp?.number}
          {site ? ` · ${site}` : ""}
        </div>
      </div>
    </div>
  );
}
