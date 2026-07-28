"use client";

import { useState } from "react";

export type FaqItem = { q: string; a: string };
export type FaqCategory = { name: string; items: FaqItem[] };

function FaqRow({ item, isOpen, onToggle }: { item: FaqItem; isOpen: boolean; onToggle: () => void }) {
  return (
    <div className="overflow-hidden rounded-2xl bg-[#f7f7f6]">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-6 py-5 text-left focus:outline-none"
      >
        <span className="text-base font-normal text-[#233D4D]">{item.q}</span>
        <span
          className={`ml-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-base transition-transform duration-300 ${
            isOpen ? "rotate-45 bg-[#233D4D] text-white" : "bg-white text-[#233D4D]"
          }`}
        >
          +
        </span>
      </button>
      {isOpen ? <p className="px-6 pb-6 pr-12 text-sm leading-relaxed text-gray-600">{item.a}</p> : null}
    </div>
  );
}

export function FaqClient({ categories }: { categories: FaqCategory[] }) {
  const [openKey, setOpenKey] = useState<string | null>(null);

  return (
    <section className="bg-[#fcfcfc] px-6 py-16 md:px-10 md:py-24 lg:px-14">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-16">
          {categories.map((category, categoryIndex) => (
            <div key={category.name} className="grid grid-cols-1 gap-8 lg:grid-cols-12">
              <div className="lg:col-span-4">
                <div className="lg:sticky lg:top-24">
                  <p className="font-mono text-xs uppercase tracking-[0.2em] text-[#D9BEF4]">
                    {String(categoryIndex + 1).padStart(2, "0")}
                  </p>
                  <h2 className="mt-2 text-2xl font-normal tracking-tight text-[#233D4D]">{category.name}</h2>
                  <p className="mt-2 text-sm text-gray-500">
                    {category.items.length} question{category.items.length !== 1 ? "s" : ""}
                  </p>
                </div>
              </div>
              <div className="space-y-2 lg:col-span-8">
                {category.items.map((item, itemIndex) => {
                  const key = `${categoryIndex}-${itemIndex}`;
                  return (
                    <FaqRow
                      key={item.q}
                      item={item}
                      isOpen={openKey === key}
                      onToggle={() => setOpenKey(openKey === key ? null : key)}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="mt-20 flex flex-col items-start justify-between gap-6 rounded-2xl bg-white p-8 shadow-[0_20px_60px_-48px_rgba(32,21,28,0.4)] md:flex-row md:items-center">
          <div>
            <h2 className="text-xl font-normal text-[#233D4D]">Didn&apos;t find your answer?</h2>
            <p className="mt-1.5 text-sm text-gray-600">Ask us directly, a human reads every message.</p>
          </div>
          <a
            href="/contact"
            className="inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-[#233D4D] px-8 text-sm font-normal text-white transition hover:bg-black"
          >
            Contact us
          </a>
        </div>
      </div>
    </section>
  );
}
