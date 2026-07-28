import Link from "next/link";

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
    stat: "100%",
    label: "of sends approved by you",
    title: "Nothing sends without you",
    detail:
      "Drafts, replies, and scheduling changes wait for your approval in Telegram. Auto-send only turns on for a category once you explicitly tell Riz to handle it that way.",
    Icon: ShieldIcon,
  },
  {
    stat: "AES-256",
    label: "encrypted at rest",
    title: "Your tokens stay encrypted",
    detail:
      "Gmail and Calendar OAuth credentials are stored in an encrypted vault, not plain text, and are only used server-side to make the API calls you authorized.",
    Icon: LockIcon,
  },
  {
    stat: "80%",
    label: "budget warning threshold",
    title: "Spend is visible, not a surprise",
    detail:
      "Every plan has a fixed AI budget. You can see exactly what has been spent this cycle, and background features pause automatically before you ever go over.",
    Icon: GaugeIcon,
  },
];

export function TrustSection({ hideIntro = false }: { hideIntro?: boolean }) {
  return (
    <section className="border-t border-black/10 bg-white px-6 py-20 md:px-10 lg:px-14">
      <div className="mx-auto max-w-[88rem]">
        {hideIntro ? null : (
          <>
            <span className="mb-5 block text-[11px] font-normal uppercase tracking-[0.18em] text-gray-500">
              Trust
            </span>
            <h2 className="max-w-lg text-3xl font-normal leading-tight tracking-tight text-[#233D4D] [text-wrap:balance] md:text-5xl">
              Control stays with you, end to end.
            </h2>
            <p className="mt-6 max-w-md text-sm leading-6 text-gray-600 md:text-base">
              Approval-first means approval-first, not a setting buried three menus deep.
            </p>
          </>
        )}

        <div className={`divide-y divide-black/[0.06] ${hideIntro ? "" : "mt-12"}`}>
          {items.map((item) => (
            <div key={item.title} className="grid grid-cols-1 items-start gap-6 py-8 first:pt-0 md:grid-cols-12 md:gap-8">
              <div className="flex items-center gap-4 md:col-span-3">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#f7f7f6] text-[#233D4D]">
                  <item.Icon />
                </span>
                <div>
                  <p className="font-mono text-lg font-normal text-[#233D4D]">{item.stat}</p>
                  <p className="text-xs text-gray-500">{item.label}</p>
                </div>
              </div>
              <div className="md:col-span-9">
                <h3 className="text-lg font-normal text-[#233D4D]">{item.title}</h3>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-600">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-black/[0.06] pt-8">
          {hideIntro ? null : (
            <Link href="/trust" className="text-sm text-gray-600 transition hover:text-[#233D4D]">
              Visit the trust center &rarr;
            </Link>
          )}
          <Link href="/security-policy" className="text-sm text-gray-600 transition hover:text-[#233D4D]">
            Read the security policy &rarr;
          </Link>
          <Link href="/privacy" className="text-sm text-gray-600 transition hover:text-[#233D4D]">
            Privacy policy &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}
