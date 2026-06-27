import { GmailIcon, CalendarIcon, TelegramIcon, StripeIcon } from '../ConnectorIcons';
import { Reveal } from '../Reveal';

const groups = [
  {
    title: 'Gmail',
    Icon: GmailIcon,
    accent: 'bg-red-50 border-red-100',
    items: [
      'Triages every new email by what it actually is - noise, payment due, meeting request, or investor update',
      'Drafts replies in your voice. Nothing sends until you approve it in Telegram',
      'Tracks commitments mentioned in threads so nothing slips',
    ],
  },
  {
    title: 'Calendar',
    Icon: CalendarIcon,
    accent: 'bg-blue-50 border-blue-100',
    items: [
      'Flags conflicts in new meeting requests before you see them',
      'Protects buffer time around the calls that matter',
      'Builds a prep packet - metrics, last thread, deck link - ahead of important calls',
    ],
  },
  {
    title: 'Telegram',
    Icon: TelegramIcon,
    accent: 'bg-sky-50 border-sky-100',
    items: [
      'Every draft, approval, and alert arrives as a message - not a dashboard tab',
      'Approve, reject, or ask a follow-up question with a single reply',
      'A daily proactive brief: revenue, renewal risk, hiring loops - one message',
    ],
  },
  {
    title: 'Business data',
    Icon: StripeIcon,
    accent: 'bg-violet-50 border-violet-100',
    items: [
      'Connects Stripe, Razorpay, PostgreSQL, or MongoDB to watch revenue and signals',
      'Mines email and calendar for decisions and keeps a durable log you can ask about later',
      'Every AI call is logged against your plan budget - background features pause before you go over',
    ],
  },
];

export function Capabilities() {
  return (
    <section className="bg-[#f8fafc] py-20 md:py-28" id="capabilities">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="font-neue-haas max-w-xl text-3xl font-normal tracking-tight text-[#0f172a] md:text-4xl">
            Everything Riz does, by connection.
          </h2>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-slate-500">
            No marketing summary - this is the actual list of what runs in the background once you connect each account.
          </p>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
          {groups.map((group, index) => (
            <Reveal key={group.title} delay={index * 0.06}>
              <div className="h-full rounded-xl border border-slate-200 bg-white p-6">
                <div className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border ${group.accent}`}>
                    <group.Icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-lg font-semibold text-slate-950">{group.title}</h3>
                </div>
                <ul className="mt-5 flex flex-col gap-3.5 text-sm leading-relaxed text-slate-500">
                  {group.items.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-[#3784ff]" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
