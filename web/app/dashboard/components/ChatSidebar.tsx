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
  GaugeIcon,
  GearIcon,
  HomeIcon,
  LogoutIcon,
  MailIcon,
  PanelToggleIcon,
  PlugIcon,
  PlusIcon,
  ProfileIcon,
  UsersIcon,
  VideoIcon,
} from "./icons";
import { type ChatSession, deleteSession, subscribeToOpenSearch } from "../lib/chat-store";
import {
  initSidebarCollapsed,
  isSidebarCollapsed,
  isSidebarOpen,
  setSidebarOpen,
  subscribeToSidebar,
  subscribeToSidebarCollapsed,
  toggleSidebarCollapsed,
} from "../lib/sidebar-store";
import { openSettingsModal } from "../lib/settings-modal-store";

type Session = { email: string; name?: string; userId: string };

const PLAN_NAMES: Record<string, string> = {
  free: "Free",
  starter: "Starter",
  pro: "Pro",
  business: "Business",
};

function initials(session: Session): string {
  const source = session.name?.trim() || session.email;
  return source
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase())
    .join("");
}

export function ChatSidebar({ session }: { session: Session }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeId = pathname === "/dashboard" ? searchParams.get("session") : null;

  const [history, setHistory] = useState<ChatSession[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [emailBadge, setEmailBadge] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [planId, setPlanId] = useState<string | null>(null);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    fetch("/api/usage")
      .then((r) => r.json())
      .then((data: { planId?: string }) => setPlanId(data.planId ?? "free"))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!profileMenuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) {
        setProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [profileMenuOpen]);

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
    setProfileMenuOpen(false);
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

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  const filtered = query.trim()
    ? history.filter((h) => h.title.toLowerCase().includes(query.trim().toLowerCase()))
    : history;
  const recents = filtered.slice(0, 15);

  const iconCls = "h-4 w-4";
  // On the flow-builder canvas we strip the sidebar down to just Home + Chat
  // so it doesn't compete with the builder's own panels ("for now").
  const isFlowBuilder = /^\/dashboard\/automations\/.+/.test(pathname);
  const navItems = isFlowBuilder
    ? [
        { href: "/dashboard", icon: <HomeIcon className={iconCls} />, label: "Home", group: "Workspace" },
      ]
    : [
        { href: "/dashboard/connectors", icon: <PlugIcon className={iconCls} />, label: "Plugins", group: "Workspace" },
        { href: "/dashboard/scheduled", icon: <ClockIcon className={iconCls} />, label: "Scheduled", group: "Workspace" },
        { href: "/dashboard/emails", icon: <MailIcon className={iconCls} />, label: "Emails", badge: emailBadge > 0 ? String(emailBadge) : undefined, group: "Workspace" },
        { href: "/dashboard/calendar", icon: <CalendarIcon className={iconCls} />, label: "Calendar", group: "Workspace" },
        { href: "/dashboard/meetings", icon: <VideoIcon className={iconCls} />, label: "Meetings", group: "Workspace" },
        { href: "/dashboard/people", icon: <UsersIcon className={iconCls} />, label: "People", group: "Build" },
        // Automations hidden from nav for the narrower V1 story — the page/feature
        // itself is untouched, just not linked. Re-add this entry to bring it back.
        // { href: "/dashboard/automations", icon: <BoltIcon className={iconCls} />, label: "Automations", group: "Build" },
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
        className={`fixed bottom-0 left-0 top-0 z-50 flex w-[292px] max-w-[85vw] flex-col bg-[#1d1d1f] font-sans text-[#d2d1d4] transition-[transform,width] duration-200 lg:z-auto lg:translate-x-0 ${
          collapsed ? "lg:w-16" : "lg:w-[292px]"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
      >

      {/* Logo + collapse toggle */}
      <div className={`flex h-[74px] shrink-0 items-center px-5 ${collapsed ? "justify-center" : "justify-between"}`}>
        <Link
          href="/dashboard"
          aria-label="rizly home"
          className="flex h-[34px] w-[34px] shrink-0 items-center justify-center overflow-hidden rounded-lg"
        >
          <Image src="/rizly-transparent.jpg" alt="rizly" width={20} height={20} className="h-5 w-5 object-contain" priority />
        </Link>
        {!collapsed && (
          <button
            type="button"
            onClick={toggleSidebarCollapsed}
            title="Collapse sidebar"
            className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#aaa9ad] transition-colors hover:bg-white/5 lg:flex"
          >
            <PanelToggleIcon className="h-[18px] w-[18px]" />
          </button>
        )}
      </div>

      {collapsed && (
        <div className="hidden shrink-0 justify-center px-3 pb-2 lg:flex">
          <button
            type="button"
            onClick={toggleSidebarCollapsed}
            title="Expand sidebar"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#aaa9ad] transition-colors hover:bg-white/5"
          >
            <PanelToggleIcon className="h-[18px] w-[18px]" />
          </button>
        </div>
      )}

      {/* New chat */}
      <div className="shrink-0 px-2">
        <Link
          href="/dashboard"
          title={collapsed ? "New chat" : undefined}
          className={`flex h-[55px] items-center rounded-2xl border border-[#414044] !bg-[#252527] text-[16px] font-medium text-[#d9d8db] transition-colors hover:!bg-[#29292b] ${
            collapsed ? "justify-center" : "gap-1.5 px-3"
          }`}
        >
          <PlusIcon className="h-4 w-4 shrink-0" />
          {!collapsed && <span>New chat</span>}
          {!collapsed && (
            <span className="ml-auto flex items-center gap-1 text-[15px] text-[#aaa9ad]">
              <kbd className="rounded bg-[#414044] px-1.5 py-0.5 text-xs leading-none">Ctrl</kbd>
              <kbd className="rounded bg-[#414044] px-1.5 py-0.5 text-xs leading-none">K</kbd>
            </span>
          )}
        </Link>
      </div>

      {/* Search */}
      {searchOpen && !collapsed && (
        <div className="shrink-0 px-3 pb-3">
          <input
            ref={searchInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats…"
            className="h-9 w-full rounded-lg border border-white/10 bg-white/5 px-3 text-[15px] text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#FE7F2D]/30"
          />
        </div>
      )}

      {/* Scrollable nav */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 pt-2">
        <nav aria-label="Dashboard navigation" className="flex flex-col">
          {navItems.map((item, index) => {
              const isActive = item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
              return (
                <div key={`${item.href}-${item.label}`}>
                  {!collapsed && (index === 0 || item.group !== navItems[index - 1]?.group) && (
                    <p className="px-2.5 pb-2 text-[11px] font-medium uppercase tracking-[0.12em] text-[#707075]">{item.group}</p>
                  )}
                  <Link
                    href={item.href}
                    title={collapsed ? item.label : undefined}
                    className={`group flex h-[45px] items-center rounded-xl px-2.5 text-[16px] transition-all duration-200 ${
                      collapsed ? "justify-center" : "gap-2"
                    } ${
                      isActive
                        ? "bg-[#2a2a2d] font-medium text-white"
                        : "text-[#bab9bd] hover:translate-x-0.5 hover:bg-white/[0.055] hover:text-white"
                    }`}
                  >
                    <span className="shrink-0 text-[#a3a2a7] group-hover:text-white">
                      {item.icon}
                    </span>
                    {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                    {item.badge && !collapsed && (
                        <span className="shrink-0 rounded bg-[#102c4f] px-1.5 py-0.5 text-[13px] font-medium text-[#1683ff]">
                        {item.badge}
                      </span>
                    )}
                  </Link>
                </div>
              );
          })}
        </nav>
        {!collapsed && (
          <div>
            <p className="px-2.5 pb-2 text-[13px] font-medium uppercase tracking-[0.12em] text-[#707075]">Chats</p>
            <div className="flex flex-col gap-px">
              {recents.map((chat) => (
                <SessionRow
                  key={chat.id}
                  session={chat}
                  active={chat.id === activeId}
                  onDeleted={() => {
                    setHistory((prev) => prev.filter((s) => s.id !== chat.id));
                    deleteSession(chat.id);
                    if (chat.id === activeId) router.push("/dashboard");
                  }}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        ref={profileMenuRef}
        className={`relative shrink-0 border-t border-white/10 p-3 ${collapsed ? "flex flex-col items-center" : ""}`}
      >
        {profileMenuOpen && (
          <div className="absolute bottom-full left-3 right-3 z-50 mb-2 rounded-xl border border-white/10 bg-[#242426] p-1.5 shadow-[0_-16px_40px_-12px_rgba(0,0,0,0.6)]">
            <button
              type="button"
              onClick={() => {
                setProfileMenuOpen(false);
                openSettingsModal("profile");
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[14px] text-white/80 transition-colors hover:bg-white/5 hover:text-white"
            >
              <ProfileIcon className="h-4 w-4" />
              Profile
            </button>
            <Link
              href="/dashboard/usage"
              onClick={() => setProfileMenuOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] text-white/80 transition-colors hover:bg-white/5 hover:text-white"
            >
              <GaugeIcon className="h-4 w-4" />
              Usage
            </Link>
            <Link
              href="/dashboard/notifications"
              onClick={() => setProfileMenuOpen(false)}
              className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-[14px] text-white/80 transition-colors hover:bg-white/5 hover:text-white"
            >
              <BellIcon className="h-4 w-4" />
              Notifications
            </Link>
            <button
              type="button"
              onClick={() => {
                setProfileMenuOpen(false);
                openSettingsModal();
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[14px] text-white/80 transition-colors hover:bg-white/5 hover:text-white"
            >
              <GearIcon className="h-4 w-4" />
              Settings
            </button>
            <div className="my-1 border-t border-white/10" />
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[14px] text-white/80 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-50"
            >
              <LogoutIcon className="h-4 w-4" />
              {signingOut ? "Signing out…" : "Sign out"}
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={() => setProfileMenuOpen((v) => !v)}
          title={collapsed ? "Account" : undefined}
          className={`flex w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-white/5 ${
            collapsed ? "justify-center" : ""
          }`}
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-semibold text-white">
            {initials(session)}
          </span>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-[15px] font-medium text-white">
                {session.name || session.email}
              </p>
              <p className="truncate text-[12px] text-white/40">{session.email}</p>
            </div>
          )}
          {!collapsed && planId && (
            <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-medium text-white/70">
              {PLAN_NAMES[planId] ?? "Free"}
            </span>
          )}
        </button>
      </div>
      </aside>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[15px] font-medium text-white/70">
      {children}
    </p>
  );
}

function SessionRow({
  session,
  active,
  onDeleted,
}: {
  session: ChatSession;
  active: boolean;
  onDeleted: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [menuOpen]);

  async function handleDelete() {
    if (deleting) return;
    setDeleting(true);
    try {
      await fetch(`/api/chat/history/${encodeURIComponent(session.id)}`, { method: "DELETE" });
      onDeleted();
    } finally {
      setDeleting(false);
      setMenuOpen(false);
    }
  }

  return (
    <div
      className={`group relative flex h-[36px] w-full items-center gap-[8px] rounded-[10px] ps-[8px] pe-[2px] text-[14px] transition-colors ${
        active ? "bg-white/10 text-white" : "text-white hover:bg-white/[0.055]"
      }`}
    >
      <Link href={`/dashboard?session=${session.id}`} title={session.title} className="flex min-w-0 flex-1 items-center gap-[8px]">
        <span className="flex size-[20px] shrink-0 items-center justify-center">
          <ChatIcon className="h-[18px] w-[18px] text-white/50" />
        </span>
        <span className="min-w-0 flex-1 truncate">{session.title}</span>
      </Link>
      <div ref={menuRef} className="relative shrink-0">
        <button
          type="button"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Chat options"
          aria-expanded={menuOpen}
          className={`flex items-center justify-center overflow-hidden rounded-[8px] transition-[width,height,background-color] hover:bg-white/10 ${
            menuOpen ? "size-[32px]" : "size-0 group-hover:size-[32px]"
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white/50">
            <circle cx="12" cy="12" r="1" />
            <circle cx="19" cy="12" r="1" />
            <circle cx="5" cy="12" r="1" />
          </svg>
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full z-50 mt-1 w-36 rounded-xl border border-white/10 bg-[#242426] p-1.5 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.6)]">
            <button
              type="button"
              onClick={() => void handleDelete()}
              disabled={deleting}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13px] text-red-400 transition-colors hover:bg-white/5 disabled:opacity-50"
            >
              {deleting ? "Deleting…" : "Delete"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
