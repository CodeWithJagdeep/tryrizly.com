"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Reveal } from "../components/Reveal";

export type FaqItem = { q: string; a: string };
export type FaqCategory = { name: string; items: FaqItem[] };

function FaqRow({ item, isOpen, onToggle }: { item: FaqItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div
      className={`overflow-hidden border-2 border-black bg-white transition-all duration-200 ${
        isOpen ? "shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]" : "shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
      }`}
    >
      <button
        onClick={onToggle}
        className="group flex w-full items-center justify-between px-6 py-5 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FE7F2D]/50"
      >
        <span className="text-base font-bold text-black transition-colors duration-200 group-hover:text-[#FE7F2D]">
          {item.q}
        </span>
        <motion.span
          animate={{ rotate: isOpen ? 45 : 0 }}
          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
          className={`ml-4 flex h-7 w-7 shrink-0 items-center justify-center border-2 border-black text-base font-black transition-colors duration-200 ${
            isOpen ? "bg-[#FE7F2D] text-white" : "bg-white text-black group-hover:bg-black group-hover:text-white"
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
            <p className="px-6 py-6 pr-10 text-sm leading-relaxed text-gray-500 md:text-base">{item.a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FaqClient({ categories }: { categories: FaqCategory[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <section className="bg-[#fcfcfc] py-16 font-neue-haas md:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-16">
          {categories.map((category, categoryIndex) => (
            <div key={category.name} className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              <Reveal className="lg:col-span-4">
                <div className="lg:sticky lg:top-24">
                  <p className="font-mono text-xs font-bold tracking-widest text-black/20">
                    {String(categoryIndex + 1).padStart(2, "0")}
                  </p>
                  <h2 className="mt-2 text-2xl font-black uppercase tracking-tight text-black">
                    {category.name}
                  </h2>
                  <p className="mt-2 text-sm text-gray-400">
                    {category.items.length} question{category.items.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </Reveal>
              <div className="space-y-3 lg:col-span-8">
                {category.items.map((item, itemIndex) => {
                  const key = `${categoryIndex}-${itemIndex}`;
                  return (
                    <Reveal key={item.q} delay={itemIndex * 0.03}>
                      <FaqRow
                        item={item}
                        isOpen={openKey === key}
                        onToggle={() => setOpenKey(openKey === key ? null : key)}
                      />
                    </Reveal>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <Reveal>
          <div className="mt-20 flex flex-col items-start justify-between gap-6 border-2 border-black bg-white p-8 shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] md:flex-row md:items-center">
            <div>
              <h2 className="text-xl font-black uppercase tracking-tight text-black">
                Didn&apos;t find your answer?
              </h2>
              <p className="mt-1.5 text-sm text-gray-500">
                Ask us directly — a human reads every message.
              </p>
            </div>
            <a
              href="/contact"
              className="inline-flex h-12 shrink-0 items-center justify-center border-2 border-black bg-black px-8 text-sm font-semibold text-white transition-colors hover:bg-[#FE7F2D] hover:border-[#FE7F2D]"
            >
              Contact us
            </a>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
