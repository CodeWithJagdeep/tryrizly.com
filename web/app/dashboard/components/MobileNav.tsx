"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, ChatIcon, CheckCircleIcon, MailIcon, LayersIcon, VideoIcon } from "./icons";
import { toggleSidebar } from "../lib/sidebar-store";

const items = [
  { href: "/dashboard", icon: ChatIcon, label: "Chat" },
  { href: "/dashboard/approvals", icon: CheckCircleIcon, label: "Approvals" },
  { href: "/dashboard/emails", icon: MailIcon, label: "Emails" },
  { href: "/dashboard/calendar", icon: CalendarIcon, label: "Calendar" },
  { href: "/dashboard/meetings", icon: VideoIcon, label: "Meetings" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] lg:hidden">
      <div className="pointer-events-auto grid w-full max-w-sm grid-cols-5 rounded-full border border-slate-200 bg-white/95 px-2 shadow-[0_8px_30px_-8px_rgba(15,23,42,0.35)] backdrop-blur">
        {items.map((item) => {
          const isActive =
            item.href === "/dashboard"
              ? pathname === "/dashboard"
              : pathname.startsWith(item.href);
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 rounded-full py-2.5 text-[10px] font-medium ${
                isActive ? "text-[#FE7F2D]" : "text-slate-500"
              }`}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          );
        })}
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex flex-col items-center gap-0.5 rounded-full py-2.5 text-[10px] font-medium text-slate-500"
        >
          <LayersIcon className="h-5 w-5" />
          Menu
        </button>
      </div>
    </nav>
  );
}
