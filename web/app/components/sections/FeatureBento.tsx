import { TelegramIcon } from '../ConnectorIcons';
import { Reveal } from '../Reveal';

type IconProps = { className?: string };

function MailIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="M3 7l9 6 9-6" />
    </svg>
  );
}

function CalendarIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

function SunIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
    </svg>
  );
}

function BrainIcon({ className = 'h-5 w-5' }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className={className} strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 4a3 3 0 0 0-3 3v1a3 3 0 0 0-1 5.83V15a3 3 0 0 0 3 3h1" />
      <path d="M15 4a3 3 0 0 1 3 3v1a3 3 0 0 1 1 5.83V15a3 3 0 0 1-3 3h-1" />
      <path d="M9 4v15M15 4v15" />
    </svg>
  );
}

function MiniInboxRow({ sender, subject, active, muted }: { sender: string; subject: string; active?: boolean; muted?: boolean }) {
  return (
    <div
      className={`flex items-center gap-3 border-2 bg-white p-2.5 ${
        active ? 'border-[#D9BEF4] bg-[#D9BEF4]/8' : 'border-black/10'
      } ${muted ? 'opacity-45' : ''}`}
    >
      <div
        className={`flex h-7 w-7 shrink-0 items-center justify-center border-2 text-[11px] font-bold ${
          active ? 'border-black bg-[#D9BEF4] text-white' : 'border-black/10 bg-black/5 text-gray-500'
        }`}
      >
        {sender[0]}
      </div>
      <div className="min-w-0">
        <p className="truncate text-[12px] font-bold text-black">{sender}</p>
        <p className="truncate text-[11px] text-gray-400">{subject}</p>
      </div>
      {active && (
        <span className="shrink-0 border-2 border-black bg-[#D9BEF4] px-1.5 py-0.5 text-[10px] font-black uppercase text-white">
          Priority
        </span>
      )}
    </div>
  );
}

