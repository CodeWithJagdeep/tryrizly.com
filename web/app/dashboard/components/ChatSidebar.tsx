"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TelegramIcon } from "../../components/ConnectorIcons";
import {
  BellIcon,
  CalendarIcon,
  ChatIcon,
  CheckCircleIcon,
  ClockIcon,
  GearIcon,
  LogoutIcon,
  MailIcon,
  PlugIcon,
  PlusIcon,
  UsersIcon,
  VideoIcon,
} from "./icons";
import {
  type ChatSession,
  getSessions,
  subscribeToOpenSearch,
  subscribeToSessions,
} from "../lib/chat-store";
import { isSidebarOpen, setSidebarOpen, subscribeToSidebar } from "../lib/sidebar-store";

export function ChatSidebar({
  name,
  email,
}: {
  name?: string;
  email: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeId = pathname === "/dashboard" ? searchParams.get("session") : null;

  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [approvalCount, setApprovalCount] = useState(0);
  const [telegramLinked, setTelegramLinked] = useState(true);
  const [signingOut, setSigningOut] = useState(false);
  const [emailBadge, setEmailBadge] = useState(0);
  const [mobileOpen, setMobileOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const sync = () => setMobileOpen(isSidebarOpen());
    sync();
    return subscribeToSidebar(sync);
  }, []);

  // Close the mobile drawer whenever navigation happens.
  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname, activeId]);

  useEffect(() => {
    const sync = () => setSessions(getSessions());
    sync();
    const unsubSessions = subscribeToSessions(sync);
    const unsubSearch = subscribeToOpenSearch(() => setSearchOpen(true));
    return () => { unsubSessions(); unsubSearch(); };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/approvals");
        if (!res.ok || cancelled) return;
        const data = (await res.json()) as { approvals?: unknown[] };
        if (!cancelled) setApprovalCount(data.approvals?.length ?? 0);
      } catch { /* best-effort */ }
    };
    void load();
    const t = setInterval(load, 30_000);
    return () => { cancelled = true; clearInterval(t); };
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
    fetch("/api/onboarding/status")
      .then((r) => r.json())
      .then((d: { onboarding?: { telegramLinked?: boolean } }) => {
        setTelegramLinked(Boolean(d.onboarding?.telegramLinked));
      })
      .catch(() => null);
  }, []);

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus();
  }, [searchOpen]);

  const filtered = query.trim()
    ? sessions.filter((s) => s.title.toLowerCase().includes(query.trim().toLowerCase()))
    : sessions;
  const favorites = filtered.filter((s) => s.favorite);
  const recents = filtered.filter((s) => !s.favorite).slice(0, 15);

  const displayName = name || email.split("@")[0];
  const initial = displayName.charAt(0).toUpperCase();

  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  useEffect(() => {
    fetch("/api/preferences")
      .then((r) => r.json())
      .then((d: { avatarUrl?: string }) => { if (d.avatarUrl) setAvatarUrl(d.avatarUrl); })
      .catch(() => null);
  }, []);

  function handleNewChat() {
    setQuery("");
    setSearchOpen(false);
    router.push("/dashboard");
  }

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try { await fetch("/api/auth/logout", { method: "POST" }); }
    finally { router.push("/login"); router.refresh(); }
  }

  const navSections = [
    {
      label: "Main",
      items: [
        { href: "/dashboard", icon: <ChatIcon className="h-4 w-4" />, label: "Chat" },
        { href: "/dashboard/approvals", icon: <CheckCircleIcon className="h-4 w-4" />, label: "Approvals", badge: approvalCount > 0 ? String(approvalCount) : undefined },
        { href: "/dashboard/emails", icon: <MailIcon className="h-4 w-4" />, label: "Emails", badge: emailBadge > 0 ? String(emailBadge) : undefined },
        { href: "/dashboard/people", icon: <UsersIcon className="h-4 w-4" />, label: "People" },
        { href: "/dashboard/calendar", icon: <CalendarIcon className="h-4 w-4" />, label: "Calendar" },
        { href: "/dashboard/meetings", icon: <VideoIcon className="h-4 w-4" />, label: "Meetings" },
        { href: "/dashboard/connectors", icon: <PlugIcon className="h-4 w-4" />, label: "Connectors" },
      ],
    },
    {
      label: "Settings",
      items: [
        { href: "/dashboard/scheduled", icon: <ClockIcon className="h-4 w-4" />, label: "Scheduled" },
        { href: "/dashboard/notifications", icon: <BellIcon className="h-4 w-4" />, label: "Notifications" },
        { href: "/dashboard/telegram", icon: <TelegramIcon className="h-4 w-4" />, label: "Telegram", badge: !telegramLinked ? "!" : undefined },
        { href: "/dashboard/settings", icon: <GearIcon className="h-4 w-4" />, label: "Settings" },
      ],
    },
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
        className={`fixed bottom-0 left-0 top-0 z-50 flex w-72 max-w-[85vw] flex-col border-r border-slate-200 bg-white transition-transform duration-200 lg:top-14 lg:z-auto lg:w-64 lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >

      {/* Header */}
      <div className="flex h-14 shrink-0 items-center justify-between px-4">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[#FE7F2D] text-[13px] font-semibold text-white">
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatarUrl} alt={displayName} className="h-full w-full object-cover" />
            ) : initial}
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold text-slate-900 leading-none">
              {displayName}
            </p>
            <p className="truncate text-[11px] text-slate-400 leading-none mt-0.5">
              rizly workspace
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={handleSignOut}
          disabled={signingOut}
          title="Sign out"
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 disabled:opacity-40"
        >
          <LogoutIcon className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* New chat button — prominent orange CTA */}
      <div className="shrink-0 px-3 pb-3">
        <button
          type="button"
          onClick={handleNewChat}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[#FE7F2D] px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:brightness-105 active:scale-[0.99]"
        >
          <PlusIcon className="h-4 w-4" />
          New chat
        </button>
      </div>

      {/* Search */}
      {searchOpen && (
        <div className="shrink-0 px-3 pb-3">
          <input
            ref={searchInputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats…"
            className="w-full rounded-md border border-slate-200 bg-white px-3 py-1.5 text-[15px] text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#FE7F2D]/30"
          />
        </div>
      )}

      {/* Scrollable nav */}
      <div className="min-h-0 flex-1 overflow-y-auto px-2">

        {/* Static nav sections */}
        {navSections.map((section) => (
          <div key={section.label} className="mb-4">
            <SectionLabel>{section.label}</SectionLabel>
            {section.items.map((item) => {
              const isActive = item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`group flex items-center justify-between rounded-md px-2.5 py-1.5 text-[15px] transition-colors ${
                    isActive
                      ? "bg-[#FE7F2D]/10 font-medium text-slate-900"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <span className={isActive ? "text-[#FE7F2D]" : "text-slate-400 group-hover:text-slate-600"}>
                      {item.icon}
                    </span>
                    {item.label}
                  </span>
                  {item.badge && (
                    <span className="rounded-sm bg-[#FE7F2D]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#FE7F2D]">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}

        {/* Chat history */}
        {(favorites.length > 0 || sessions.length > 0) && (
          <div className="mb-4">
            {favorites.length > 0 && (
              <>
                <SectionLabel>Favorites</SectionLabel>
                {favorites.map((s) => (
                  <SessionRow key={s.id} session={s} active={s.id === activeId} />
                ))}
              </>
            )}
            <SectionLabel>Recent</SectionLabel>
            {recents.length ? (
              recents.map((s) => (
                <SessionRow key={s.id} session={s} active={s.id === activeId} />
              ))
            ) : (
                <p className="px-2.5 py-1 text-[13px] text-slate-400">
                {query.trim() ? "No results" : "No chats yet"}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="shrink-0 border-t border-slate-200 px-3 py-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[11px] font-medium text-slate-600">
            {initial}
          </span>
          <span className="truncate text-[13px] text-slate-400">{email}</span>
        </div>
      </div>
      </aside>
    </>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-0.5 px-2.5 pt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-400">
      {children}
    </p>
  );
}

function SessionRow({ session, active }: { session: ChatSession; active: boolean }) {
  return (
    <Link
      href={`/dashboard?session=${session.id}`}
      className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[15px] transition-colors ${
        active ? "bg-slate-100 text-slate-900" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
      }`}
    >
      <ChatIcon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      <span className="truncate">{session.title}</span>
    </Link>
  );
}
