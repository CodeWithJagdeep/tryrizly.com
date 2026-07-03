import Link from "next/link";
import { Reveal } from "../Reveal";

type Plan = {
  id: string;
  name: string;
  price: string;
  cadence: string;
  description: string;
  features: string[];
  highlighted?: boolean;
};

// Mirrors apps/billing/src/plans.ts and /pricing — keep in sync.
const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    cadence: "forever",
    description: "The floor tier after your 15-day trial. Enough to stay connected.",
    features: ["Limited chat with Riz", "Basic memory", "Telegram delivery"],
  },
  {
    id: "starter",
    name: "Starter",
    price: "$49",
    cadence: "per month",
    description: "A founder-grade daily assistant with controlled background AI.",
    features: ["Email triage & drafting", "Morning brief & reminders", "Connector memory"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$99",
    cadence: "per month",
    description: "For a heavier inbox, more meetings, and proactive workflows.",
    features: ["Everything in Starter", "Priority agent runs", "Weekly digest automation"],
    highlighted: true,
  },
  {
    id: "business",
    name: "Business",
    price: "$199",
    cadence: "per month",
    description: "The highest AI budget for deep background work.",
    features: ["Everything in Pro", "Business-system integrations", "Priority support"],
  },
];

export function Pricing() {
  return (
    <section className="bg-[#fcfcfc] py-20 md:py-28 font-neue-haas" id="pricing">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#FE7F2D]">Pricing</p>
          <h2 className="mt-4 max-w-lg text-3xl font-black uppercase tracking-tight text-black md:text-4xl">
            One price, no surprise overage.
          </h2>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-gray-500">
            Pick a plan and know exactly what you&apos;ll pay every month.
          </p>
        </Reveal>

        <div className="mt-12 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan, index) => (
            <Reveal key={plan.id} delay={index * 0.05}>
              <div
                className={`relative flex h-full flex-col border-2 border-black bg-white p-8 transition-all duration-300 ${
                  plan.highlighted
                    ? "shadow-[8px_8px_0px_0px_rgba(254,127,45,1)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[10px_10px_0px_0px_rgba(254,127,45,1)]"
                    : "shadow-[6px_6px_0px_0px_rgba(0,0,0,1)] hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]"
                }`}
              >
                {plan.highlighted && (
                  <span className="mb-4 inline-flex w-fit items-center border-2 border-black bg-[#FE7F2D] px-3 py-1.5 text-xs font-black uppercase tracking-wide text-white">
                    Most popular
                  </span>
                )}
                <h3 className="text-xl font-black uppercase tracking-tight text-black">{plan.name}</h3>
                <p className="mt-4 flex items-baseline gap-2">
                  <span className="text-4xl font-black text-black lg:text-5xl">{plan.price}</span>
                  <span className="text-base font-medium text-gray-400">{plan.cadence}</span>
                </p>
                <p className="mt-4 text-base leading-relaxed text-gray-500">{plan.description}</p>
                <ul className="mt-6 flex flex-col gap-3 text-[15px] font-medium text-gray-600">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2.5">
                      <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center border-2 border-black bg-[#FE7F2D]/10">
                        <svg className="h-2.5 w-2.5 text-[#FE7F2D]" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 8l3.5 3.5L13 4" />
                        </svg>
                      </span>
                      {feature}
                    </li>
                  ))}
                </ul>
                <a
                  href="/signup"
                  className={`mt-8 flex h-12 w-full items-center justify-center border-2 border-black text-base font-black uppercase tracking-tight transition-colors ${
                    plan.highlighted
                      ? "bg-[#FE7F2D] text-white hover:bg-black"
                      : "bg-white text-black hover:bg-black hover:text-white"
                  }`}
                >
                  Start free trial
                </a>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-gray-400">
              Billed monthly through Razorpay. Cancel anytime — access runs to the end of the period.
            </p>
            <Link
              href="/pricing"
              className="group inline-flex items-center gap-2 text-[13px] font-black uppercase tracking-tight text-black transition-colors hover:text-[#FE7F2D]"
            >
              Compare all plans in detail
              <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
