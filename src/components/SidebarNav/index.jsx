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

const NAV_ORDER = ["home", "pipeline", "leads", "approvals", "procurement", "quotes", "admin"];
const NAV_LABELS = { pipeline: "Jobs Board", admin: "Control Centre" };

export default function SidebarNav({ open, onClose, onSearch }) {
  const { user } = useAuth();
  const { unit } = useBusinessUnit();
  const pages = useAppSelector((s) => s.pages.items);
  // The order and names the business asked for (UAT, Oct 2026): these first,
  // in this order, then any other page the person can open, as the registry
  // lists them.
  const items = useMemo(() => {
    const built = buildNav({ pages, user, unit }).map((item) => (NAV_LABELS[item.code] ? { ...item, label: NAV_LABELS[item.code] } : item));
    const rank = (item) => {
      const at = NAV_ORDER.indexOf(item.code);
      return at === -1 ? NAV_ORDER.length : at;
    };
    return built.map((item, index) => ({ item, index })).sort((a, b) => rank(a.item) - rank(b.item) || a.index - b.index).map(({ item }) => item);
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
