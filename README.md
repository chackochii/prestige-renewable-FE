# prestige-fe

Front end for the Prestige Business Units sales & delivery pipeline (leads → estimation → proposal → closure → approvals → procurement → site works → billing → handover). Talks to [prestige-be](../prestige-be).

## Stack

- React 19 (JavaScript) on Vite
- Tailwind CSS v4 (tokens) + a small component layer (`src/styles/app.css`)
- React Router v7
- Redux Toolkit + React Redux
- Axios, lucide-react icons

## Getting started

```bash
npm install
cp .env.example .env   # set VITE_API_BASE_URL to the prestige-be URL (default http://localhost:8000/api)
npm run dev            # http://localhost:3000
```

Other scripts:

```bash
npm run build      # build to dist/
npm run preview    # serve the production build
npm run lint       # eslint
```

Deploying to Vercel: `vercel.json` rewrites every path to `index.html` for client-side routing. Set `VITE_API_BASE_URL` in the project's environment variables.

## Access control

Everything is driven by data the API returns:

- **Sign-in** (`POST /users/login`) returns the user with `roles[]` (a person may hold several) and `permissions[]` — the union of every role's grants. `ADM` bypasses all checks (mirrored in `src/constants/roles.js`).
- **Sidebar** = the page registry (`GET /pages`) filtered by the user's permission codes and the business unit's `disabledPages`. Home is always shown; `/superadmin` (business-unit CRUD) is shown to `ADM` only and lives outside the registry on purpose.
- **Routes** are guarded with `RequirePage`, `RequirePermission` and `RequireRole` in `src/routes/routeGuards.jsx`. Inside a page, actions are hidden or disabled with `useAuth().hasPermission(code)`.
- **Business units**: the units a person can work in come from `GET /business-units`; a person with several picks one after sign-in and can switch from the top bar. Every list is scoped to the current unit.

Administration screens: `/admin` (users, multi-role assignment, unit membership), `/admin/roles` (grants editor + role/permission catalog), `/admin/pages` (registry + unit × page toggle matrix), `/admin/settings` (margin floor, stages, SLA days, billing split, commission tiers, approval types, site sub-stages), `/superadmin` (business units, ADM only).

## Layout

```
src/
├── app.jsx              # Redux Provider + RouterProvider
├── main.jsx             # entry
├── index.css            # Tailwind + Prestige tokens
├── styles/app.css       # component classes (cards, tables, kanban, stepper, ...)
├── constants/           # permissions, roles helpers, stages, timezones
├── helpers/             # navigation (registry → nav), stage gating, date/time
├── utils/               # validators, currency, text
├── services/api/        # axios client + one module per API resource
├── store/               # Redux store
├── slices/              # auth, businessUnits, pages, roles, leads, employee, referrals, notifications, ...
├── themes/              # brand colours & typography (mirrors index.css)
├── routes/              # route tables + guards
├── hooks/               # useAuth, useBusinessUnit, useOpportunities, useUnitUsers, useNotifications
├── components/          # shared UI (SidebarNav, TopBar, StageStepper, JobCard, Modal, ...)
├── features/            # leads (form model + form), pipeline (stage panels), admin (modals)
├── layouts/             # workspace shell / public / superadmin guard
└── pages/               # admin/ (workspace screens), public/, superadmin/
```

`@/` is aliased to `src/` (see `jsconfig.json` and `vite.config.js`).

## Modules awaiting an API

Estimation, proposals/quotes, approvals, procurement, site-works sub-stages, billing, warranty, marketing campaigns and notifications have screens in place (so access can be configured now) but prestige-be does not expose endpoints for their records yet. Those pages show an honest empty state until the services exist.
