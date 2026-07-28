"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Reveal } from "../Reveal";

const faqs = [
  {
    q: "Does Riz send anything without asking me first?",
    a: "No. Every draft and action waits for your approval in Telegram, unless you've explicitly turned on auto-act for that category in your preferences.",
  },
  {
    q: "What happens if I don't connect Telegram?",
    a: "Gmail and Calendar still get triaged in the background, but you won't get real-time approve or reject prompts. You'd need to check the dashboard instead of a chat message.",
  },
  {
    q: "Which business tools can it watch?",
    a: "Stripe, Razorpay, PostgreSQL, and MongoDB today. Connect one and Riz can fold revenue and signals into your daily brief.",
  },
  {
    q: "What happens if I go over my AI budget?",
    a: "You get a warning at 80% of your plan's budget. At 100%, background features (decisions, memory, the daily brief) pause and chat switches to a lighter model, no surprise overage charge.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes, from the dashboard with no lock-in. Cancellation takes effect at the end of the current billing period, so you keep everything you paid for.",
  },
];

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="border-t-2 border-black/10 bg-white py-20 md:py-28 font-neue-haas">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <p className="text-[11px] font-black uppercase tracking-[0.25em] text-[#D9BEF4]">FAQ</p>
          <h2 className="mt-4 text-3xl font-black uppercase tracking-tight text-black md:text-4xl">
            Questions worth answering up front.
          </h2>
        </Reveal>

        <div className="mt-10 space-y-3">
          {faqs.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <Reveal key={item.q} delay={index * 0.04}>
                <div
                  className={`overflow-hidden border-2 border-black bg-white transition-all duration-200 ${
                    isOpen ? "shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]" : "shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  }`}
                >
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="group flex w-full items-center justify-between px-6 py-5 text-left focus:outline-none"
                  >
                    <span className="text-base font-bold text-black transition-colors duration-200 group-hover:text-[#D9BEF4] md:text-lg">
                      {item.q}
                    </span>
                    <motion.span
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className={`ml-4 flex h-7 w-7 shrink-0 items-center justify-center border-2 border-black text-base font-black transition-colors duration-200 ${
                        isOpen ? "bg-[#D9BEF4] text-white" : "bg-white text-black group-hover:bg-black group-hover:text-white"
                      }`}
                    >
                      +
                    </motion.span>
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="overflow-hidden border-t-2 border-black/10"
                      >
                        <p className="px-6 py-6 pr-10 text-sm leading-relaxed text-gray-500 md:text-base">
                          {item.a}
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </Reveal>
            );
          })}
        </div>

        <Reveal>
          <div className="mt-10 flex flex-wrap items-center justify-between gap-4 border-t-2 border-black/10 pt-8">
            <p className="text-sm text-gray-500">Still curious? There&apos;s a longer list.</p>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <a
                href="/faq"
                className="group inline-flex items-center gap-2 text-[13px] font-black uppercase tracking-tight text-black transition-colors hover:text-[#D9BEF4]"
              >
                Read all FAQs
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </a>
              <a
                href="/contact"
                className="group inline-flex items-center gap-2 text-[13px] font-black uppercase tracking-tight text-black transition-colors hover:text-[#D9BEF4]"
              >
                Ask us directly
                <span className="transition-transform group-hover:translate-x-0.5">→</span>
              </a>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
