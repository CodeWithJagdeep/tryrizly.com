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
    a: "Yes. Cancelling takes effect immediately, no lock-in.",
  },
];

export function Faq() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="bg-slate-50/50 py-20 md:py-28">
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <Reveal>
          <h2 className="font-neue-haas text-3xl font-normal tracking-tight text-slate-900 md:text-4xl text-center md:text-left">
            Questions worth answering up front.
          </h2>
        </Reveal>

        <div className="mt-10 border-t border-slate-200">
          {faqs.map((item, index) => {
            const isOpen = openIndex === index;
            return (
              <Reveal key={item.q} delay={index * 0.04}>
                <div className="border-b border-slate-200">
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : index)}
                    className="flex w-full items-center justify-between py-6 text-left focus:outline-none group"
                  >
                    <span className="text-base font-semibold text-slate-900 transition-colors duration-200 group-hover:text-[#3784ff] md:text-lg">
                      {item.q}
                    </span>
                    <motion.span
                      animate={{ rotate: isOpen ? 45 : 0 }}
                      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                      className={`ml-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base font-medium transition-colors duration-200 ${
                        isOpen
                          ? "bg-[#3784ff]/10 text-[#3784ff]"
                          : "bg-slate-100 text-slate-400 group-hover:bg-slate-200 group-hover:text-slate-600"
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
                        className="overflow-hidden"
                      >
                        <p className="pb-6 pr-10 text-sm leading-relaxed text-slate-600 md:text-base">
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
      </div>
    </section>
  );
}
