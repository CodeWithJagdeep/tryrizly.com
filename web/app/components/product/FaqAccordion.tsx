"use client";

import { useState } from "react";

export function FaqAccordion({ items }: { items: { q: string; a: string }[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="space-y-2">
      {items.map((item, index) => {
        const isOpen = openIndex === index;
        return (
          <div key={item.q} className="overflow-hidden rounded-2xl bg-[#f7f7f6]">
            <button
              onClick={() => setOpenIndex(isOpen ? null : index)}
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
            {isOpen ? (
              <p className="px-6 pb-6 pr-12 text-sm leading-relaxed text-gray-600">{item.a}</p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
