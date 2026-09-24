// Who may move a record out of each pipeline stage.
//
// Mirrors prestige-be/modules/opportunity/service/stageAccess.js — the API is
// the authority and refuses with a 403 either way; this only decides which
// cards are draggable and which Advance buttons are live, so nobody is offered
// a move that would bounce.
//
// Advancing hands work from one department to the next, so the permission
// asked for is the one that owns the stage being left, not a blanket
// leads.update. Grant invoicing.update to somebody on the roles screen and they
// can close out billing, with no change here.

import { hasPermission } from "@/constants/roles";
import { stageById } from "@/constants/stages";

/**
 * Stage number → the permission needed to *see* it: its column on the board,
 * its step on a record, and the records sitting in it. The API filters lists to
 * these stages as well, so hiding here is presentation, not the guard.
 */
export const STAGE_VIEW_PERMISSION = {
  1: "leads.read",
  2: "estimation.read",
  3: "leads.read",
  4: "leads.read",
  5: "approvals.read",
  6: "procurement.read",
  7: "construction.read",
  8: "invoicing.read",
  9: "warranty.read",
};

/** Stage number → the permission needed to move a record out of it. */
export const STAGE_ADVANCE_PERMISSION = {
  1: "leads.update", // sales qualified the lead and assigned an estimator
  2: "estimation.update", // estimation priced it and the quote has items
  3: "leads.update", // sales negotiated the proposal to acceptance
  4: "leads.update", // sales recorded the signed acceptance
  5: "approvals.update", // council, network and rebate approvals gathered
  6: "procurement.update", // purchase orders placed, deliveries confirmed
  7: "construction.update", // site works installed and commissioned
  8: "invoicing.update", // milestone billing reconciled
  9: "warranty.update", // handover pack completed
};

/** The permission needed to leave `stage`. */
export function advancePermissionFor(stage) {
  return STAGE_ADVANCE_PERMISSION[Number(stage)] ?? "leads.update";
}

/** The permission needed to see `stage`. */
export function viewPermissionFor(stage) {
  return STAGE_VIEW_PERMISSION[Number(stage)] ?? "leads.read";
}

/** Can this person see `stage` at all? */
export function canViewStage(user, stage) {
  return hasPermission(user, viewPermissionFor(stage));
}

/** Of `stages`, the ones this person may see — for board columns and the stepper. */
export function viewableStages(user, stages = []) {
  return stages.filter((s) => canViewStage(user, s.id ?? s));
}

/** Who works a stage this person cannot see, for the notice shown in its place. */
export function stageHiddenReason(user, stage) {
  if (canViewStage(user, stage)) return null;
  return `${stageById(stage).label} is worked by another team — your role does not include ${viewPermissionFor(stage)}`;
}

/** Can this person move a record out of `stage`? */
export function canAdvanceFrom(user, stage) {
  return hasPermission(user, advancePermissionFor(stage));
}

/** Stages this person owns, for "you can move nothing here" messaging. */
export function advanceableStages(user, stages = []) {
  return stages.filter((s) => canAdvanceFrom(user, s.id ?? s));
}

/** Why the Advance button is off, in words a person can act on. */
export function advanceDeniedReason(user, stage) {
  if (canAdvanceFrom(user, stage)) return null;
  return `Moving this out of ${stageById(stage).short} is done by the team that owns that stage`;
}
