// Permission codes the frontend references directly. They must match the
// catalog seeded by prestige-be/seeders/roles-permissions.cjs (module.action)
// and unit-pages.cjs (page.<code>.view). Everything else — which roles hold
// which codes, which pages exist — arrives from the API at runtime.

export const PERMISSIONS = {
  LEADS_CREATE: "leads.create",
  LEADS_READ: "leads.read",
  LEADS_UPDATE: "leads.update",
  LEADS_DELETE: "leads.delete",
  LEADS_APPROVE: "leads.approve",

  ESTIMATION_READ: "estimation.read",
  ESTIMATION_UPDATE: "estimation.update",

  APPROVALS_READ: "approvals.read",
  APPROVALS_UPDATE: "approvals.update",

  PROCUREMENT_UPDATE: "procurement.update",
  PROCUREMENT_APPROVE: "procurement.approve",

  ADMIN_CREATE: "admin.create",
  ADMIN_READ: "admin.read",
  ADMIN_UPDATE: "admin.update",
  ADMIN_DELETE: "admin.delete",
  ADMIN_APPROVE: "admin.approve",

  DASHBOARDS_READ: "dashboards.read",
};

/** Permission that gates visibility of a registry page. */
export const pageViewPermission = (pageCode) => `page.${pageCode}.view`;

/** Registry page codes the frontend has routes for (see routes/adminRoutes.jsx). */
export const PAGE_CODES = {
  LEADS: "leads",
  PIPELINE: "pipeline",
  PROPOSALS: "proposals",
  MARKETING: "marketing",
  APPROVALS: "approvals",
  PROCUREMENT: "procurement",
  CONSTRUCTION: "construction",
  QUOTES: "quotes",
  COSTS: "costs",
  BILLING: "billing",
  WARRANTY: "warranty",
  REFERRERS: "referrers",
  DASHBOARDS: "dashboards",
  ADMIN: "admin",
};
