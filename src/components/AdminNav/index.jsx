// Pills linking the administration screens.

import { NavLink } from "react-router-dom";
import { PERMISSIONS } from "@/constants/permissions";
import { useAuth } from "@/hooks/useAuth";

const LINKS = [
  { to: "/admin", label: "Users", end: true },
  { to: "/admin/roles", label: "Roles & permissions" },
  { to: "/admin/pages", label: "Pages" },
  { to: "/admin/settings", label: "Unit settings" },
  { to: "/admin/connections", label: "Lead connections" },
  // Only for people who can take the backup (admin.export).
  { to: "/admin/backup", label: "Data backup", permission: PERMISSIONS.ADMIN_EXPORT },
];

export default function AdminNav() {
  const { isSuperAdmin, hasPermission } = useAuth();
  return (
    <div className="segmented" style={{ marginBottom: 24 }}>
      {LINKS.filter((link) => !link.permission || hasPermission(link.permission)).map((link) => (
        <NavLink
          key={link.to}
          to={link.to}
          end={link.end}
          className={({ isActive }) => (isActive ? "active" : "")}
        >
          {link.label}
        </NavLink>
      ))}
      {isSuperAdmin ? (
        <>
          <NavLink
            to="/superadmin"
            end
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Business units
          </NavLink>
          <NavLink
            to="/superadmin/dnsp-networks"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            DNSP networks
          </NavLink>
          <NavLink
            to="/superadmin/catalog"
            className={({ isActive }) => (isActive ? "active" : "")}
          >
            Quote catalog
          </NavLink>
        </>
      ) : null}
    </div>
  );
}
