import { TelegramIcon } from '../ConnectorIcons';
import { Reveal } from '../Reveal';

function MiniInboxRow({ sender, subject, active, muted }: { sender: string; subject: string; active?: boolean; muted?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg border p-2.5 transition ${
        active ? 'border-[#3784ff]/30 bg-[#3784ff]/8' : 'border-slate-200 bg-white'
      } ${muted ? 'opacity-45' : ''}`}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-[11px] font-bold ${
          active ? 'bg-[#3784ff] text-white' : 'bg-slate-100 text-slate-500'
        }`}
      >
        {sender[0]}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[12px] font-semibold text-slate-950">{sender}</p>
        <p className="truncate text-[11px] text-slate-500">{subject}</p>
      </div>
      {active && (
        <span className="shrink-0 rounded-md border border-[#3784ff]/30 bg-[#3784ff]/10 px-1.5 py-0.5 text-[10px] font-semibold text-[#3784ff]">
          Priority
        </span>
      )}
    </div>
  );
}

export function FeatureBento() {
  return (
    <section className="bg-white py-20 md:py-28">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="font-neue-haas max-w-xl text-3xl font-normal tracking-tight text-[#0f172a] md:text-4xl">
            One operator, watching everything you&apos;d rather not.
          </h2>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {/* Inbox triage - wide card */}
          <Reveal delay={0.05} className="md:col-span-2">
            <div className="flex h-full flex-col justify-between gap-6 rounded-xl border border-slate-200 bg-gradient-to-br from-[#3784ff]/[0.07] to-slate-50/60 p-6 md:flex-row md:items-center md:p-8">
              <div className="max-w-sm">
                <h3 className="text-xl font-semibold text-slate-950">Inbox triage that actually reads the email</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Newsletters get archived on sight. The investor reply gets a Telegram ping before you&apos;ve opened your laptop.
                </p>
              </div>
              <div className="w-full max-w-xs space-y-2 md:max-w-[240px]">
                <MiniInboxRow sender="Product Hunt" subject="Top launches of the day" muted />
                <MiniInboxRow sender="Markus, Investor" subject="Series A, lock Tuesday?" active />
                <MiniInboxRow sender="Substack Weekly" subject="What you missed" muted />
              </div>
            </div>
          </Reveal>

          {/* Calendar Guard */}
          <Reveal delay={0.1}>
            <div className="flex h-full flex-col justify-between rounded-xl border border-slate-200 bg-white p-6">
              <div>
                <h3 className="text-xl font-semibold text-slate-950">Calendar guard</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Holds protect time blocks. Movable meetings get flagged before they collide with the one that matters.
                </p>
              </div>
              <div className="mt-6 space-y-2">
                <div className="rounded-lg border border-[#3784ff]/25 bg-[#3784ff]/6 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-bold text-slate-950">Series A call</p>
                    <span className="text-[10px] font-semibold text-[#3784ff]">Protected</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-500">Tue 10:00 - Prep packet ready</p>
                </div>
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <div className="flex items-center justify-between">
                    <p className="text-[12px] font-semibold text-slate-600">Design review</p>
                    <span className="text-[10px] font-semibold text-amber-500">Movable</span>
                  </div>
                  <p className="mt-0.5 text-[11px] text-slate-400">15:30 - flagged as reschedulable</p>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Morning brief - dark card */}
          <Reveal delay={0.15}>
            <div className="flex h-full flex-col justify-between rounded-xl border border-slate-800 bg-[#0f172a] p-6">
              <div>
                <h3 className="text-lg font-semibold text-white">A morning brief, not a dashboard</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-400">
                  Revenue, renewal risk, hiring loops - one message, before your first coffee.
                </p>
              </div>
              <div className="mt-6 rounded-lg border border-white/10 bg-white/[0.06] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">7:42 AM - Today&apos;s brief</p>
                <p className="mt-2 text-[12px] leading-relaxed text-slate-300">Revenue up 8.4% · 1 renewal risk · 2 hiring loops need decisions</p>
                <p className="mt-2 text-[11px] font-medium text-[#3784ff]">3 approvals waiting in Telegram</p>
              </div>
            </div>
          </Reveal>

          {/* Decision memory */}
          <Reveal delay={0.2}>
            <div className="flex h-full flex-col justify-between rounded-xl border border-slate-200 bg-white p-6">
              <div>
                <h3 className="text-lg font-semibold text-slate-950">Remembers what you decided</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-500">
                  Tell it once. It won&apos;t ask again, and it won&apos;t let a decision quietly slide.
                </p>
              </div>
              <div className="mt-6 space-y-2">
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  <p className="text-[12px] text-slate-600">Archive all Substack - remembered</p>
                </div>
                <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  <p className="text-[12px] text-slate-600">Never double-book Fridays - remembered</p>
                </div>
              </div>
            </div>
          </Reveal>

          {/* Telegram - dark card */}
          <Reveal delay={0.25}>
            <div className="flex h-full flex-col justify-between rounded-xl border border-slate-700/60 bg-[#1a2234] p-6">
              <div>
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/10">
                  <TelegramIcon className="h-5 w-5" />
                </span>
                <h3 className="mt-4 text-lg font-semibold text-white">Lives where you already are</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/60">
                  Approve, reject, or ask a follow-up - all from Telegram. No new app to learn, no new tab to check.
                </p>
              </div>
              <div className="mt-6 flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.05] px-3 py-2.5">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#27A7E7]" />
                <p className="text-[12px] font-medium text-slate-300">Connected to your Telegram</p>
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
