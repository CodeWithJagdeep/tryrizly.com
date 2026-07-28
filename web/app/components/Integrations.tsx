'use client';

const tools = [
  { name: 'Gmail', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c1/Google_%22G%22_logo.svg/960px-Google_%22G%22_logo.svg.png' },
  { name: 'Google Calendar', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a5/Google_Calendar_icon_%282020%29.svg/960px-Google_Calendar_icon_%282020%29.svg.png' },
  { name: 'Stripe', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/b/ba/Stripe_Logo%2C_revised_2016.svg/960px-Stripe_Logo%2C_revised_2016.svg.png' },
  { name: 'Slack', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/7/76/Slack_icon.svg/960px-Slack_icon.svg.png' },
  { name: 'PostgreSQL', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/PostgreSQL_15_Logo.png/960px-PostgreSQL_15_Logo.png' },
  { name: 'MongoDB', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/93/MongoDB_Logo.svg/960px-MongoDB_Logo.svg.png' },
  { name: 'Telegram', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Telegram_2019_Logo.svg/960px-Telegram_2019_Logo.svg.png' },
  { name: 'GitHub', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Octicons-mark-github.svg/960px-Octicons-mark-github.svg.png' },
  { name: 'Linear', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6b/Linear_%28software%29_logo.svg/960px-Linear_%28software%29_logo.svg.png' },
  { name: 'Notion', logo: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e9/Notion-logo.svg/960px-Notion-logo.svg.png' },
];

export function Integrations() {
  return (
    <section className="overflow-hidden bg-[#fcfcfc] py-16 sm:py-20 lg:py-24">
      <style>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }

        @keyframes marquee-reverse {
          0% { transform: translateX(-50%); }
          100% { transform: translateX(0); }
        }

        .marquee {
          animation: marquee 40s linear infinite;
        }

        .marquee-reverse {
          animation: marquee-reverse 40s linear infinite;
        }

        .marquee:hover, .marquee-reverse:hover {
          animation-play-state: paused;
        }
      `}</style>

      <div className="px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          {/* Eyebrow */}
          <div className="mb-4 inline-flex items-center rounded-full border border-[#D9BEF4] px-3 py-1">
            <span className="text-xs font-semibold text-[#D9BEF4] uppercase tracking-wide">
              10+ integrations
            </span>
          </div>

          {/* Heading */}
          <h2 className="mt-4 text-3xl font-normal text-black sm:text-4xl lg:text-5xl">
            Connects to the tools
            <br />
            <span className="text-[#D9BEF4]">you already use</span>
          </h2>

          <p className="mt-6 text-lg text-slate-600">
            Monitor your business data where it lives — Gmail, Slack, Linear, GitHub, Stripe, and more.
          </p>
        </div>

        {/* Marquee Row */}
        <div className="mt-16">
          <div className="relative w-full overflow-hidden">
            <div className="marquee flex w-full gap-6">
              {[...tools, ...tools].map((tool, index) => (
                <div
                  key={index}
                  className="group flex h-16 min-w-max items-center gap-3 rounded-lg border border-slate-200 bg-white px-6 transition-all duration-300 hover:border-[#D9BEF4] hover:-translate-y-0.5 hover:shadow-md"
                >
                  <img
                    src={tool.logo}
                    alt={tool.name}
                    className="h-5 w-5"
                  />
                  <span className="whitespace-nowrap text-sm font-medium text-slate-700 group-hover:text-slate-900">
                    {tool.name}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
