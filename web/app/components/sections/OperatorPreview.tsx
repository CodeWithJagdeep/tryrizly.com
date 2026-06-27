'use client';

import { useState } from 'react';
import { Reveal } from '../Reveal';

type DashTab = 'chat' | 'approvals' | 'emails' | 'people' | 'calendar';

function ChatIcon({ cls = '' }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={`h-3.5 w-3.5 ${cls}`} strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 10.667A1.333 1.333 0 0 1 12.667 12H4.667L2 14.667V3.333A1.333 1.333 0 0 1 3.333 2h9.334A1.333 1.333 0 0 1 14 3.333v7.334Z" />
    </svg>
  );
}

function CheckIcon({ cls = '' }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={`h-3.5 w-3.5 ${cls}`} strokeLinecap="round" strokeLinejoin="round">
      <path d="M13.333 4 6 11.333 2.667 8" />
    </svg>
  );
}

function MailIcon({ cls = '' }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={`h-3.5 w-3.5 ${cls}`} strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.333" y="3.333" width="13.333" height="9.333" rx="1.333" />
      <path d="m1.333 4 6.667 5 6.667-5" />
    </svg>
  );
}

function UsersIcon({ cls = '' }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={`h-3.5 w-3.5 ${cls}`} strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.333 14v-1.333A2.667 2.667 0 0 0 8.667 10H3.333A2.667 2.667 0 0 0 .667 12.667V14M6 7.333A2.667 2.667 0 1 0 6 2a2.667 2.667 0 0 0 0 5.333ZM15.333 14v-1.333a2.667 2.667 0 0 0-2-2.58M10.667 2.087a2.667 2.667 0 0 1 0 5.16" />
    </svg>
  );
}

function CalendarIcon({ cls = '' }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" className={`h-3.5 w-3.5 ${cls}`} strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.333" y="2" width="13.333" height="12.667" rx="1.333" />
      <path d="M10.667 1.333V2.667M5.333 1.333V2.667M1.333 5.333h13.334" />
    </svg>
  );
}

const sidebarNav = [
  { id: 'chat' as DashTab, label: 'Chat', Icon: ChatIcon },
  { id: 'approvals' as DashTab, label: 'Approvals', Icon: CheckIcon, badge: '3' },
  { id: 'emails' as DashTab, label: 'Emails', Icon: MailIcon, badge: '7' },
  { id: 'people' as DashTab, label: 'People', Icon: UsersIcon },
  { id: 'calendar' as DashTab, label: 'Calendar', Icon: CalendarIcon },
];

