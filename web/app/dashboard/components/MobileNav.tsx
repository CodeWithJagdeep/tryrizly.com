"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarIcon, ChatIcon, CheckCircleIcon, MailIcon, LayersIcon } from "./icons";
import { toggleSidebar } from "../lib/sidebar-store";

const items = [
  { href: "/dashboard", icon: ChatIcon, label: "Chat" },
  { href: "/dashboard/approvals", icon: CheckCircleIcon, label: "Approvals" },
  { href: "/dashboard/emails", icon: MailIcon, label: "Emails" },
  { href: "/dashboard/calendar", icon: CalendarIcon, label: "Calendar" },
];

export function MobileNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white pb-[env(safe-area-inset-bottom)] lg:hidden">
      <div className="grid grid-cols-5">
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
              className={`flex flex-col items-center gap-1 py-2 text-[10px] font-medium ${
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
          className="flex flex-col items-center gap-1 py-2 text-[10px] font-medium text-slate-500"
        >
          <LayersIcon className="h-5 w-5" />
          Menu
        </button>
      </div>
    </nav>
  );
}
