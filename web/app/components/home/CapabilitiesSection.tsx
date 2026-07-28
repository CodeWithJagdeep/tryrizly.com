import { GmailIcon, CalendarIcon, TelegramIcon, StripeIcon } from "../ConnectorIcons";

const groups = [
  {
    title: "Gmail",
    Icon: GmailIcon,
    items: [
      "Triages every new email by what it actually is: noise, payment due, meeting request, or investor update",
      "Drafts replies in your voice. Nothing sends until you approve it in Telegram",
      "Tracks commitments mentioned in threads so nothing slips",
    ],
  },
  {
    title: "Calendar",
    Icon: CalendarIcon,
    items: [
      "Flags conflicts in new meeting requests before you see them",
      "Protects buffer time around the calls that matter",
      "Builds a prep packet: metrics, last thread, deck link, ahead of important calls",
    ],
  },
  {
    title: "Telegram",
    Icon: TelegramIcon,
    items: [
      "Every draft, approval, and alert arrives as a message, not a dashboard tab",
      "Approve, reject, or ask a follow-up question with a single reply",
      "A daily proactive brief: revenue, renewal risk, hiring loops, one message",
    ],
  },
  {
    title: "Business data",
    Icon: StripeIcon,
    items: [
      "Connects Stripe, Razorpay, PostgreSQL, or MongoDB to watch revenue and signals",
      "Mines email and calendar for decisions and keeps a durable log you can ask about later",
      "Every AI call is logged against your plan budget: background features pause before you go over",
    ],
  },
];

export function CapabilitiesSection() {
  return (
    <section className="border-t border-black/10 bg-white px-6 py-20 md:px-10 lg:px-14">
      <div className="mx-auto max-w-[88rem]">
        <span className="mb-5 block text-[11px] font-normal uppercase tracking-[0.18em] text-gray-500">
          Capabilities
        </span>
        <h2 className="max-w-2xl text-3xl font-normal leading-tight tracking-tight text-[#233D4D] [text-wrap:balance] md:text-5xl">
          Everything Riz does, by connection.
        </h2>
        <p className="mt-6 max-w-xl text-sm leading-6 text-gray-600 md:text-base">
          No marketing summary, this is the actual list of what runs in the background once you connect each account.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2">
          {groups.map((group) => (
            <div key={group.title} className="h-full rounded-2xl bg-[#f7f7f6] p-8">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#233D4D]">
                  <group.Icon className="h-5 w-5" />
                </span>
                <h3 className="text-lg font-normal text-[#233D4D]">{group.title}</h3>
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
          ))}
        </div>
      </div>
    </section>
  );
}