function MockupChrome({
  Icon,
  label,
  children,
}: {
  Icon: (props: IconProps) => React.ReactElement;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="relative border-2 border-black bg-white shadow-[10px_10px_0px_0px_rgba(0,0,0,1)]">
      <div className="flex items-center justify-between border-b-2 border-black bg-black/[0.02] px-5 py-3.5">
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center border-2 border-black bg-[#D9BEF4] text-white">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="text-[13px] font-black uppercase tracking-tight text-black">{label}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase text-gray-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Live
        </div>
      </div>
      {children}
    </div>
  );
}

function CheckItem({ children }: { children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-2.5 text-sm font-medium text-gray-600">
      <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center border-2 border-black bg-[#D9BEF4]/10">
        <svg className="h-2.5 w-2.5 text-[#D9BEF4]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 8l3.5 3.5L13 4" />
        </svg>
      </span>
      {children}
    </li>
  );
}

const items = [
  {
    Icon: MailIcon,
    title: 'Inbox triage that actually reads the email',
    detail: (
      <>
        Newsletters get archived on sight. The investor reply gets a Telegram ping before you&rsquo;ve opened
        your laptop. Riz reads <strong className="font-bold text-black">intent, not just subject lines</strong>,
        so the message you actually need to see never gets buried under promotions.
      </>
    ),
    stat: { value: '20-40', unit: 'min', label: 'saved every morning' },
    benefits: [
      'Saves 20 to 40 minutes of manual sorting every morning',
      'Nothing important sits unread in a folder you forgot to check',
      'Replies come drafted in your voice, not a generic template',
    ],
    bg: 'bg-[#fcfcfc]',
    panel: (
      <MockupChrome Icon={MailIcon} label="Inbox Triage">
        <div className="space-y-2 p-4">
          <MiniInboxRow sender="Product Hunt" subject="Top launches of the day" muted />
          <MiniInboxRow sender="Markus, Investor" subject="Series A, lock Tuesday?" active />
          <MiniInboxRow sender="Priya, Acme Corp" subject="Renewal question re: invoice" active />
          <MiniInboxRow sender="Substack Weekly" subject="What you missed" muted />
        </div>
        <div className="flex items-center justify-between border-t-2 border-black bg-black/[0.02] px-4 py-3">
          <p className="text-[11px] font-bold text-gray-500">
            <span className="text-black">2 drafts</span> waiting for approval
          </p>
          <span className="inline-flex items-center gap-1 border-2 border-black bg-emerald-500 px-2 py-1 text-[10px] font-black uppercase text-white">
            4 items parsed
          </span>
        </div>
      </MockupChrome>
    ),
  },
  {
    Icon: CalendarIcon,
    title: 'Calendar guard protects the call that matters',
    detail: (
      <>
        Holds protect time blocks. Movable meetings get flagged before they collide with something important,
        and Riz <strong className="font-bold text-black">builds a prep packet, metrics, last thread, deck
        link</strong>, so you walk in ready.
      </>
    ),
    stat: { value: '0', unit: '', label: 'double-bookings since day one' },
    benefits: [
      'Investor and customer calls never get bumped by a routine sync',
      'Automatic prep packets mean less scrambling before high-stakes meetings',
      'Flexible meetings get proposed a better slot instead of just a conflict warning',
    ],
    bg: 'bg-white',
    panel: (
      <MockupChrome Icon={CalendarIcon} label="Calendar Guard">
        <div className="flex items-center justify-between border-b-2 border-black/10 px-4 py-2.5">
          <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">Tuesday, Jun 24</p>
          <p className="text-[11px] font-bold text-gray-400">6 events</p>
        </div>
        <div className="space-y-2 p-4">
          <div className="border-2 border-[#D9BEF4] bg-[#D9BEF4]/8 p-3">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-bold text-black">Series A call</p>
              <span className="text-[10px] font-black uppercase text-[#D9BEF4]">Protected</span>
            </div>
            <p className="mt-0.5 text-[11px] text-gray-500">10:00, prep packet ready</p>
          </div>
          <div className="border-2 border-black/10 bg-black/[0.02] p-3">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-bold text-gray-600">Design review</p>
              <span className="text-[10px] font-black uppercase text-amber-600">Movable</span>
            </div>
            <p className="mt-0.5 text-[11px] text-gray-400">15:30, flagged as reschedulable</p>
          </div>
          <div className="border-2 border-black/10 bg-black/[0.02] p-3">
            <div className="flex items-center justify-between">
              <p className="text-[13px] font-bold text-gray-600">1:1 with Priya</p>
              <span className="text-[10px] font-black uppercase text-gray-400">Buffered</span>
            </div>
            <p className="mt-0.5 text-[11px] text-gray-400">16:15, 15 min hold added before</p>
          </div>
        </div>
        <div className="border-t-2 border-black bg-black/[0.02] px-4 py-3">
          <p className="text-[11px] font-bold text-gray-500">
            <span className="text-black">1 conflict</span> auto-resolved this week
          </p>
        </div>
      </MockupChrome>
    ),
  },
  {
    Icon: SunIcon,
    title: 'A morning brief, not a dashboard',
    detail: (
      <>
        Revenue, renewal risk, hiring loops, one message, before your first coffee.{' '}
        <strong className="font-bold text-black">No login, no widgets to arrange</strong>, just the handful of
        numbers that changed and the decisions waiting on you.
      </>
    ),
    stat: { value: '1', unit: '', label: 'message replaces 4 tool logins' },
    benefits: [
      'One daily Telegram message replaces four separate tool logins',
      'Renewal and revenue risk surface before they become a fire drill',
      'You start the day with a decision list, not an inbox to triage',
    ],
    bg: 'bg-[#fcfcfc]',
    panel: (
      <MockupChrome Icon={SunIcon} label="Daily Brief">
        <div className="border-b-2 border-black/10 px-4 py-2.5">
          <p className="text-[10px] font-black uppercase tracking-[0.14em] text-gray-400">7:42 AM, today&apos;s brief</p>
        </div>
        <div className="space-y-2 p-4">
          <div className="flex items-center justify-between border-2 border-black/10 bg-black/[0.02] px-3 py-2.5">
            <p className="text-[12px] font-bold text-gray-600">Revenue</p>
            <p className="text-[13px] font-black text-emerald-600">+8.4% vs last week</p>
          </div>
          <div className="flex items-center justify-between border-2 border-[#D9BEF4] bg-[#D9BEF4]/8 px-3 py-2.5">
            <p className="text-[12px] font-bold text-black">Renewal risk</p>
            <p className="text-[13px] font-black text-[#D9BEF4]">1 account, past due</p>
          </div>
          <div className="flex items-center justify-between border-2 border-black/10 bg-black/[0.02] px-3 py-2.5">
            <p className="text-[12px] font-bold text-gray-600">Hiring loops</p>
            <p className="text-[13px] font-black text-gray-700">2 need a decision</p>
          </div>
        </div>
        <div className="flex items-center justify-between border-t-2 border-black bg-black/[0.02] px-4 py-3">
          <p className="text-[11px] font-bold text-[#D9BEF4]">3 approvals waiting in Telegram</p>
          <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 animate-pulse" />
        </div>
      </MockupChrome>
    ),
  },
  {
    Icon: BrainIcon,
    title: 'Remembers what you decided',
    detail: (
      <>
        Tell it once. It won&rsquo;t ask again, and it won&rsquo;t let a decision quietly slide.{' '}
        <strong className="font-bold text-black">Every rule and preference gets logged and applied
        consistently</strong>, so your workflow gets sharper the longer you use it.
      </>
    ),
    stat: { value: '100%', unit: '', label: 'of rules applied automatically' },
    benefits: [
      'You never re-explain the same preference twice',
      'Standing rules apply automatically across every new email or event',
      'A running log means you can audit exactly what Riz decided and why',
    ],
    bg: 'bg-white',
    panel: (
      <MockupChrome Icon={BrainIcon} label="Decision Log">
        <div className="flex items-center justify-between border-b-2 border-black/10 px-4 py-2.5">
          <p className="text-[11px] font-black uppercase tracking-wide text-gray-400">Standing rules</p>
          <p className="text-[11px] font-bold text-gray-400">12 active</p>
        </div>
        <div className="space-y-2 p-4">
          <div className="flex items-center justify-between border-2 border-black/10 bg-black/[0.02] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              <p className="text-[12px] font-medium text-gray-600">Archive all Substack, remembered</p>
            </div>
            <p className="text-[10px] font-bold text-gray-400">2d ago</p>
          </div>
          <div className="flex items-center justify-between border-2 border-black/10 bg-black/[0.02] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              <p className="text-[12px] font-medium text-gray-600">Never double-book Fridays, remembered</p>
            </div>
            <p className="text-[10px] font-bold text-gray-400">1w ago</p>
          </div>
          <div className="flex items-center justify-between border-2 border-black/10 bg-black/[0.02] px-3 py-2.5">
            <div className="flex items-center gap-2">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
              <p className="text-[12px] font-medium text-gray-600">Auto-draft renewal nudges, remembered</p>
            </div>
            <p className="text-[10px] font-bold text-gray-400">3w ago</p>
          </div>
        </div>
        <div className="border-t-2 border-black bg-black/[0.02] px-4 py-3">
          <p className="text-[11px] font-bold text-gray-500">
            Every rule is <span className="text-black">logged and auditable</span>, not a hidden setting
          </p>
        </div>
      </MockupChrome>
    ),
  },
  {
    Icon: TelegramIcon,
    title: 'Lives where you already are',
    detail: (
      <>
        Approve, reject, or ask a follow-up, all from Telegram.{' '}
        <strong className="font-bold text-black">No new app to learn, no new tab to check</strong>, and no
        dashboard you have to remember to open.
      </>
    ),
    stat: { value: '1', unit: 'tap', label: 'to approve, reject, or reply' },
    benefits: [
      'Approvals take one tap, right inside the chat you already have open',
      'No onboarding curve since Telegram is already part of your day',
      'Works the same on desktop or mobile, so approvals never wait on you finding a laptop',
    ],
    bg: 'bg-[#fcfcfc]',
    panel: (
      <MockupChrome Icon={TelegramIcon} label="Telegram">
        <div className="p-4">
          <div className="flex items-start gap-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center border-2 border-black bg-[#D9BEF4] text-[11px] font-black text-white">
              R
            </span>
            <div className="min-w-0 flex-1 border-2 border-black/10 bg-black/[0.02] p-3">
              <div className="flex items-center justify-between">
                <p className="text-[12px] font-black text-black">Riz</p>
                <p className="text-[10px] font-bold text-gray-400">via Telegram</p>
              </div>
              <p className="mt-1.5 text-[12.5px] leading-relaxed text-gray-600">
                Markus wants to lock Tuesday 10 AM for the Series A call. I&rsquo;ve drafted a reply confirming
                the slot and added a prep packet to the hold.
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className="border-2 border-black bg-[#D9BEF4] px-3 py-1.5 text-[11px] font-black uppercase tracking-tight text-white">
              Approve
            </button>
            <button className="border-2 border-black bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-tight text-black">
              Edit reply
            </button>
            <button className="border-2 border-black/20 bg-white px-3 py-1.5 text-[11px] font-black uppercase tracking-tight text-gray-400">
              Skip
            </button>
          </div>
        </div>
        <div className="border-t-2 border-black bg-black/[0.02] px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#27A7E7]" />
            <p className="text-[11px] font-bold text-gray-500">Connected to your Telegram</p>
          </div>
        </div>
      </MockupChrome>
    ),
  },
];

export function FeatureBento() {
  return (
    <>
      <section className="bg-[#fcfcfc] pt-20 md:pt-28 font-neue-haas">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <Reveal>
            <p className="mb-3 text-[11px] font-black uppercase tracking-[0.25em] text-[#D9BEF4]">What you get</p>
            <h2 className="max-w-2xl text-3xl font-black uppercase tracking-tight text-black md:text-4xl">
              One operator, watching everything you&apos;d rather not.
            </h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed text-gray-500">
              Five things run quietly in the background from the moment you connect an account. No dashboard to
              check, no settings to configure twice, just decisions waiting for you in Telegram when they
              actually matter.
            </p>
          </Reveal>
        </div>
      </section>

      {items.map((item, index) => {
        const reversed = index % 2 === 1;
        return (
          <section key={item.title} className={`${item.bg} py-14 md:py-16 font-neue-haas`}>
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              <div className="grid grid-cols-1 items-center gap-10 md:grid-cols-12 md:gap-14">
                <Reveal className={`md:col-span-5 ${reversed ? 'md:order-2' : 'md:order-1'}`}>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center border-2 border-black bg-white text-[#D9BEF4]">
                      <item.Icon className="h-5 w-5" />
                    </span>
                    <p className="border-2 border-black bg-[#D9BEF4]/10 px-3 py-1.5 font-mono text-[12px] font-bold uppercase tracking-wide text-black">
                      <span className="text-[#D9BEF4]">
                        {item.stat.value}
                        {item.stat.unit ? ` ${item.stat.unit}` : ''}
                      </span>{' '}
                      {item.stat.label}
                    </p>
                  </div>
                  <h3 className="mt-5 text-2xl font-black uppercase leading-snug tracking-tight text-black">
                    {item.title}
                  </h3>
                  <p className="mt-3 max-w-md text-base leading-relaxed text-gray-500">{item.detail}</p>
                  <ul className="mt-5 flex flex-col gap-3 border-t-2 border-black/10 pt-5">
                    {item.benefits.map((benefit) => (
                      <CheckItem key={benefit}>{benefit}</CheckItem>
                    ))}
                  </ul>
                </Reveal>
                <Reveal delay={0.08} className={`md:col-span-7 ${reversed ? 'md:order-1' : 'md:order-2'}`}>
                  {item.panel}
                </Reveal>
              </div>
            </div>
          </section>
        );
      })}
    </>
  );
}