function ChatPanel() {
  const messages = [
    { from: 'user', text: "What do I have tomorrow morning?" },
    { from: 'riz', text: "Tomorrow at 10 AM you have the Series A call with Markus from Gradient Ventures. I've already prepped your packet:\n\n• ARR $84.2k (+8.4% WoW)\n• Churn: 2.3%\n• Runway: 18 months\n• Last email thread linked to the calendar hold.\n\nWant me to draft an opening message to send beforehand?" },
    { from: 'user', text: "Yes, draft one." },
    { from: 'riz', text: 'Draft ready. Friendly, references your last conversation, and mentions you\'re looking forward to the update. Approve to send?' },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
            {msg.from === 'riz' && (
              <div className="mr-2 mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#3784ff] text-[10px] font-bold text-white">R</div>
            )}
            <div className={`max-w-[80%] rounded-xl px-3.5 py-2.5 text-[13px] leading-relaxed whitespace-pre-line ${
              msg.from === 'user'
                ? 'rounded-tr-sm bg-white/[0.08] text-[#f2f1ec]'
                : 'rounded-tl-sm bg-[#222220] text-[#d4d3cc]'
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-white/[0.06] px-3 py-3">
        <div className="flex items-center gap-2 rounded-lg border border-white/[0.08] bg-white/[0.04] px-3.5 py-2.5">
          <span className="flex-1 text-[13px] text-[#5a5a55]">Ask Riz anything...</span>
          <div className="flex h-6 w-6 items-center justify-center rounded-md bg-[#3784ff]">
            <svg className="h-3 w-3 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
          </div>
        </div>
      </div>
    </div>
  );
}

function ApprovalsPanel() {
  const [done, setDone] = useState<number[]>([]);

  const items = [
    { id: 0, label: 'Reply to Markus re: Series A', detail: "Confirming Tuesday 10 AM and attaching prep notes.", priority: 'High' },
    { id: 1, label: 'Send renewal nudge to Acme Corp', detail: "Champion hasn't replied in 6 days. Nudge drafted.", priority: 'Medium' },
    { id: 2, label: 'Archive 4 newsletter threads', detail: "Substack, Product Hunt, TechCrunch, Hacker News digests.", priority: 'Low' },
  ];

  const priorityCls = { High: 'bg-rose-500/15 text-rose-300 border-rose-500/25', Medium: 'bg-amber-500/15 text-amber-300 border-amber-500/25', Low: 'bg-slate-500/15 text-slate-300 border-slate-500/25' } as const;

  return (
    <div className="px-4 py-4 space-y-3">
      {items.map((item) =>
        done.includes(item.id) ? null : (
          <div key={item.id} className="rounded-xl border border-white/[0.07] bg-[#222220] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-[#f2f1ec]">{item.label}</p>
                <p className="mt-1 text-[12px] text-[#6b6b63] leading-snug">{item.detail}</p>
              </div>
              <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${priorityCls[item.priority as keyof typeof priorityCls]}`}>
                {item.priority}
              </span>
            </div>
            <div className="mt-3 flex gap-2">
              <button onClick={() => setDone((p) => [...p, item.id])} className="rounded-lg bg-[#3784ff] px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#2c72e5]">
                Approve
              </button>
              <button onClick={() => setDone((p) => [...p, item.id])} className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-[12px] font-semibold text-[#8a8a80] transition hover:bg-white/[0.04]">
                Reject
              </button>
              <button className="rounded-lg border border-white/[0.08] px-3 py-1.5 text-[12px] font-semibold text-[#8a8a80] transition hover:bg-white/[0.04]">
                Edit
              </button>
            </div>
          </div>
        )
      )}
      {done.length === items.length && (
        <div className="flex flex-col items-center gap-2 py-8 text-center">
          <svg className="h-8 w-8 text-emerald-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="M22 4 12 14.01l-3-3"/></svg>
          <p className="text-[14px] font-semibold text-[#f2f1ec]">All caught up</p>
          <p className="text-[12px] text-[#6b6b63]">Riz is monitoring for new actions</p>
        </div>
      )}
    </div>
  );
}

function EmailsPanel() {
  const emails = [
    { from: 'Markus, Gradient Ventures', subject: 'Series A - lock Tuesday AM?', category: 'Fundraising', time: 'Now', priority: true },
    { from: 'Acme Corp', subject: 'Contract renewal coming up - quick call?', category: 'Renewal risk', time: '2h ago', priority: false },
    { from: 'Stripe', subject: 'Your April revenue report is ready', category: 'Business', time: '9:30 AM', priority: false },
    { from: 'Product Hunt', subject: 'Top launches of the week', category: 'Noise', time: '8:15 AM', muted: true, priority: false },
    { from: 'Notion', subject: 'Weekly workspace summary', category: 'Noise', time: 'Yesterday', muted: true, priority: false },
  ];

  const catCls: Record<string, string> = {
    'Fundraising': 'bg-blue-500/15 text-blue-300 border-blue-500/25',
    'Renewal risk': 'bg-amber-500/15 text-amber-300 border-amber-500/25',
    'Business': 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25',
    'Noise': 'bg-white/[0.05] text-[#5a5a55] border-white/[0.06]',
  };

  return (
    <div className="px-4 py-4 space-y-2">
      {emails.map((email, i) => (
        <div key={i} className={`flex items-center gap-3 rounded-xl border border-white/[0.06] p-3.5 ${email.muted ? 'opacity-45' : 'bg-[#1f1f1e]'}`}>
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${email.priority ? 'bg-[#3784ff] text-white' : 'bg-white/[0.06] text-[#8a8a80]'}`}>
            {email.from[0]}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <p className={`truncate text-[13px] font-semibold ${email.muted ? 'text-[#5a5a55]' : 'text-[#f2f1ec]'}`}>{email.from}</p>
              <span className="shrink-0 text-[10px] text-[#5a5a55]">{email.time}</span>
            </div>
            <p className={`mt-0.5 truncate text-[12px] ${email.muted ? 'text-[#4a4a45]' : 'text-[#8a8a80]'}`}>{email.subject}</p>
          </div>
          <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${catCls[email.category] ?? ''}`}>
            {email.category}
          </span>
        </div>
      ))}
    </div>
  );
}

