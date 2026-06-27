"use client";

import { useEffect, useState } from "react";

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

const SAMPLE_PEOPLE: Person[] = [
  {
    id: "sample-person-arjun",
    type: "person",
    canonicalName: "Arjun Mehta",
    createdAt: daysAgo(1),
    emails: ["arjun@northstar.vc"],
    phones: ["+91 98765 43210"],
    urls: ["https://linkedin.com/in/arjunmehta"],
    sample: true,
  },
  {
    id: "sample-person-maya",
    type: "person",
    canonicalName: "Maya Kapoor",
    createdAt: daysAgo(3),
    emails: ["maya@ledgerflow.io"],
    phones: [],
    urls: ["https://linkedin.com/in/mayakapoor"],
    sample: true,
  },
  {
    id: "sample-person-sarah",
    type: "person",
    canonicalName: "Sarah Chen",
    createdAt: daysAgo(8),
    emails: ["sarah@brightdesk.co"],
    phones: ["+1 415 555 0192"],
    urls: [],
    sample: true,
  },
  {
    id: "sample-company-ledgerflow",
    type: "company",
    canonicalName: "LedgerFlow",
    createdAt: daysAgo(2),
    emails: ["billing@ledgerflow.io"],
    phones: [],
    urls: [],
    sample: true,
  },
  {
    id: "sample-company-northstar",
    type: "company",
    canonicalName: "Northstar Ventures",
    createdAt: daysAgo(6),
    emails: ["team@northstar.vc"],
    phones: [],
    urls: [],
    sample: true,
  },
];

function daysAgo(days: number) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function avatarColor(id: string) {
  let n = 0;
  for (let i = 0; i < id.length; i++) n = (n * 31 + id.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[n % AVATAR_COLORS.length];
}

export function PeopleClient() {
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<PeopleTab>("all");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/people");
        if (!res.ok) throw new Error(`Error ${res.status}`);
        const data = (await res.json()) as { people?: Person[] };
        setPeople(data.people ?? []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const displayPeople = people.length > 0 ? people : SAMPLE_PEOPLE;

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
    <main className="min-h-screen bg-[#1a1a19] text-[#f2f1ec]">
      {/* Header */}
      <header className="px-6 pt-5">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold tracking-tight">People</h1>
            <p className="mt-0.5 text-sm text-white/55">Everyone Riz has seen in your emails</p>
          </div>
          {!loading && (
            <span className="border border-[#2e2e2c] px-3 py-1 text-sm text-white/55">
              {displayPeople.length} contact{displayPeople.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

        {/* Search */}
        <div className="relative mt-4 mb-3">
          <SearchIcon />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name or email…"
            className="w-full border border-[#2e2e2c] bg-[#1f1f1e] py-2.5 pl-9 pr-4 text-sm text-[#f2f1ec] placeholder:text-white/45 focus:border-[#3e3e3c] focus:outline-none"
          />
        </div>

        <div className="flex gap-0 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              onClick={() => setActiveTab(tab.key)}
              className={`-mb-px flex shrink-0 items-center gap-1.5 px-4 py-2.5 text-sm font-medium transition ${
                activeTab === tab.key
                  ? "bg-[#242422] text-[#f2f1ec]"
                  : "text-white/55 hover:bg-[#20201f] hover:text-white/65"
              }`}
            >
              {tab.label}
              {!loading && counts[tab.key] > 0 && (
                <span className={`px-1.5 py-0.5 text-[11px] leading-none ${
                  activeTab === tab.key ? "bg-[#f2f1ec]/15 text-[#f2f1ec]" : "bg-[#2e2e2c] text-white/55"
                }`}>
                  {counts[tab.key]}
                </span>
              )}
            </button>
          ))}
        </div>
      </header>

      <div className="w-full px-6 py-6 space-y-6">
        {loading && (
          <div className="flex items-center justify-center gap-3 py-16">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#2e2e2c] border-t-[#f2f1ec]" />
            <span className="text-sm text-white/55">Loading contacts…</span>
          </div>
        )}

        {!loading && error && (
          <div className="border border-red-500/20 bg-red-500/5 px-5 py-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && filtered.length === 0 && (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <div className="flex h-12 w-12 items-center justify-center border border-[#2e2e2c] bg-[#1f1f1e]">
              <UsersIcon />
            </div>
            <p className="font-medium">{query ? "No matches" : "No contacts yet"}</p>
            <p className="max-w-xs text-sm text-white/55">
              {query
                ? "Try a different name or email."
                : "As Riz processes your emails, everyone you correspond with will appear here."}
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
    <div className="overflow-x-auto bg-[#1f1f1e]">
      <table className="w-full min-w-[1200px] border-collapse text-left">
        <thead className="bg-[#1a1a19] text-[11px] font-semibold uppercase tracking-[0.08em] text-white/55">
          <tr>
            <th className="w-10 px-3 py-3">
              <span className="block h-4 w-4 border border-[#2e2e2c]" />
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
    <tr className="border-t border-[#2e2e2c] bg-[#1f1f1e] transition hover:bg-[#242422]">
      <td className="px-3 py-4 align-middle">
        <span className="block h-4 w-4 border border-[#343431] bg-[#1a1a19]" />
      </td>
      <td className="px-4 py-4 align-middle">
        <div className="flex items-center gap-3">
          <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[12px] font-semibold ${color}`}>
            {initials}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-medium text-[#f2f1ec]">{person.canonicalName}</p>
              {person.sample ? (
                <span className="shrink-0 border border-amber-500/20 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-amber-300">
                  Sample
                </span>
              ) : null}
            </div>
            <p className="mt-0.5 text-[11px] text-white/55">{person.type === "company" ? "Company" : "Person"}</p>
          </div>
        </div>
      </td>
      <td className="px-4 py-4 align-middle text-sm text-white/80">
        <p>{formatContactDate(person.createdAt)}</p>
        <p className="mt-0.5 text-[11px] text-white/55">{timeAgo(person.createdAt)}</p>
      </td>
      <td className="px-4 py-4 align-middle">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#2a2a28] text-[10px] font-semibold text-white/65">
            {company.charAt(0).toUpperCase()}
          </span>
          <span className="text-sm text-white/80">{company}</span>
        </div>
      </td>
      <td className="px-4 py-4 align-middle">
        {primaryEmail ? (
          <p className="text-sm text-white/80">{primaryEmail}</p>
        ) : (
          <p className="text-sm text-white/25">—</p>
        )}
        {person.emails.length > 1 && (
          <p className="mt-0.5 text-[11px] text-white/40">+{person.emails.length - 1} more</p>
        )}
      </td>
      <td className="px-4 py-4 align-middle">
        {primaryPhone ? (
          <p className="text-sm text-white/80">{primaryPhone}</p>
        ) : (
          <p className="text-sm text-white/25">—</p>
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
          <p className="text-sm text-white/25">—</p>
        )}
      </td>
    </tr>
  );
}

function companyFromEmail(email: string) {
  const domain = email.split("@")[1];
  if (!domain) return "Unknown";
  const name = domain.split(".")[0] ?? domain;
  return name
    .split(/[-_]/)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
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
      className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/45"
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
    <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/45" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}
