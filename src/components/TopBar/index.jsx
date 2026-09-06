// Top bar: mobile menu toggle, notifications, user menu.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Menu, Moon, Sun } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useBusinessUnit } from "@/hooks/useBusinessUnit";
import { useAppSelector } from "@/store";
import { findPage, canSeePage } from "@/helpers/navigation";
import { PAGE_CODES } from "@/constants/permissions";
import { initials } from "@/utils/text";

export default function TopBar({ onMenu }) {
  const navigate = useNavigate();
  const { user, roleLabels } = useAuth();
  const { unit } = useBusinessUnit();
  const { isDark, toggle: toggleTheme } = useTheme();
  const pages = useAppSelector((s) => s.pages.items);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [menuOpen]);

  const adminPage = findPage(pages, PAGE_CODES.ADMIN);
  const canOpenAdmin = adminPage ? canSeePage(adminPage, user, unit) : false;

  return (
    <header className="topbar">
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <button type="button" className="icon-btn mobile-toggle" onClick={onMenu} aria-label="Open menu">
          <Menu size={18} />
        </button>
      </div>

      <div className="top-actions">
        <button
          type="button"
          className="icon-btn"
          onClick={toggleTheme}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
          title={isDark ? "Light mode" : "Dark mode"}
        >
          {isDark ? <Sun size={18} /> : <Moon size={18} />}
        </button>
        <button
          type="button"
          className="icon-btn"
          onClick={() => navigate("/notifications")}
          aria-label="Notifications"
        >
          <Bell size={18} />
        </button>
        <div className="menu" ref={menuRef}>
          <button type="button" className="who" onClick={() => setMenuOpen((v) => !v)} aria-haspopup="menu">
            <span className="avatar">{initials(user?.name)}</span>
            <span>
              {user?.name}
              <small>{roleLabels.join(" · ") || "No role"}</small>
            </span>
          </button>
          {menuOpen ? (
            <div className="menu-pop" role="menu">
              <div className="menu-meta">
                {user?.email}
                {user?.title ? ` · ${user.title}` : ""}
              </div>
              {canOpenAdmin ? (
                <button
                  type="button"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate(adminPage.path);
                  }}
                >
                  Settings
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  navigate("/logout");
                }}
              >
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}
