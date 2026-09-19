// "Waiting for" — the handoffs on your jobs that somebody else has to move.
//
// An estimator hands work out constantly: back to sales for missing lead
// details, out to the client for information, to the operations coordinator
// for a site visit. Once it leaves their hands the job is still theirs, but
// the next step isn't — so the dashboard has to say who is holding it and
// what has happened so far, not just that it is "in estimation".
//
// Everything here is derived from fields the opportunity list already
// returns; nothing new is stored and no extra request is made.

import { formatDate, slaStatus } from "@/helpers/dateTimeHelpers";
import { stageById } from "@/constants/stages";
import {
  contextualAction,
  departmentLabel,
  priorityMeta,
  requestCode,
  statusMeta,
} from "@/constants/collaboration";
import { oppTitle } from "@/helpers/opportunity";

/** The teams a job can be sitting with, in the order they are shown. */
export const WAITING_TEAMS = [
  { key: "sales", label: "Sales" },
  { key: "operations", label: "Operations" },
  { key: "approvals", label: "Approvals" },
  { key: "procurement", label: "Procurement" },
];

const PRIORITIES = {
  high: { key: "high", label: "High", tone: "danger" },
  medium: { key: "medium", label: "Medium", tone: "warning" },
  low: { key: "low", label: "Low", tone: "neutral" },
};

const PRIORITY_ORDER = { high: 0, medium: 1, low: 2 };

/** Priority follows the stage SLA: overdue is high, close to due is medium. */
function priorityFor(opp) {
  const tone = slaStatus(opp.slaDueAt).tone;
  if (tone === "danger") return PRIORITIES.high;
  if (tone === "warning") return PRIORITIES.medium;
  return PRIORITIES.low;
}

/** What sales has managed so far when the client owes us information. */
function contactProgress(opp, timeZone) {
  const attempts = Array.isArray(opp.contactAttempts) ? opp.contactAttempts : [];
  if (!attempts.length) return "Client not contacted yet";
  const last = attempts[attempts.length - 1];
  const when = formatDate(last.contactedAt, { timeZone });
  const tally = attempts.length > 1 ? ` · ${attempts.length} attempts` : "";
  return last.reached === false
    ? `Contacted ${when} — not reached${tally}`
    : `Client contacted ${when} — details not received${tally}`;
}

/** Who operations has put on the site visit, and how far that got. */
function siteVisitProgress(opp, userName) {
  if (opp.estimationSiteVisitCompleted === true) return "Site visit completed — findings pending";
  const assignee = opp.estimationSiteVisitAssigneeId ? userName?.(opp.estimationSiteVisitAssigneeId) : null;
  if (assignee) return `Assigned to ${assignee} — visit not completed`;
  const coordinator = opp.operationalCoordinatorId ? userName?.(opp.operationalCoordinatorId) : null;
  if (coordinator) return `${coordinator} is assigning a site team member`;
  return "No operations coordinator assigned yet";
}

/** Every contact attempt sales has logged, newest last, for the detail view. */
function contactTimeline(opp, timeZone) {
  return (Array.isArray(opp.contactAttempts) ? opp.contactAttempts : []).map((a, i) => ({
    id: `attempt-${i}`,
    title: `Attempt ${i + 1} · ${a.method || "Contact"}`,
    detail: `${formatDate(a.contactedAt, { timeZone })}${a.reached === false ? ` — not reached${a.reason ? `: ${a.reason}` : ""}` : " — reached"}`,
    tone: a.reached === false ? "failed" : "done",
  }));
}

const fact = (label, value) => ({ label, value: value || "—" });

/**
 * The handoffs on one job. A job can be waiting on more than one team at
 * once (client information and a site visit, say), so each is its own item.
 *
 * Each item carries the facts behind it, so the dashboard can show the whole
 * picture without sending anyone into the module to hunt for it.
 */
