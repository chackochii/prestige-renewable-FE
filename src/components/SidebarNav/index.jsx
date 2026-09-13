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
  Settings,
  ShieldCheck,
  ShoppingCart,
  Users,
  Wallet,
  X,
} from "lucide-react";
import { useMemo } from "react";
import UnitBrandMark from "@/components/UnitBrandMark";
import { useAppSelector } from "@/store";
import { useAuth } from "@/hooks/useAuth";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { buildNav } from "@/helpers/navigation";

const ICONS = {
  home: House,
  leads: ClipboardCheck,
  pipeline: Briefcase,
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
  const items = useMemo(() => buildNav({ pages, user, unit }), [pages, user, unit]);

  return (
    <aside className={`sidebar ${open ? "open" : ""}`.trim()}>
      <button type="button" className="icon-btn sidebar-close" onClick={onClose} aria-label="Close menu">
        <X size={18} />
      </button>

      <div className="brand">
        <UnitBrandMark unit={unit} size={36} />
        <div>
          <div className="brand-name">
            Prestige
            {unit?.code ? <span className="brand-tag">{unit.code}</span> : null}
          </div>
          <div className="brand-sub">{unit?.name || "Lead to service"}</div>
        </div>
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

      <div className="sidebar-foot">
        {unit?.name || "No business unit selected"}
        {unit?.legalName ? <div>{unit.legalName}</div> : null}
      </div>
    </aside>
  );
}
