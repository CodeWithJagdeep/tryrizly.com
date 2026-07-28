import Link from "next/link";
import { plans } from "../PricingCards";

function CheckIcon() {
  return (
    <svg className="h-4 w-4 shrink-0 text-[#D9BEF4]" fill="none" viewBox="0 0 20 20" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 6 8.5 13.5 4 9" />
    </svg>
  );
}

export function PricingSection() {
  return (
    <section className="border-t border-black/10 bg-[#fcfcfc] px-6 py-20 md:px-10 lg:px-14">
      <div className="mx-auto max-w-[88rem]">
        <span className="mb-5 block text-[11px] font-normal uppercase tracking-[0.18em] text-gray-500">
          Pricing
        </span>
        <h2 className="max-w-lg text-3xl font-normal leading-tight tracking-tight text-[#233D4D] [text-wrap:balance] md:text-5xl">
          One price, no surprise overage.
        </h2>
        <p className="mt-6 max-w-xl text-sm leading-6 text-gray-600 md:text-base">
          Every paid plan starts with a 10-day free trial of the full product, no credit card required.
        </p>

        <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`flex flex-col rounded-2xl p-8 ${
                plan.highlighted ? "bg-[#233D4D] text-white" : "bg-white shadow-[0_20px_60px_-48px_rgba(32,21,28,0.4)]"
              }`}
            >
              {plan.highlighted && (
                <span className="mb-4 inline-flex w-fit items-center rounded-full bg-[#D9BEF4] px-3 py-1 text-[11px] font-normal uppercase tracking-[0.16em] text-white">
                  Most popular
                </span>
              )}

              <h3 className={`text-xs font-normal uppercase tracking-[0.18em] ${plan.highlighted ? "text-white/50" : "text-gray-500"}`}>
                {plan.name}
              </h3>
              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="text-4xl font-normal tracking-tight">{plan.introPrice ?? plan.price}</span>
                <span className={`text-sm ${plan.highlighted ? "text-white/50" : "text-gray-500"}`}>{plan.cadence}</span>
                {plan.introPrice && (
                  <span className={`text-sm line-through ${plan.highlighted ? "text-white/30" : "text-gray-300"}`}>
                    {plan.price}
                  </span>
                )}
              </div>
              {plan.introNote && <p className="mt-1 text-xs text-[#D9BEF4]">{plan.introNote}</p>}
              <p className={`mt-4 min-h-[48px] text-sm leading-6 ${plan.highlighted ? "text-white/60" : "text-gray-500"}`}>
                {plan.description}
              </p>

              <Link
                href={plan.href}
                className={`mt-6 inline-flex h-12 items-center justify-center rounded-full px-5 text-sm font-normal transition ${
                  plan.highlighted ? "bg-[#D9BEF4] text-white hover:bg-[#D9BEF4]" : "bg-[#233D4D] text-white hover:bg-black"
                }`}
              >
                {plan.cta}
              </Link>

              <ul className={`mt-8 space-y-3 border-t pt-7 ${plan.highlighted ? "border-white/15" : "border-black/[0.06]"}`}>
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5">
                    <span className="mt-0.5">
                      <CheckIcon />
                    </span>
                    <span className={`text-sm leading-5 ${plan.highlighted ? "text-white/80" : "text-gray-600"}`}>
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-8 text-center text-sm text-gray-500">
          Prices in USD, billed monthly.{" "}
          <Link href="/pricing" className="text-[#233D4D] underline underline-offset-4">
            See full pricing details
          </Link>
        </p>
      </div>
    </section>
  );
}