function itemsForOpportunity(opp, { userName, timeZone }) {
  const stage = Number(opp.stage);
  const priority = priorityFor(opp);
  const sla = slaStatus(opp.slaDueAt);
  const commonFacts = [
    fact("Customer", oppTitle(opp)),
    fact("Stage", stageById(stage).label),
    fact("Stage SLA", opp.slaDueAt ? `${formatDate(opp.slaDueAt, { timeZone })} · ${sla.label}` : "No SLA set"),
    fact("Last update", formatDate(opp.updatedAt, { withTime: true, timeZone })),
  ];
  const base = {
    oppId: opp.id,
    number: opp.number,
    customer: oppTitle(opp),
    priority,
    since: opp.updatedAt,
    timeline: [],
  };
  const items = [];

  if (stage === 2 && opp.estimationRequirementsReceived === false) {
    items.push({
      ...base,
      id: `req-${opp.id}`,
      team: "sales",
      title: "Lead details requested",
      detail: opp.estimationOnHoldReason || "Sent back to sales — estimation on hold",
      owner: opp.salespersonId ? userName?.(opp.salespersonId) : null,
      facts: [
        ...commonFacts,
        fact("Salesperson", opp.salespersonId ? userName?.(opp.salespersonId) : "Not assigned"),
        fact("What estimation asked for", opp.estimationOnHoldReason),
        fact("Estimation status", "On hold until sales sends the missing details"),
      ],
    });
  }

  if (stage === 2 && opp.estimationClientInfoNeeded === true) {
    items.push({
      ...base,
      id: `client-${opp.id}`,
      team: "sales",
      title: "Client information requested",
      detail: contactProgress(opp, timeZone),
      owner: opp.salespersonId ? userName?.(opp.salespersonId) : null,
      facts: [
        ...commonFacts,
        fact("Salesperson", opp.salespersonId ? userName?.(opp.salespersonId) : "Not assigned"),
        fact("Client contact", [opp.customerPhone, opp.customerEmail].filter(Boolean).join(" · ")),
        fact("Progress", contactProgress(opp, timeZone)),
      ],
      timeline: contactTimeline(opp, timeZone),
    });
  }

  if (stage === 2 && opp.estimationPreSiteInspectionRequired === true && opp.estimationSiteVisitCompleted !== true) {
    items.push({
      ...base,
      id: `visit-${opp.id}`,
      team: "operations",
      title: "Pre-site inspection",
      detail: siteVisitProgress(opp, userName),
      owner: opp.estimationSiteVisitAssigneeId
        ? userName?.(opp.estimationSiteVisitAssigneeId)
        : opp.operationalCoordinatorId
          ? userName?.(opp.operationalCoordinatorId)
          : null,
      facts: [
        ...commonFacts,
        fact("Operations coordinator", opp.operationalCoordinatorId ? userName?.(opp.operationalCoordinatorId) : "Not assigned"),
        fact("Site team member", opp.estimationSiteVisitAssigneeId ? userName?.(opp.estimationSiteVisitAssigneeId) : "Not assigned"),
        fact("Visit completed", opp.estimationSiteVisitCompleted === true ? "Yes" : "Not yet"),
        fact("Site", [opp.siteSuburb, opp.siteState].filter(Boolean).join(" ")),
      ],
    });
  }

  if (stage === 5) {
    items.push({
      ...base,
      id: `approvals-${opp.id}`,
      team: "approvals",
      title: "Approvals in progress",
      detail: "Waiting on the approvals the job needs before delivery",
      owner: null,
      facts: [...commonFacts, fact("Next step", "Approvals gathered before delivery can start")],
    });
  }

  if (stage === 6) {
    items.push({
      ...base,
      id: `procurement-${opp.id}`,
      team: "procurement",
      title: "With procurement",
      detail: "Purchase orders and delivery dates being confirmed",
      owner: opp.deliveryOwnerId ? userName?.(opp.deliveryOwnerId) : null,
      facts: [
        ...commonFacts,
        fact("Delivery owner", opp.deliveryOwnerId ? userName?.(opp.deliveryOwnerId) : "Not assigned"),
        fact("Next step", "Purchase orders raised and delivery dates confirmed"),
      ],
    });
  }

  return items;
}

/**
 * A raised request or assignment, as a Waiting For entry. These are the real
 * thing — a tracked request with an id, an owner and a status — so they are
 * listed ahead of the handoffs derived from stage fields.
 */
function itemFromRequest(request, user, timeZone) {
  const meta = statusMeta(request.kind, request.status);
  const priority = priorityMeta(request.priority);
  const latest = request.latestUpdate;
  return {
    id: `request-${request.id}`,
    request,
    requestId: requestCode(request),
    oppId: request.opportunityId,
    number: request.opportunityNumber || "—",
    customer: request.opportunityName || "",
    team: request.department,
    title: request.title,
    detail: latest?.note || meta.label,
    owner: request.assigneeName || departmentLabel(request.department),
    priority: { key: request.priority, label: priority.label, tone: priority.tone },
    status: meta,
    since: request.createdAt,
    dueAt: request.dueAt,
    action: contextualAction(request, user),
    facts: [
      { label: "Request", value: `${requestCode(request)} · ${request.title}` },
      { label: "Status", value: meta.label },
      { label: "Assigned to", value: request.assigneeName || departmentLabel(request.department) },
      { label: "Requested", value: formatDate(request.createdAt, { timeZone }) },
      { label: "Due", value: request.dueAt ? formatDate(request.dueAt, { timeZone }) : "No date set" },
      { label: "Latest update", value: latest?.note || "No updates yet" },
    ],
    timeline: [],
  };
}

/**
 * Handoffs across the jobs the viewer owns, grouped by the team holding them:
 * the requests they raised, plus the stage handoffs that have no request
 * behind them yet.
 *
 * `ownedBy` decides whose jobs count — pass the signed-in user's id.
 */
export function waitingForGroups(opportunities = [], { ownedBy, userName, timeZone, requests = [], user } = {}) {
  const mine = opportunities.filter((o) => {
    if (o.lifecycle !== "Active") return false;
    if (!ownedBy) return true;
    return [o.estimatorId, o.leadOwnerId, o.salespersonId, o.deliveryOwnerId].filter(Boolean).includes(ownedBy);
  });

  const openRequests = requests.filter((r) => statusMeta(r.kind, r.status).open);
  const requestItems = openRequests.map((r) => itemFromRequest(r, user, timeZone));
  // A stage handoff that already has a request against it would read twice,
  // so the tracked request wins.
  const covered = new Set(openRequests.map((r) => `${r.opportunityId}-${r.department}`));
  const derived = mine
    .flatMap((o) => itemsForOpportunity(o, { userName, timeZone }))
    .filter((item) => !covered.has(`${item.oppId}-${item.team}`));

  const items = [...requestItems, ...derived];
  items.sort(
    (a, b) => PRIORITY_ORDER[a.priority.key] - PRIORITY_ORDER[b.priority.key] || new Date(a.since) - new Date(b.since),
  );

  // A department the API knows about but the frontend doesn't still gets a group.
  const extraTeams = [...new Set(items.map((i) => i.team))]
    .filter((key) => !WAITING_TEAMS.some((t) => t.key === key))
    .map((key) => ({ key, label: departmentLabel(key) }));

  return [...WAITING_TEAMS, ...extraTeams]
    .map((team) => ({ ...team, items: items.filter((i) => i.team === team.key) }))
    .filter((group) => group.items.length);
}

/** Total across the groups, for the card's heading. */
export function waitingForCount(groups = []) {
  return groups.reduce((sum, group) => sum + group.items.length, 0);
}
