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

const track = [...logos, ...logos];

export function IntegrationsStrip() {
  return (
    <section className="overflow-hidden border-b-2 border-black/10 bg-[#fcfcfc] py-16 font-neue-haas">
      <style>{`
        @keyframes riz-marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .riz-marquee-track {
          animation: riz-marquee 32s linear infinite;
        }
        .riz-marquee-track:hover {
          animation-play-state: paused;
        }
      `}</style>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <p className="mb-8 text-center text-[11px] font-black uppercase tracking-[0.2em] text-gray-400">
            Works with the stack you already use
          </p>
        </Reveal>
        <div className="relative overflow-hidden">
          <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-16 bg-gradient-to-r from-[#fcfcfc] to-transparent" />
          <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-16 bg-gradient-to-l from-[#fcfcfc] to-transparent" />
          <div className="riz-marquee-track flex w-max gap-4">
            {track.map(({ Icon, label }, i) => (
              <div
                key={`${label}-${i}`}
                className="flex items-center gap-2.5 border-2 border-black bg-white px-5 py-3 shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all hover:-translate-x-px hover:-translate-y-px hover:border-[#D9BEF4] hover:shadow-[4px_4px_0px_0px_rgba(217,190,244,1)]"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center text-black">
                  <Icon className="size-full" />
                </span>
                <span className="whitespace-nowrap text-[13px] font-bold uppercase tracking-tight text-black">{label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
