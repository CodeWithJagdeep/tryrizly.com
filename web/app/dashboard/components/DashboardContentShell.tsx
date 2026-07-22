"use client";

import { useEffect, useState } from "react";
import {
  initSidebarCollapsed,
  isSidebarCollapsed,
  subscribeToSidebarCollapsed,
} from "../lib/sidebar-store";

// Keeps the content column's left offset in sync with the sidebar's
// collapsed/expanded width, since that's a client-only toggle the
// (server) layout can't react to directly.
export function DashboardContentShell({ children }: { children: React.ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    initSidebarCollapsed();
    setCollapsed(isSidebarCollapsed());
    return subscribeToSidebarCollapsed(() => setCollapsed(isSidebarCollapsed()));
  }, []);

  return (
    <div
      className={`flex min-h-0 flex-1 flex-col pb-16 lg:pb-0 ${
        collapsed ? "lg:pl-16" : "lg:pl-64"
      }`}
    >
      {children}
    </div>
  );
}
