import Link from 'next/link';
import { Reveal } from '../Reveal';

function ShieldIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-6 w-6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      <path d="m9 12 2 2 4-4" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-6 w-6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

function GaugeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="h-6 w-6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
      <path d="M12 6v6l4 2" />
    </svg>
  );
}

const items = [
  {
    stat: '100%',
    label: 'of sends approved by you',
    title: 'Nothing sends without you',
    detail:
      'Drafts, replies, and scheduling changes wait for your approval in Telegram. Auto-send only turns on for a category once you explicitly tell Riz to handle it that way.',
    Icon: ShieldIcon,
    accent: 'text-[#D9BEF4]',
    iconBg: 'bg-[#D9BEF4]/10',
  },
  {
    stat: 'AES-256',
    label: 'encrypted at rest',
    title: 'Your tokens stay encrypted',
    detail:
      'Gmail and Calendar OAuth credentials are stored in an encrypted vault, not plain text, and are only used server-side to make the API calls you authorized.',
    Icon: LockIcon,
    accent: 'text-emerald-600',
    iconBg: 'bg-emerald-500/10',
  },
  {
    stat: '80%',
    label: 'budget warning threshold',
    title: 'Spend is visible, not a surprise',
    detail:
      'Every plan has a fixed AI budget. You can see exactly what has been spent this cycle, and background features pause automatically before you ever go over.',
    Icon: GaugeIcon,
    accent: 'text-amber-600',
    iconBg: 'bg-amber-500/10',
  },
];

export function Trust() {
  return (
    <section className="border-t-2 border-black/10 bg-white py-20 md:py-28 font-neue-haas" id="trust">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <div className="flex flex-wrap items-end justify-between gap-6 border-b-2 border-black/10 pb-8">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#D9BEF4]">Trust</p>
              <h2 className="mt-4 max-w-lg text-3xl font-black uppercase tracking-tight text-black md:text-4xl">
                Control stays with you, end to end.
              </h2>
              <p className="mt-3 max-w-md text-base leading-relaxed text-gray-500">
                Approval-first means approval-first, not a setting buried three menus deep.
              </p>
            </div>
          </div>
        </Reveal>

        <div className="mt-2 divide-y-2 divide-black/10">
          {items.map((item, index) => (
            <Reveal key={item.title} delay={index * 0.06}>
              <div className="group grid grid-cols-1 items-start gap-6 py-10 md:grid-cols-12 md:gap-8">
                <div className="flex items-center gap-4 md:col-span-3">
                  <span className={`flex h-12 w-12 shrink-0 items-center justify-center border-2 border-black ${item.iconBg} ${item.accent} transition-transform duration-300 group-hover:-translate-y-0.5`}>
                    <item.Icon />
                  </span>
                  <div>
                    <p className={`font-mono text-lg font-bold ${item.accent}`}>{item.stat}</p>
                    <p className="text-[12px] font-medium text-gray-400">{item.label}</p>
                  </div>
                </div>
                <div className="md:col-span-9">
                  <h3 className="text-lg font-black uppercase tracking-tight text-black">{item.title}</h3>
                  <p className="mt-2 max-w-2xl text-sm leading-relaxed text-gray-500">{item.detail}</p>
                </div>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div className="flex flex-wrap items-center gap-x-8 gap-y-3 border-t-2 border-black/10 pt-8">
            <Link
              href="/trust"
              className="group inline-flex items-center gap-2 text-[13px] font-black uppercase tracking-tight text-black transition-colors hover:text-[#D9BEF4]"
            >
              Visit the trust center
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
            <Link
              href="/security-policy"
              className="group inline-flex items-center gap-2 text-[13px] font-black uppercase tracking-tight text-black transition-colors hover:text-[#D9BEF4]"
            >
              Read the security policy
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
            <Link
              href="/privacy"
              className="group inline-flex items-center gap-2 text-[13px] font-black uppercase tracking-tight text-black transition-colors hover:text-[#D9BEF4]"
            >
              Privacy policy
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