function PeoplePanel() {
  const people = [
    { name: 'Markus Henning', role: 'Partner, Gradient Ventures', signal: 'Fundraising', signalCls: 'bg-blue-500/15 text-blue-300 border-blue-500/25', last: 'Today', threads: 4 },
    { name: 'Priya Kumar', role: 'Head of Eng, Acme Corp', signal: 'Renewal risk', signalCls: 'bg-amber-500/15 text-amber-300 border-amber-500/25', last: '7 days ago', threads: 2 },
    { name: 'Rohan Das', role: 'CTO, Beta Co', signal: 'Partnership', signalCls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25', last: '3 days ago', threads: 1 },
    { name: 'Sarah Lin', role: 'Recruiter, TopTalent', signal: 'Hiring', signalCls: 'bg-violet-500/15 text-violet-300 border-violet-500/25', last: '2 days ago', threads: 3 },
  ];

  return (
    <div className="px-4 py-4 space-y-2">
      {people.map((p) => (
        <div key={p.name} className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-[#1f1f1e] p-3.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#2a2a28] text-[13px] font-bold text-[#8a8a80]">
            {p.name[0]}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-[#f2f1ec]">{p.name}</p>
            <p className="mt-0.5 truncate text-[11px] text-[#6b6b63]">{p.role}</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold ${p.signalCls}`}>{p.signal}</span>
            <span className="text-[10px] text-[#5a5a55]">Last: {p.last}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function CalendarPanel() {
  const events = [
    { time: 'Today', title: 'Product sync', detail: 'No prep needed', status: null, statusCls: '' },
    { time: 'Tue 10:00', title: 'Series A call — Markus', detail: 'Prep packet ready: ARR, churn, runway, last thread', status: 'Protected', statusCls: 'bg-[#3784ff]/15 text-[#5fa3ff] border-[#3784ff]/25' },
    { time: 'Tue 15:30', title: 'Design review', detail: 'Flagged movable - may conflict with investor call', status: 'Movable', statusCls: 'bg-amber-500/15 text-amber-300 border-amber-500/25' },
    { time: 'Wed 14:00', title: 'Team all-hands', detail: 'Recurring weekly - no prep needed', status: null, statusCls: '' },
    { time: 'Thu 11:00', title: 'Acme renewal call', detail: 'Account health brief prepared - churn risk flagged', status: 'Prep ready', statusCls: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/25' },
  ];

  return (
    <div className="px-4 py-4 space-y-2">
      {events.map((event, i) => (
        <div key={i} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-[#1f1f1e] p-3.5">
          <div className="mt-0.5 min-w-[64px] shrink-0">
            <p className="text-[11px] font-semibold text-[#3784ff]">{event.time}</p>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-[#f2f1ec]">{event.title}</p>
            <p className="mt-0.5 text-[11px] leading-snug text-[#6b6b63]">{event.detail}</p>
          </div>
          {event.status && (
            <span className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-semibold ${event.statusCls}`}>
              {event.status}
            </span>
          )}
        </div>
      ))}
    </div>
  );
}

const panelLabels: Record<DashTab, { title: string; sub: string }> = {
  chat: { title: 'Chat with Riz', sub: 'Ask anything about your business' },
  approvals: { title: 'Pending Approvals', sub: '3 actions waiting for you' },
  emails: { title: 'Email Triage', sub: 'Processed and categorised by Riz' },
  people: { title: 'People', sub: 'Tracked contacts and relationship signals' },
  calendar: { title: 'Calendar', sub: 'Protected time and prep packets' },
};

