"use client";

import { useState } from "react";

const tabs = [
  {
    name: "Brief",
    badge: "Morning brief",
    leftTitle: "Riz via Telegram",
    messages: [
      { side: "left", text: "3 urgent emails, 2 meetings today, and one failed Stripe payment overnight." },
      { side: "right", text: "Draft the investor reply and move the sprint review." },
    ],
    rightTitle: "What Riz prepares",
    rules: ["Inbox summary", "Calendar conflict check", "Revenue signal"],
  },
  {
    name: "Approve",
    badge: "Approval prompt",
    leftTitle: "Riz waiting for you",
    messages: [
      { side: "left", text: "Sprint review fits at 2 PM. Reply to Priya is drafted in your tone." },
      { side: "right", text: "Approve both." },
    ],
    rightTitle: "Approval rules",
    rules: ["Ask before sending email", "Ask before changing calendar", "Read-only revenue snapshots"],
  },
  {
    name: "Execute",
    badge: "Done",
    leftTitle: "Riz completed",
    messages: [
      { side: "left", text: "Reply sent. Sprint review moved to 2 PM. Reminder scheduled 30 minutes before." },
      { side: "right", text: "Keep watching for replies." },
    ],
    rightTitle: "Completed actions",
    rules: ["Email sent", "Calendar updated", "Reminder scheduled"],
  },
];

export function HeroWorkflowTabs() {
  const [activeIndex, setActiveIndex] = useState(0);
  const active = tabs[activeIndex];

  return (
    <>
      <div className="mx-auto mt-6 inline-flex rounded-md bg-black/5 p-1">
        {tabs.map((tab, index) => (
          <button
            key={tab.name}
            type="button"
            onClick={() => setActiveIndex(index)}
            className={`rounded px-4 py-2 text-xs font-normal transition ${
              activeIndex === index ? "bg-white text-black shadow-sm" : "text-gray-500 hover:text-black"
            }`}
            aria-pressed={activeIndex === index}
          >
            {tab.name}
          </button>
        ))}
      </div>

      <div className="mx-auto mt-8 grid max-w-3xl grid-cols-1 overflow-hidden rounded-t-lg border border-black/10 bg-white text-left shadow-[0_28px_80px_-45px_rgba(32,21,28,0.65)] md:grid-cols-[1.1fr_0.9fr]">
        <div className="border-b border-black/10 p-5 md:border-b-0 md:border-r">
          <div className="mb-4 flex items-center justify-between">
            <span className="text-xs font-normal">{active.leftTitle}</span>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-normal uppercase tracking-[0.08em] text-gray-600">
              {active.badge}
            </span>
          </div>
          <div className="space-y-3">
            {active.messages.map((message) => (
              <div
                key={message.text}
                className={`max-w-sm rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                  message.side === "right"
                    ? "ml-auto rounded-tr-sm bg-black text-white"
                    : "rounded-tl-sm bg-gray-100 text-black"
                }`}
              >
                {message.text}
              </div>
            ))}
          </div>
        </div>
        <div className="p-5">
          <div className="mb-4 text-xs font-normal">{active.rightTitle}</div>
          <div className="space-y-3">
            {active.rules.map((rule) => (
              <div key={rule} className="flex items-center justify-between rounded-md border border-black/10 px-3 py-2">
                <span className="text-xs text-gray-700">{rule}</span>
                <span className="h-2 w-2 rounded-full bg-gray-400" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
