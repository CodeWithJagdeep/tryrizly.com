import { Reveal } from '../Reveal';

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function GaugeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-5 w-5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

const items = [
  {
    title: 'Nothing sends without you',
    detail:
      'Drafts, replies, and scheduling changes wait for your approval in Telegram. Auto-send only turns on for a category once you explicitly tell Riz to handle it that way.',
    Icon: ShieldIcon,
    accent: 'text-[#3784ff]',
    iconBg: 'bg-[#3784ff]/10 border-[#3784ff]/20',
  },
  {
    title: 'Your tokens stay encrypted',
    detail:
      'Gmail and Calendar OAuth credentials are stored in an encrypted vault, not plain text, and are only used server-side to make the API calls you authorized.',
    Icon: LockIcon,
    accent: 'text-emerald-600',
    iconBg: 'bg-emerald-50 border-emerald-200',
  },
  {
    title: 'Spend is visible, not a surprise',
    detail:
      'Every plan has a fixed AI budget. You can see exactly what has been spent this cycle, and background features pause automatically before you ever go over.',
    Icon: GaugeIcon,
    accent: 'text-amber-600',
    iconBg: 'bg-amber-50 border-amber-200',
  },
];

export function Trust() {
  return (
    <section className="bg-[#f8fafc] py-20 md:py-28" id="trust">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="font-neue-haas max-w-lg text-3xl font-normal tracking-tight text-[#0f172a] md:text-4xl">
            Control stays with you, end to end.
          </h2>
          <p className="mt-3 max-w-md text-base leading-relaxed text-slate-500">
            Approval-first means approval-first - not a setting buried three menus deep.
          </p>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          {items.map((item, index) => (
            <Reveal key={item.title} delay={index * 0.06}>
              <div className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-6">
                <span className={`mb-4 flex h-10 w-10 items-center justify-center rounded-xl border ${item.iconBg} ${item.accent}`}>
                  <item.Icon />
                </span>
                <h3 className="text-base font-semibold text-slate-950">{item.title}</h3>
                <p className="mt-2 flex-1 text-sm leading-relaxed text-slate-500">{item.detail}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
