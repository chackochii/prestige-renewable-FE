// Sidebar: brand, search trigger and the permission-driven nav.

import { NavLink } from "react-router-dom";
import {
  Briefcase,
  Building2,
  CircleDollarSign,
  ClipboardCheck,
  FileText,
  Gauge,
  HardHat,
  House,
  LayoutGrid,
  Megaphone,
  Receipt,
  Search,
  Send,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useMemo } from "react";
import { useAppSelector } from "@/store";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { buildNav } from "@/helpers/navigation";

const ICONS = {
  home: House,
  leads: ClipboardCheck,
  pipeline: Briefcase,
  proposals: Send,
  marketing: Megaphone,
  approvals: FileText,
  procurement: ShoppingCart,
  construction: HardHat,
  quotes: Receipt,
  costs: CircleDollarSign,
  billing: Wallet,
  warranty: ShieldCheck,
  referrers: Users,
  dashboards: Gauge,
  admin: Settings,
  superadmin: Building2,
};

export default function SidebarNav({ open, onClose, onSearch }) {
  const { user } = useAuth();
  const { unit } = useBusinessUnit();
  const pages = useAppSelector((s) => s.pages.items);
  // The pipeline is the Jobs Board, straight under Home (UAT, Oct 2026).
  const items = useMemo(() => {
    const built = buildNav({ pages, user, unit }).map((item) => (item.code === "pipeline" ? { ...item, label: "Jobs Board" } : item));
    const board = built.find((item) => item.code === "pipeline");
    if (!board) return built;
    const rest = built.filter((item) => item !== board);
    const home = rest.findIndex((item) => item.code === "home");
    rest.splice(home + 1, 0, board);
    return rest;
  }, [pages, user, unit]);

  return (
    <aside className={`sidebar ${open ? "open" : ""}`.trim()}>
      <button type="button" className="icon-btn sidebar-close" onClick={onClose} aria-label="Close menu">
        <X size={18} />
      </button>

      <div className="brand">
        {/* The unit's name, once. */}
        <div className="brand-name">{unit?.name || "Prestige Portal"}</div>
      </div>

      <button type="button" className="sidebar-search" onClick={onSearch}>
        <Search size={15} />
        <span>Search…</span>
        <kbd>⌘K</kbd>
      </button>

      <nav className="nav" onClick={onClose}>
        {items.map((item) => {
          const Icon = ICONS[item.code] || LayoutGrid;
          return (
            <NavLink key={item.path} to={item.path} end={item.path === "/"}>
              <Icon size={17} />
              {item.label}
            </NavLink>
          );
        })}
      </nav>

    </aside>
  );
}
