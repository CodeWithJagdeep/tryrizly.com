import { GmailIcon, CalendarIcon, TelegramIcon, StripeIcon } from '../ConnectorIcons';
import { Reveal } from '../Reveal';

const groups = [
  {
    title: 'Gmail',
    Icon: GmailIcon,
    accent: 'bg-red-500/10 border-black',
    items: [
      'Triages every new email by what it actually is: noise, payment due, meeting request, or investor update',
      'Drafts replies in your voice. Nothing sends until you approve it in Telegram',
      'Tracks commitments mentioned in threads so nothing slips',
    ],
  },
  {
    title: 'Calendar',
    Icon: CalendarIcon,
    accent: 'bg-blue-500/10 border-black',
    items: [
      'Flags conflicts in new meeting requests before you see them',
      'Protects buffer time around the calls that matter',
      'Builds a prep packet: metrics, last thread, deck link, ahead of important calls',
    ],
  },
  {
    title: 'Telegram',
    Icon: TelegramIcon,
    accent: 'bg-sky-500/10 border-black',
    items: [
      'Every draft, approval, and alert arrives as a message, not a dashboard tab',
      'Approve, reject, or ask a follow-up question with a single reply',
      'A daily proactive brief: revenue, renewal risk, hiring loops, one message',
    ],
  },
  {
    title: 'Business data',
    Icon: StripeIcon,
    accent: 'bg-violet-500/10 border-black',
    items: [
      'Connects Stripe, Razorpay, PostgreSQL, or MongoDB to watch revenue and signals',
      'Mines email and calendar for decisions and keeps a durable log you can ask about later',
      'Every AI call is logged against your plan budget: background features pause before you go over',
    ],
  },
];

export function Capabilities() {
  return (
    <section className="border-t-2 border-black/10 bg-white py-20 md:py-28 font-neue-haas" id="capabilities">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#D9BEF4]">Capabilities</p>
          <h2 className="mt-4 max-w-xl text-3xl font-black uppercase tracking-tight text-black md:text-4xl">
            Everything Riz does, by connection.
          </h2>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-gray-500">
            No marketing summary, this is the actual list of what runs in the background once you connect each account.
          </p>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-2">
          {groups.map((group, index) => (
            <Reveal key={group.title} delay={index * 0.06}>
              <div className="h-full border-2 border-black bg-white p-6 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] transition-all duration-300 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[8px_8px_0px_0px_rgba(217,190,244,1)]">
                <div className="flex items-center gap-3">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center border-2 ${group.accent}`}>
                    <group.Icon className="h-5 w-5" />
                  </span>
                  <h3 className="text-lg font-black uppercase tracking-tight text-black">{group.title}</h3>
                </div>
                <ul className="mt-5 flex flex-col gap-3.5 text-sm leading-relaxed text-gray-600">
                  {group.items.map((item) => (
                    <li key={item} className="flex gap-3">
                      <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-[#D9BEF4]" />
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
