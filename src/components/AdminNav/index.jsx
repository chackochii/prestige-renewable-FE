// Pills linking the administration screens.

import { NavLink } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

const LINKS = [
  { to: "/admin", label: "Users", end: true },
  { to: "/admin/roles", label: "Roles & permissions" },
  { to: "/admin/pages", label: "Pages" },
  { to: "/admin/settings", label: "Unit settings" },
];

export default function AdminNav() {
  const { isSuperAdmin } = useAuth();
  return (
    <div className="segmented" style={{ marginBottom: 24 }}>
      {LINKS.map((link) => (
        <NavLink key={link.to} to={link.to} end={link.end} className={({ isActive }) => (isActive ? "active" : "")}>
          {link.label}
        </NavLink>
      ))}
      {isSuperAdmin ? (
        <NavLink to="/superadmin" className={({ isActive }) => (isActive ? "active" : "")}>
          Business units
        </NavLink>
      ) : null}
    </div>
  );
}
