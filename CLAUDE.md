# prestige-fe

React 19 (JavaScript, no TypeScript) + Vite + Tailwind v4 + React Router v7 + Redux Toolkit.

- Plain `.js` / `.jsx` files only. Do not add TypeScript files or type annotations.
- `@/` resolves to `src/` (see `jsconfig.json` and `vite.config.js`).
- Tailwind v4: colour tokens live in `src/index.css` (`:root` + `@theme inline`); the component
  classes (`.card`, `.btn`, `.kanban`, …) live in `src/styles/app.css` inside `@layer components`.
  There is no `tailwind.config.js`.
- One Redux slice per pipeline stage in `src/slices/`; register new slices in `src/store/index.js`.
  Thunks call the modules in `src/services/api/` — never call axios from a component.
- Routes are in `src/routes/`. Guard access with `RequirePage` (registry page + permission + unit
  toggle), `RequirePermission` (module action) or `RequireRole` (ADM only) from `routeGuards.jsx`,
  not inside pages. Inside pages, hide/disable actions with `useAuth().hasPermission(code)`.
- Access is data, not code: roles and permissions come from the API (`GET /roles`, login payload),
  the sidebar from the page registry (`GET /pages`). Users may hold several roles. The only role
  the frontend knows by name is `ADM` (`src/constants/roles.js`); permission codes the frontend
  references are listed in `src/constants/permissions.js` and must match the prestige-be seeders.
- Run `npm run build` and `npm run lint` before finishing a change.
