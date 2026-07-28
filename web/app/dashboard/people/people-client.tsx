"use client";

import { useEffect, useState } from "react";
import { CreditsBadge } from "../components/CreditsBadge";

type Person = {
  id: string;
  type: "person" | "company";
  canonicalName: string;
  createdAt: string;
  emails: string[];
  phones: string[];
  urls: string[];
  sample?: boolean;
};

type PeopleTab = "all" | "person" | "company";

const TABS: { key: PeopleTab; label: string }[] = [
  { key: "all", label: "All" },
  { key: "person", label: "People" },
  { key: "company", label: "Companies" },
];

function timeAgo(iso: string) {
  const diff = Date.now() - Date.parse(iso);
  const d = Math.floor(diff / 86_400_000);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.floor(d / 7)}w ago`;
  return `${Math.floor(d / 30)}mo ago`;
}

function initial(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const AVATAR_COLORS = [
  "bg-blue-500/20 text-blue-300",
  "bg-violet-500/20 text-violet-300",
  "bg-emerald-500/20 text-emerald-300",
  "bg-amber-500/20 text-amber-300",
  "bg-rose-500/20 text-rose-300",
  "bg-cyan-500/20 text-cyan-300",
];
const FREE_EMAIL_DOMAINS = new Set([
  "aol.com",
  "gmail.com",
  "googlemail.com",
  "hotmail.com",
  "icloud.com",
  "live.com",
  "me.com",
  "msn.com",
  "outlook.com",
  "pm.me",
  "proton.me",
  "protonmail.com",
  "yahoo.com",
  "ymail.com",
  "zoho.com",
]);
const SECOND_LEVEL_TLDS = new Set(["ac", "co", "com", "edu", "gov", "net", "org"]);

function avatarColor(id: string) {
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

export function PeopleClient() {
  const [people, setPeople] = useState<Person[]>([]);
  const [gmailConnected, setGmailConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<PeopleTab>("all");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/people");
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = (await res.json()) as { people?: Person[]; gmailConnected?: boolean };
        setPeople(data.people ?? []);
        setGmailConnected(data.gmailConnected ?? false);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const displayPeople = people
    .filter((person) => person.type === "person")
    .map((person) => ({
      ...person,
      phones: person.phones.filter(isPlausiblePhone),
    }));

  const tabbedPeople =
    activeTab === "all" ? displayPeople : displayPeople.filter((person) => person.type === activeTab);

  const filtered = query.trim()
    ? tabbedPeople.filter(
        (p) =>
          p.canonicalName.toLowerCase().includes(query.toLowerCase()) ||
          p.emails.some((e) => e.toLowerCase().includes(query.toLowerCase())),
      )
    : tabbedPeople;

  const counts: Record<PeopleTab, number> = {
    all: displayPeople.length,
    person: displayPeople.filter((person) => person.type === "person").length,
    company: displayPeople.filter((person) => person.type === "company").length,
  };

  return (
    <main className="min-h-screen bg-[#f8f8f7] text-slate-900">
      {/* Top bar — matches the chat page's sticky chrome */}
      <div className="sticky top-0 z-10 flex h-14 w-full shrink-0 items-center justify-between border-b border-transparent bg-[#f8f8f7] px-4 md:px-6">
        <div className="flex h-8 items-center rounded-lg px-2 text-base font-normal text-slate-900 md:text-lg">
          People
        </div>
        <CreditsBadge />
      </div>

      {/* Header */}
      <header className="border-b border-slate-200 px-4 pt-1 sm:px-6">
        <div className="flex items-center justify-between pb-4">
          <p className="text-[15px] text-slate-500">Everyone Riz has seen in your emails</p>
          {!loading && (
            <span className="rounded-full border border-black/20 bg-white px-3 py-1 text-sm text-slate-500">
              {displayPeople.length} contact{displayPeople.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <SearchIcon />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="h-12 w-full rounded-full border border-black/20 bg-white pl-11 pr-4 text-base text-slate-900 placeholder:text-slate-400 transition focus:border-[#D9BEF4] focus:outline-none"
          />
        </div>

        {/* Tabs — pure bordered pills, matching emails/meetings */}
        <div className="-mx-4 mb-4 flex gap-1.5 overflow-x-auto px-4 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full border px-3.5 py-1.5 text-sm font-normal transition ${
                activeTab === tab.key
                  ? "border-black/20 bg-slate-100 text-black/80"
                  : "border-transparent bg-white text-black/80 hover:border-black/20 hover:bg-slate-50"
              }`}
            >
              {tab.label}
              {!loading && counts[tab.key] > 0 && (
                <span className={`rounded-full px-1.5 py-0.5 text-[11px] leading-none ${
                  activeTab === tab.key ? "bg-white text-black/80" : "bg-slate-100 text-slate-500"
                }`}>
                  {counts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="w-full px-4 py-6 sm:px-6 space-y-6">
        {loading && (
          <div className="flex items-center justify-center gap-3 py-16">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-200 border-t-slate-900" />
            <span className="text-sm text-slate-500">Loading contacts…</span>
          </div>
        )}

        {!loading && error && (
          <div className="border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center border border-slate-200 bg-white">
              <UsersIcon />
            </div>
            <p className="font-medium">{query ? "No matches" : "No contacts yet"}</p>
            <p className="max-w-xs text-sm text-slate-500">
              {query
                ? "Try a different name or email."
                : gmailConnected
                  ? "As Riz processes your emails, real people and companies you correspond with will appear here."
                  : "Connect Gmail to build this list from real email contacts."}
            </p>
          </div>
        )}

        {!loading && !error && filtered.length > 0 && (
          <PeopleTable items={filtered} />
        )}
      </div>
    </main>
  );
}

function PeopleTable({ items }: { items: Person[] }) {
  return (
    <div className="overflow-x-auto bg-white">
      <table className="w-full min-w-[1200px] border-collapse text-left">
        <thead className="bg-white text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500">
          <tr>
            <th className="w-10 px-3 py-3">
              <span className="block h-4 w-4 border border-slate-200" />
            </th>
            <th className="px-4 py-3">Contact name</th>
            <th className="px-4 py-3">First seen</th>
            <th className="px-4 py-3">Company</th>
            <th className="px-4 py-3">Email</th>
            <th className="px-4 py-3">Phone</th>
            <th className="px-4 py-3">LinkedIn</th>
          </tr>
        </thead>
        <tbody>
          {items.map((person) => (
            <PersonRow key={person.id} person={person} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PersonRow({ person }: { person: Person }) {
  const color = avatarColor(person.id);
  const initials = initial(person.canonicalName);
  const primaryEmail = person.emails[0] ?? "";
  const company = person.type === "company" ? person.canonicalName : companyFromEmail(primaryEmail);
  const primaryPhone = person.phones[0] ?? "";
  const linkedinUrl = person.urls.find((u) => u.includes("linkedin.com/in/"));
  const linkedinHandle = linkedinUrl?.replace(/https?:\/\/(?:www\.)?linkedin\.com\/in\//, "").replace(/\/$/, "");

  return (
    <tr className="border-t border-slate-200 bg-white transition hover:bg-slate-50">
      <td className="px-3 py-4 align-middle">
        <span className="block h-4 w-4 border border-slate-200 bg-white" />
      </td>
      <td className="px-4 py-4 align-middle">
        <div className="flex items-center gap-3">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${color}`}>
            {initials}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-slate-900">{person.canonicalName}</p>
              {person.sample ? (
                <span className="shrink-0 border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                  Sample
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-[11px] text-slate-500">{person.type === "company" ? "Company" : "Person"}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 align-middle text-sm text-slate-700">
        <p>{formatContactDate(person.createdAt)}</p>
        <p className="mt-0.5 text-[11px] text-slate-500">{timeAgo(person.createdAt)}</p>
      </td>
      <td className="px-4 py-4 align-middle">
        {company ? (
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-[10px] font-semibold text-slate-600">
              {company.charAt(0).toUpperCase()}
            </span>
            <span className="text-sm text-slate-700">{company}</span>
          </div>
        ) : (
          <p className="text-sm text-slate-400">—</p>
        )}
      </td>
      <td className="px-4 py-4 align-middle">
        {primaryEmail ? (
          <p className="text-sm text-slate-700">{primaryEmail}</p>
        ) : (
          <p className="text-sm text-slate-400">—</p>
        )}
        {person.emails.length > 1 && (
          <p className="mt-0.5 text-[11px] text-slate-400">+{person.emails.length - 1} more</p>
        )}
      </td>
      <td className="px-4 py-4 align-middle">
        {primaryPhone ? (
          <p className="text-sm text-slate-700">{primaryPhone}</p>
        ) : (
          <p className="text-sm text-slate-400">—</p>
        )}
      </td>
      <td className="px-4 py-4 align-middle">
        {linkedinUrl ? (
          <a
            href={linkedinUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-blue-400 hover:text-blue-300 transition-colors"
          >
            <LinkedInIcon />
            <span className="truncate max-w-[120px]">{linkedinHandle}</span>
          </a>
        ) : (
          <p className="text-sm text-slate-400">—</p>
        )}
      </td>
    </tr>
  );
}

function companyFromEmail(email: string) {
  const domain = email.toLowerCase().split("@")[1];
  if (!domain) return undefined;
  const registrable = registrableDomain(domain);
  if (FREE_EMAIL_DOMAINS.has(registrable)) return undefined;
  const name = registrable.split(".")[0] ?? registrable;
  return name
    .split(/[-_]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isPlausiblePhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return false;
  if (/^(\d)\1+$/.test(digits)) return false;
  return true;
}

function registrableDomain(domain: string) {
  const labels = domain.toLowerCase().split(".").filter(Boolean);
  if (labels.length <= 2) return labels.join(".");
  const tld = labels.at(-1);
  const secondLevel = labels.at(-2);
  if (tld?.length === 2 && secondLevel && SECOND_LEVEL_TLDS.has(secondLevel) && labels.length >= 3) {
    return labels.slice(-3).join(".");
  }
  return labels.slice(-2).join(".");
}

function formatContactDate(iso: string) {
  return new Date(iso).toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function SearchIcon() {
  return (
    <svg
      className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
      viewBox="0 0 16 16" fill="none" aria-hidden="true"
    >
      <circle cx="7" cy="7" r="4.5" stroke="currentColor" strokeWidth="1.4" />
      <path d="M13 13l-2.6-2.6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  );
}

function LinkedInIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="currentColor" className="h-3.5 w-3.5 shrink-0" aria-hidden="true">
      <path d="M3.6 2C2.7 2 2 2.7 2 3.6c0 .9.7 1.6 1.6 1.6.9 0 1.6-.7 1.6-1.6C5.2 2.7 4.5 2 3.6 2zM2.2 6h2.8v8H2.2V6zm4.3 0h2.7v1.1h.04c.37-.7 1.28-1.44 2.64-1.44C14.18 5.67 14.8 7.3 14.8 9.6V14h-2.8v-4c0-1-.02-2.28-1.39-2.28-1.39 0-1.6 1.09-1.6 2.21V14H6.5V6z" />
    </svg>
  );
}

function UsersIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-slate-400" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
