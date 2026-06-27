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

const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: "$0",
    cadence: "7-day trial",
    description: "Full features for a week, then choose a plan.",
    features: ["Limited chat", "Basic memory", "Manual connector setup"],
  },
  {
    id: "starter",
    name: "Starter",
    price: "$49",
    cadence: "per month",
    description: "A founder-grade daily assistant with controlled background AI.",
    features: ["Email triage", "Connector memory"],
  },
  {
    id: "pro",
    name: "Pro",
    price: "$99",
    cadence: "per month",
    description: "For a heavier inbox, more meetings, and proactive workflows.",
    features: ["Priority agent runs", "Digest automation"],
    highlighted: true,
  },
  {
    id: "business",
    name: "Business",
    price: "$199",
    cadence: "per month",
    description: "Deeper support for background work.",
    features: ["Priority support", "Higher usage limits"],
  },
];

export function Pricing() {
  return (
    <section className="bg-white py-20 md:py-28" id="pricing">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="font-neue-haas max-w-lg text-3xl font-normal tracking-tight text-[#0f172a] md:text-4xl">
            One price, no surprise overage.
          </h2>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-[#475569]">
            Pick a plan and know exactly what you'll pay every month.
          </p>
        </Reveal>

        <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan, index) => (
            <Reveal key={plan.id} delay={index * 0.05}>
              <div
                className={`flex h-full flex-col rounded-xl border p-6 ${
                  plan.highlighted
                    ? "border-[#3784ff] bg-[#3784ff]/[0.03] shadow-[0_18px_40px_-24px_rgba(55,132,255,0.45)]"
                    : "border-slate-200 bg-white"
                }`}
              >
                {plan.highlighted && (
                  <span className="mb-3 inline-flex w-fit items-center rounded-full bg-[#3784ff] px-2.5 py-1 text-[11px] font-semibold text-white">
                    Most popular
                  </span>
                )}
                <h3 className="text-lg font-semibold text-slate-950">{plan.name}</h3>
                <p className="mt-3 flex items-baseline gap-1.5">
                  <span className="text-3xl font-semibold text-slate-950">{plan.price}</span>
                  <span className="text-sm text-slate-400">{plan.cadence}</span>
                </p>
                <p className="mt-3 text-sm leading-relaxed text-[#475569]">{plan.description}</p>
                <ul className="mt-5 flex flex-col gap-2.5 text-sm text-slate-600">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-slate-400" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <a
                  href="/signup"
                  className={`mt-6 flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold transition ${
                    plan.highlighted
                      ? "bg-[#3784ff] text-white hover:bg-[#2c72e5]"
                      : "border border-slate-200 text-slate-950 hover:bg-slate-50"
                  }`}
                >
                  Start free trial
                </a>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
