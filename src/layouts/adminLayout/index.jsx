// Workspace shell: sidebar + top bar + routed content. Loads the reference
// data every screen relies on (business units, page registry, role catalog)
// once per session and gates on a business-unit choice.

import { Suspense, useCallback, useEffect, useState } from "react";
import { Outlet, ScrollRestoration, useLocation } from "react-router-dom";
import LoadingState from "@/components/LoadingState";
import SidebarNav from "@/components/SidebarNav";
import TopBar from "@/components/TopBar";
import NotificationBanner from "@/components/NotificationBanner";
import CommandPalette from "@/components/CommandPalette";
import ErrorBoundary from "@/components/ErrorBoundary";
import UnitSelectGate from "@/components/UnitSelectGate";
import { useAppDispatch, useAppSelector } from "@/store";
import { fetchBusinessUnits } from "@/slices/businessUnitsSlice";
import { fetchPages } from "@/slices/pagesSlice";
import { fetchRoles } from "@/slices/rolesSlice";

export default function AdminLayout() {
  const dispatch = useAppDispatch();
  const location = useLocation();
  const unitsStatus = useAppSelector((s) => s.businessUnits.status);
  const pagesStatus = useAppSelector((s) => s.pages.status);
  const rolesStatus = useAppSelector((s) => s.roles.status);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);

  useEffect(() => {
    if (unitsStatus === "idle") dispatch(fetchBusinessUnits());
    if (pagesStatus === "idle") dispatch(fetchPages());
    if (rolesStatus === "idle") dispatch(fetchRoles());
  }, [unitsStatus, pagesStatus, rolesStatus, dispatch]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const closePalette = useCallback(() => setPaletteOpen(false), []);

  return (
    <UnitSelectGate>
      <div className="app-shell">
        <SidebarNav open={sidebarOpen} onClose={() => setSidebarOpen(false)} onSearch={() => setPaletteOpen(true)} />
        <div className="main">
          <TopBar onMenu={() => setSidebarOpen(true)} />
          <div className="content">
            <ErrorBoundary resetKey={location.pathname}>
              <div className="route-fade" key={location.pathname}>
                <Suspense fallback={<LoadingState label="Loading…" />}>
                  <Outlet />
                </Suspense>
              </div>
            </ErrorBoundary>
          </div>
        </div>
        <NotificationBanner />
        <CommandPalette open={paletteOpen} onClose={closePalette} />
        <ScrollRestoration />
      </div>
    </UnitSelectGate>
  );
}
