import {
  GmailIcon,
  CalendarIcon,
  TelegramIcon,
  StripeIcon,
  RazorpayIcon,
  PostgresIcon,
  MongoDbIcon,
} from '../ConnectorIcons';
import { Reveal } from '../Reveal';

const logos = [
  { Icon: GmailIcon, label: 'Gmail' },
  { Icon: CalendarIcon, label: 'Google Calendar' },
  { Icon: TelegramIcon, label: 'Telegram' },
  { Icon: StripeIcon, label: 'Stripe' },
  { Icon: RazorpayIcon, label: 'Razorpay' },
  { Icon: PostgresIcon, label: 'PostgreSQL' },
  { Icon: MongoDbIcon, label: 'MongoDB' },
];

export function IntegrationsStrip() {
  return (
    <section className="border-y border-slate-200 bg-white py-10">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <p className="mb-7 text-center text-[13px] font-medium tracking-wide text-slate-400">
            Works with the stack you already use
          </p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-5 sm:gap-x-12">
            {logos.map(({ Icon, label }) => (
              <div
                key={label}
                className="flex items-center gap-2 opacity-55 transition-opacity duration-200 hover:opacity-100"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                  <Icon className="size-full" />
                </span>
                <span className="text-[13px] font-semibold text-slate-600">{label}</span>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  );
}
