"use client";

import { useState } from "react";

const faqs = [
  {
    question: "How does approval-first automation work?",
    answer: "Every action Rizly suggests requires your explicit approval. The system monitors your inbox, calendar, and revenue streams, then drafts responses or actions. You review everything before anything is sent or executed.",
  },
  {
    question: "Is my data encrypted and secure?",
    answer: "Yes. All data is encrypted with AES-256 and processed in isolated, ephemeral containers that are destroyed after each session. We're GDPR and CCPA compliant with zero data retention policies.",
  },
  {
    question: "What happens if I don't approve something?",
    answer: "Nothing happens. If you reject an approval or don't respond, Rizly simply queues it for later or escalates to a human reviewer. Your silence is never interpreted as approval.",
  },
  {
    question: "How much does Rizly cost?",
    answer: "We offer flexible pricing based on your usage and needs. Start with a free trial to see the impact, then choose a plan that works for your team.",
  },
];

export default function FAQSection() {
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  return (
    <section className="px-10 md:px-14 py-40 border-b-2 border-black/10 bg-[#fcfcfc]">
      <div className="max-w-4xl mx-auto">
        <h2 className="text-4xl md:text-6xl font-semibold uppercase tracking-tight mb-20 text-center">
          Common <br />
          <span className="text-[#FE7F2D]">questions</span>
        </h2>
        <div className="space-y-4">
          {faqs.map((faq, index) => (
            <div
              key={index}
              className="border border-gray-200 bg-white rounded overflow-hidden hover:border-[#FE7F2D] transition-colors"
            >
              <button
                onClick={() =>
                  setExpandedIndex(expandedIndex === index ? null : index)
                }
                className="w-full p-6 flex items-center justify-between text-left hover:bg-[#FE7F2D]/5 transition-colors"
              >
                <h4 className="text-lg font-semibold">{faq.question}</h4>
                <span
                  className={`text-[#FE7F2D] text-xl transition-transform ${
                    expandedIndex === index ? "rotate-90" : ""
                  }`}
                >
                  →
                </span>
              </button>
              {expandedIndex === index && (
                <div className="px-6 pb-6 border-t border-gray-200 bg-[#FE7F2D]/5">
                  <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
