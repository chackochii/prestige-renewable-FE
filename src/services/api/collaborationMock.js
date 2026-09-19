// Sample requests and assignments, for looking at the collaboration screens
// before prestige-be has the endpoints.
//
// Off unless VITE_COLLAB_MOCK=true is set in .env — production builds never
// reach this. Everything lives in memory: responding, accepting, uploading and
// progressing all work for the session and vanish on reload.
//
// Delete this file (and the two `MOCK` branches in collaborationApi.js) once
// the real endpoints land.

import { loadSession } from "./tokenStore";

export const MOCK_ENABLED = import.meta.env.VITE_COLLAB_MOCK === "true";

const me = () => loadSession()?.user?.id ?? 1;
const myName = () => loadSession()?.user?.name || "You";

const daysFromNow = (days) => new Date(Date.now() + days * 86400000).toISOString();
const daysAgo = (days) => daysFromNow(-days);

let sequence = 500;
const nextId = () => (sequence += 1);

/** Seeded on first use so the ids line up with whoever is signed in. */
function seed() {
  const mine = me();
  return [
    {
      id: 501,
      code: "REQ-501",
      kind: "information",
      opportunityId: 1,
      opportunityNumber: "PRJ-101",
      opportunityName: "Novak Farms",
      stage: 2,
      department: "sales",
      title: "Client energy usage and bills",
      description: "Need the annual usage before I can size the system — the lead pack has no bill attached.",
      requestedFields: [
        { key: "annual_kwh", label: "Annual usage (kWh)", type: "number" },
        { key: "tariff", label: "Current tariff / retailer", type: "text" },
        { key: "notes", label: "Anything else the client said", type: "textarea" },
      ],
      requestedDocuments: [
        { key: "electricity_bill", label: "Recent electricity bill", type: "document", comment: "Most recent quarter, all pages" },
        { key: "meter_box", label: "Meter box photo", type: "image", comment: "Include the meter number" },
      ],
      createdById: mine,
      createdByName: myName(),
      assigneeId: 7,
      assigneeName: "Priya Nair (Sales)",
      priority: "high",
      dueAt: daysAgo(1),
      status: "responded",
      createdAt: daysAgo(4),
      updatedAt: daysAgo(1),
      latestUpdate: { note: "Response submitted with the bill attached", at: daysAgo(1), byName: "Priya Nair" },
      response: {
        fields: {
          annual_kwh: 18400,
          tariff: "Origin — Flat rate 32c/kWh",
          notes: "Client is away until the 14th, happy for us to proceed on these numbers.",
        },
        note: "Bill is the most recent quarter. Meter box photo taken on the visit.",
        submittedAt: daysAgo(1),
        submittedByName: "Priya Nair",
        attachments: [
          { id: 9001, filename: "origin-bill-q3.pdf", url: "#", documentKey: "electricity_bill" },
          { id: 9002, filename: "meter-box.jpg", url: "#", documentKey: "meter_box" },
        ],
      },
      progress: [],
    },
    {
      id: 502,
      code: "REQ-502",
      kind: "information",
      opportunityId: 2,
      opportunityNumber: "PRJ-105",
      opportunityName: "Bright Co",
      stage: 2,
      department: "sales",
      title: "Site details confirmation",
      description: "Roof type and phase aren't on the lead — can you confirm with the client?",
      requestedFields: [
        { key: "roof_type", label: "Roof type", type: "text" },
        { key: "phase", label: "Electrical phase", type: "text" },
      ],
      requestedDocuments: [{ key: "roof", label: "Roof photo", type: "image", comment: "Show the whole north-facing side" }],
      createdById: 12,
      createdByName: "Daniel Ross (Estimator)",
      assigneeId: mine,
      assigneeName: myName(),
      priority: "medium",
      dueAt: daysFromNow(2),
      status: "pending",
      createdAt: daysAgo(1),
      updatedAt: daysAgo(1),
      latestUpdate: null,
      response: null,
      progress: [],
    },
    {
      id: 503,
      code: "ASG-503",
      kind: "assignment",
      opportunityId: 3,
      opportunityNumber: "PRJ-103",
      opportunityName: "Harbour Ltd",
      stage: 2,
      department: "operations",
      title: "Client site visit",
      description: "Confirm switchboard capacity and roof access before the estimate is finalised.",
      requestedDocuments: [{ key: "switchboard", label: "Switchboard photo", type: "image", comment: "Door open, main switch visible" }],
      createdById: mine,
      createdByName: myName(),
      assigneeId: 9,
      assigneeName: "Sam Whitfield (Operations)",
      priority: "medium",
      dueAt: daysFromNow(4),
      scheduledFor: daysFromNow(2),
      status: "scheduled",
      createdAt: daysAgo(3),
      updatedAt: daysAgo(1),
      latestUpdate: { note: "Booked for Thursday morning, client confirmed", at: daysAgo(1), byName: "Sam Whitfield" },
      response: null,
      progress: [
        { id: 8001, status: "assigned", note: "Assigned to Alex for the visit", at: daysAgo(2), byName: "Sam Whitfield" },
        { id: 8002, status: "scheduled", note: "Booked for Thursday morning, client confirmed", at: daysAgo(1), byName: "Sam Whitfield" },
        { id: 8003, status: "in_progress", note: "Running 30 min late — internal only", at: daysAgo(1), byName: "Sam Whitfield", internal: true },
      ],
    },
  ];
}

