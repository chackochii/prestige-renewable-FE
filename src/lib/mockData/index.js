// Hardcoded data for modules whose API is not connected yet. Each file mirrors
// the shape its service is expected to return, so replacing one is a matter
// of swapping the import for a slice. Nothing in here should outlive its API.

export * from "./adminTeam";
export {
  PROCUREMENT_STAGE,
  VARIATION_THRESHOLD_PCT,
  PROCUREMENT_STEPS,
  APPROVER_ROLES,
  APPROVAL_TIERS,
  LINE_KINDS,
  AVAILABILITY,
  PO_STATUSES,
  PROCUREMENT_JOBS,
} from "./procurement";