export function OperatorPreview() {
  const [activeTab, setActiveTab] = useState<DashTab>('approvals');

  return (
    <section className="bg-black py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="font-neue-haas max-w-xl text-3xl font-normal tracking-tight text-white md:text-4xl">
            Your whole ops stack, inside one dashboard.
          </h2>
          <p className="mt-3 max-w-lg text-base leading-relaxed text-slate-400">
            Chat with Riz, approve pending actions, review email triage, track your people, and manage your calendar - all in one place.
          </p>
        </Reveal>

        <div className="relative mt-10">
          <div className="pointer-events-none absolute -inset-x-8 -inset-y-8 rounded-[2rem] bg-[#3784ff]/6 blur-3xl" aria-hidden="true" />
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-[#1a1a19] shadow-[0_40px_100px_-40px_rgba(0,0,0,1)]" style={{ minHeight: '520px' }}>
            <div className="flex h-full divide-x divide-white/[0.05]">
              {/* Sidebar */}
              <aside className="hidden w-52 shrink-0 flex-col bg-[#1a1a1a] sm:flex">
                {/* Workspace header */}
                <div className="flex h-12 items-center gap-2.5 px-3.5 border-b border-white/[0.05]">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#3784ff] text-[11px] font-bold text-white">J</span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-white leading-none">Jagdeep</p>
                    <p className="mt-0.5 text-[10px] text-white/25 leading-none">HeyRiz workspace</p>
                  </div>
                </div>

                {/* Nav */}
                <nav className="flex-1 px-2 py-3 space-y-0.5">
                  <p className="mb-1 px-2 pt-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-white/25">Main</p>
                  {sidebarNav.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setActiveTab(item.id)}
                        className={`flex w-full items-center justify-between rounded-md px-2.5 py-1.5 text-[13px] transition-colors text-left ${
                          isActive
                            ? 'bg-white/[0.07] text-white'
                            : 'text-white/70 hover:bg-white/[0.04] hover:text-white'
                        }`}
                      >
                        <span className="flex items-center gap-2">
                          <item.Icon cls={isActive ? 'text-white/60' : 'text-white/30'} />
                          {item.label}
                        </span>
                        {item.badge && (
                          <span className="rounded-sm bg-white/10 px-1.5 py-0.5 text-[10px] font-medium text-white/50">{item.badge}</span>
                        )}
                      </button>
                    );
                  })}
                </nav>

                {/* Footer */}
                <div className="border-t border-white/[0.05] px-3 py-3">
                  <p className="truncate text-[11px] text-white/25">jagdeep@heyriz.co</p>
                </div>
              </aside>

              {/* Mobile tab bar */}
              <div className="flex w-full flex-col sm:hidden">
                <div className="flex overflow-x-auto border-b border-white/[0.05]">
                  {sidebarNav.map((item) => {
                    const isActive = activeTab === item.id;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`flex shrink-0 items-center gap-1.5 px-4 py-3 text-[12px] font-medium transition-colors ${
                          isActive ? 'border-b-2 border-[#3784ff] text-white' : 'text-white/50'
                        }`}
                      >
                        <item.Icon cls={isActive ? 'text-white/80' : 'text-white/30'} />
                        {item.label}
                        {item.badge && (
                          <span className="rounded-sm bg-white/10 px-1 text-[10px] text-white/50">{item.badge}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Main content */}
              <div className="hidden min-w-0 flex-1 flex-col sm:flex">
                {/* Content header */}
                <div className="flex h-12 items-center gap-3 border-b border-white/[0.05] px-5">
                  <div>
                    <p className="text-[14px] font-semibold text-[#f2f1ec] leading-none">{panelLabels[activeTab].title}</p>
                    <p className="mt-0.5 text-[11px] text-[#6b6b63] leading-none">{panelLabels[activeTab].sub}</p>
                  </div>
                </div>

                {/* Panel - scrollable */}
                <div className="min-h-0 flex-1 overflow-y-auto" style={{ maxHeight: '460px' }}>
                  {activeTab === 'chat' && <ChatPanel />}
                  {activeTab === 'approvals' && <ApprovalsPanel />}
                  {activeTab === 'emails' && <EmailsPanel />}
                  {activeTab === 'people' && <PeoplePanel />}
                  {activeTab === 'calendar' && <CalendarPanel />}
                </div>
              </div>

              {/* Mobile content */}
              <div className="flex-1 overflow-y-auto sm:hidden" style={{ maxHeight: '420px' }}>
                {activeTab === 'chat' && <ChatPanel />}
                {activeTab === 'approvals' && <ApprovalsPanel />}
                {activeTab === 'emails' && <EmailsPanel />}
                {activeTab === 'people' && <PeoplePanel />}
                {activeTab === 'calendar' && <CalendarPanel />}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
