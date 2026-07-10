"use client";

import { useState } from "react";
import { mediaUrl } from "../../../lib/media";

const tabs = [
  {
    name: "Brief",
    badge: "Morning brief",
    leftTitle: "Riz via Telegram",
    video: { src: mediaUrl("/video/telegram_mail.mp4"), width: 416, height: 848 },
    rightTitle: "What Riz prepares",
    rules: ["Inbox summary", "Calendar conflict check", "Revenue signal"],
  },
  {
    name: "Approve",
    badge: "Approval prompt",
    leftTitle: "Riz waiting for you",
    video: { src: mediaUrl("/video/telegram_meeting.mp4"), width: 448, height: 848 },
    rightTitle: "Approval rules",
    rules: ["Ask before sending email", "Ask before changing calendar", "Read-only revenue snapshots"],
  },
  {
    name: "Execute",
    badge: "Done",
    leftTitle: "Riz completed",
    video: { src: mediaUrl("/video/telegram_meeting_reminder.mp4"), width: 448, height: 848 },
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
        <div className="flex flex-col border-b border-black/10 md:border-b-0 md:border-r">
          <div className="flex items-center justify-between px-5 pt-5">
            <span className="text-xs font-normal">{active.leftTitle}</span>
            <span className="rounded-full bg-gray-100 px-3 py-1 text-[10px] font-normal uppercase tracking-[0.08em] text-gray-600">
              {active.badge}
            </span>
          </div>
          <div className="mt-4 flex justify-center px-5 pb-5">
            <div
              className="relative w-full max-w-[220px] overflow-hidden rounded-xl bg-black"
              style={{ aspectRatio: `${active.video.width} / ${active.video.height}` }}
            >
              <video
                key={active.video.src}
                src={active.video.src}
                autoPlay
                loop
                muted
                playsInline
                ref={(el) => {
                  if (el) el.playbackRate = 1.75;
                }}
                className="h-full w-full object-cover"
              />
            </div>
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
