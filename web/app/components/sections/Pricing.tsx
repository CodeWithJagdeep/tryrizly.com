import Link from "next/link";
import { Reveal } from "../Reveal";
import { PricingCards } from "../PricingCards";

export function Pricing() {
  return (
    <section className="bg-[#fcfcfc] py-20 md:py-28 font-neue-haas" id="pricing">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#D9BEF4]">Pricing</p>
          <h2 className="mt-4 max-w-lg text-3xl font-black uppercase tracking-tight text-black md:text-4xl">
            One price, no surprise overage.
          </h2>
          <p className="mt-3 max-w-xl text-base leading-relaxed text-gray-500">
            Every paid plan starts with a 10-day free trial of the full product — no credit card
            required.
          </p>
        </Reveal>

        <Reveal delay={0.05}>
          <div className="mt-12">
            <PricingCards />
          </div>
        </Reveal>

        <Reveal>
          <div className="mt-8 flex flex-wrap items-center justify-between gap-4">
            <p className="text-sm text-gray-400">
              Billed monthly through Razorpay. Cancel anytime — access runs to the end of the period.
            </p>
            <Link
              href="/pricing"
              className="group inline-flex items-center gap-2 text-[13px] font-black uppercase tracking-tight text-black transition-colors hover:text-[#D9BEF4]"
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
