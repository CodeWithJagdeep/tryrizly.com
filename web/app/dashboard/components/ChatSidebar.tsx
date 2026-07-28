"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  BellIcon,
  BoltIcon,
  CalendarIcon,
  ChatIcon,
  ClockIcon,
  GearIcon,
  HomeIcon,
  MailIcon,
  PanelToggleIcon,
  PlugIcon,
  UsersIcon,
  VideoIcon,
} from "./icons";
import { type ChatSession, subscribeToOpenSearch } from "../lib/chat-store";
import {
  initSidebarCollapsed,
  isSidebarCollapsed,
  isSidebarOpen,
  setSidebarOpen,
  subscribeToSidebar,
  subscribeToSidebarCollapsed,
  toggleSidebarCollapsed,
} from "../lib/sidebar-store";

export function ChatSidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeId = pathname === "/dashboard" ? searchParams.get("session") : null;

  const [history, setHistory] = useState<ChatSession[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [emailBadge, setEmailBadge] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sync = () => setMobileOpen(isSidebarOpen());
    sync();
    return subscribeToSidebar(sync);
  }, []);

  useEffect(() => {
    initSidebarCollapsed();
    setCollapsed(isSidebarCollapsed());
    return subscribeToSidebarCollapsed(() => setCollapsed(isSidebarCollapsed()));
  }, []);

  // Close the mobile drawer whenever navigation happens.
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname, activeId]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/chat/history");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { sessions?: ChatSession[] };
        if (!cancelled) setHistory(data.sessions ?? []);
      } catch { /* best-effort */ }
    };
    void load();
    const t = setInterval(load, 30_000);
    const unsubSearch = subscribeToOpenSearch(() => setSearchOpen(true));
    return () => { cancelled = true; clearInterval(t); unsubSearch(); };
  }, []);


  useEffect(() => {
    const lastSeen = Number(localStorage.getItem("emails_last_seen") ?? 0);
    fetch("/api/emails")
      .then((r) => r.json())
      .then((d: { emails?: { createdAt: string }[] }) => {
        const newCount = (d.emails ?? []).filter(
          (e) => Date.parse(e.createdAt) > lastSeen,
        ).length;
        setEmailBadge(newCount);
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (pathname === "/dashboard/emails") {
      localStorage.setItem("emails_last_seen", String(Date.now()));
      setEmailBadge(0);
    }
  }, [pathname]);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const filtered = query.trim()
    ? history.filter((h) => h.title.toLowerCase().includes(query.trim().toLowerCase()))
    : history;
  const recents = filtered.slice(0, 15);

  // Flat groups separated by a divider, no text section labels — keeps the
  // list scannable instead of stacking category headers over a handful of items.
  const iconCls = "h-[18px] w-[18px]";
  // On the flow-builder canvas we strip the sidebar down to just Home + Chat
  // so it doesn't compete with the builder's own panels ("for now").
  const isFlowBuilder = /^\/dashboard\/automations\/.+/.test(pathname);
  const navSections = isFlowBuilder
    ? [
        [
          { href: "/dashboard", icon: <HomeIcon className={iconCls} />, label: "Home" },
          { href: "/dashboard", icon: <ChatIcon className={iconCls} />, label: "Chat" },
        ],
      ]
    : [
        [
          { href: "/dashboard", icon: <ChatIcon className={iconCls} />, label: "Chat" },
          { href: "/dashboard/emails", icon: <MailIcon className={iconCls} />, label: "Emails", badge: emailBadge > 0 ? String(emailBadge) : undefined },
          { href: "/dashboard/calendar", icon: <CalendarIcon className={iconCls} />, label: "Calendar" },
          { href: "/dashboard/meetings", icon: <VideoIcon className={iconCls} />, label: "Meetings" },
          { href: "/dashboard/people", icon: <UsersIcon className={iconCls} />, label: "People" },
          { href: "/dashboard/scheduled", icon: <ClockIcon className={iconCls} />, label: "Scheduled" },
          { href: "/dashboard/automations", icon: <BoltIcon className={iconCls} />, label: "Automations" },
          { href: "/dashboard/connectors", icon: <PlugIcon className={iconCls} />, label: "Connectors" },
        ],
      ];

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
        />
      )}
      <aside
        className={`fixed bottom-0 left-0 top-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-[#f0f0f0] transition-transform duration-200 lg:z-auto lg:translate-x-0 ${
          collapsed ? "lg:w-16" : "lg:w-64"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >

      {/* Logo + collapse toggle */}
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        {!collapsed && (
          <Link href="/dashboard" aria-label="rizly home">
            <Image src="/rizly_white.png" alt="rizly" width={65} height={22} className="w-[65px] h-auto object-contain" priority />
          </Link>
        )}
        <button
          type="button"
          onClick={toggleSidebarCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-200/70 lg:flex"
        >
          <PanelToggleIcon className="h-[18px] w-[18px]" />
        </button>
      </div>


      {/* Search */}
      {searchOpen && !collapsed && (
        <div className="shrink-0 px-3 pb-3">
          <input
            ref={searchInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats…"
            className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-black placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FE7F2D]/30"
          />
        </div>
      )}

      {/* Scrollable nav */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2">

        {/* Flat nav groups, divided by a thin rule instead of text labels */}
        {navSections.map((items, i) => (
          <div key={i} className={`flex flex-col gap-px ${i === 0 ? "mb-2" : "mb-3 border-t border-slate-200/70 pt-2"}`}>
            {items.map((item) => {
              const isActive = item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`group flex h-9 items-center rounded-lg px-2.5 text-sm transition-colors ${
                    collapsed ? "justify-center" : "gap-2"
                  } ${
                    isActive
                      ? "bg-black/5 font-medium text-black"
                      : "text-black hover:bg-slate-200/50"
                  }`}
                >
                  <span className={isActive ? "shrink-0 text-black" : "shrink-0 text-slate-500"}>
                    {item.icon}
                  </span>
                  {!collapsed && (
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  )}
                  {item.badge && !collapsed && (
                    <span className="shrink-0 rounded-sm bg-[#FE7F2D]/10 px-1.5 py-0.5 text-[10px] font-medium text-[#FE7F2D]">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}

        {/* Chat history (from database, not localStorage) */}
        {!collapsed && (
          <div className="mb-3 border-t border-slate-200/70 pt-3">
            <div className="flex h-7 items-center px-2.5">
              <SectionLabel>Recent</SectionLabel>
            </div>
            {recents.length ? (
              recents.map((s) => (
                <SessionRow key={s.id} session={s} active={s.id === activeId} />
              ))
            ) : (
              <p className="px-2.5 py-1 text-sm text-slate-400">
                {query.trim() ? "No results" : "No chats yet"}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className={`shrink-0 border-t border-slate-200 px-2 py-2 ${collapsed ? "flex flex-col items-center gap-1" : ""}`}>
        <div className={`flex items-center gap-1 ${collapsed ? "flex-col" : "justify-end"}`}>
          <Link
            href="/dashboard/notifications"
            title="Notifications"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-200/70"
          >
            <BellIcon className="h-[18px] w-[18px]" />
          </Link>
          <Link
            href="/dashboard/settings"
            title="Settings"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 transition-colors hover:bg-slate-200/70"
          >
            <GearIcon className="h-[18px] w-[18px]" />
          </Link>
        </div>
      </div>
      </aside>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[13px] font-medium text-black">
      {children}
    </p>
  );
}

function SessionRow({ session, active }: { session: ChatSession; active: boolean }) {
  return (
    <Link
      href={`/dashboard?session=${session.id}`}
      className={`flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm transition-colors ${
        active ? "bg-black/5 text-black" : "text-black hover:bg-slate-200/50"
      }`}
    >
      <ChatIcon className="h-[18px] w-[18px] shrink-0 text-slate-500" />
      <span className="min-w-0 flex-1 truncate">{session.title}</span>
    </Link>
  );
}