let store = null;
const all = () => (store ||= seed());
const find = (id) => all().find((r) => Number(r.id) === Number(id));
const wait = (value) => new Promise((resolve) => setTimeout(() => resolve(value), 250));
const clone = (value) => JSON.parse(JSON.stringify(value));

const history = new Map();
const record = (request, action, detail) => {
  const entries = history.get(request.id) || [];
  entries.unshift({ id: nextId(), action, detail, byName: myName(), at: new Date().toISOString() });
  history.set(request.id, entries);
};

export const mock = {
  listRequests({ scope } = {}) {
    const mine = me();
    const rows = all().filter((r) => {
      if (scope === "assigned") return Number(r.assigneeId) === mine;
      if (scope === "raised") return Number(r.createdById) === mine;
      return true;
    });
    return wait({ items: clone(rows), total: rows.length, page: 1, pageSize: rows.length });
  },

  getRequest(id) {
    return wait(clone(find(id)));
  },

  listOpportunityRequests(opportunityId) {
    return wait(clone(all().filter((r) => Number(r.opportunityId) === Number(opportunityId))));
  },

  createRequest(opportunityId, body) {
    const request = {
      id: nextId(),
      opportunityId: Number(opportunityId),
      opportunityNumber: `PRJ-${opportunityId}`,
      opportunityName: "Sample project",
      createdById: me(),
      createdByName: myName(),
      assigneeName: "Sample assignee",
      status: body.kind === "assignment" ? "requested" : "pending",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      response: null,
      progress: [],
      latestUpdate: null,
      ...body,
    };
    all().unshift(request);
    record(request, "Request raised", request.title);
    return wait(clone(request));
  },

  updateRequest(id, body) {
    const request = find(id);
    Object.assign(request, body, { updatedAt: new Date().toISOString() });
    record(request, "Request updated");
    return wait(clone(request));
  },

  submitResponse(id, body) {
    const request = find(id);
    request.response = {
      ...(request.response || {}),
      fields: body.fields,
      note: body.note,
      draft: Boolean(body.draft),
      submittedAt: body.draft ? null : new Date().toISOString(),
      submittedByName: myName(),
      attachments: request.response?.attachments || [],
    };
    request.status = body.draft ? "draft_saved" : "responded";
    request.updatedAt = new Date().toISOString();
    request.latestUpdate = { note: body.draft ? "Draft saved" : "Response submitted", at: request.updatedAt, byName: myName() };
    record(request, body.draft ? "Draft saved" : "Response submitted", body.note);
    return wait(clone(request));
  },

  decideResponse(id, body) {
    const request = find(id);
    request.status = body.outcome;
    request.clarificationNote = body.outcome === "clarification_required" ? body.note : request.clarificationNote;
    request.updatedAt = new Date().toISOString();
    request.latestUpdate = { note: body.outcome === "accepted" ? "Response accepted" : "Clarification requested", at: request.updatedAt, byName: myName() };
    record(request, body.outcome === "accepted" ? "Response accepted" : "Clarification requested", body.note);
    return wait(clone(request));
  },

  addProgress(id, body) {
    const request = find(id);
    request.status = body.status || request.status;
    if (body.scheduledFor) request.scheduledFor = body.scheduledFor;
    request.progress = [
      ...(request.progress || []),
      { id: nextId(), status: request.status, note: body.note, internal: Boolean(body.internal), at: new Date().toISOString(), byName: myName() },
    ];
    request.updatedAt = new Date().toISOString();
    if (!body.internal) request.latestUpdate = { note: body.note, at: request.updatedAt, byName: myName() };
    record(request, "Progress update", body.note);
    return wait(clone(request));
  },

  uploadRequestAttachment(id, category, file, documentKey) {
    const request = find(id);
    const attachment = { id: nextId(), filename: file.name, url: URL.createObjectURL(file), documentKey, category };
    if (category === "report") request.reports = [...(request.reports || []), attachment];
    else
      request.response = {
        ...(request.response || { fields: {}, attachments: [] }),
        attachments: [...(request.response?.attachments || []), attachment],
      };
    record(request, "File uploaded", file.name);
    return wait({ request: clone(request), attachment });
  },

  fileAttachmentOnOpportunity(id, body) {
    const request = find(id);
    record(request, "Filed on the job", `Attachment ${body.attachmentId} → ${body.category}`);
    return wait(clone(request));
  },

  cancelRequest(id, body) {
    const request = find(id);
    request.status = "cancelled";
    record(request, "Request cancelled", body?.reason);
    return wait(clone(request));
  },

  listRequestHistory(id) {
    const request = find(id);
    const seeded = history.get(request.id) || [
      { id: nextId(), action: "Request raised", detail: request.title, byName: request.createdByName, at: request.createdAt },
    ];
    return wait(clone(seeded));
  },
};
