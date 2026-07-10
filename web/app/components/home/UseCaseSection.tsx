"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { mediaUrl } from "../../../lib/media";

const useCases = [
  {
    label: "Founders",
    tagline: "Keep investor, customer, and ops work from slipping",
    description:
      "Investor threads triaged by urgency, calendar conflicts caught before they bite, and revenue signals folded into one daily brief.",
    href: "/solutions/founders",
    video: { src: mediaUrl("/video/telegram_meeting.mp4"), width: 448, height: 848 },
  },
  {
    label: "Busy operators",
    tagline: "Turn scattered tasks into one approval flow",
    description:
      "Every inbound message and meeting is weighed against what you actually care about, then handed to you as one Telegram decision.",
    href: "/solutions/busy-operators",
    video: { src: mediaUrl("/video/telegram_mail.mp4"), width: 416, height: 848 },
  },
  {
    label: "Revenue teams",
    tagline: "Watch Stripe, Razorpay, Postgres, and MongoDB in one place",
    description:
      "Churn risk, failed payments, and MRR movement land next to your inbox and calendar, pulled from a durable memory you can query.",
    href: "/solutions/revenue-teams",
    video: { src: mediaUrl("/video/telegram_meeting_reminder.mp4"), width: 448, height: 848 },
  },
];

export function UseCaseSection() {
  const [active, setActive] = useState(0);
  const itemRefs = useRef<Array<HTMLDivElement | null>>([]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const index = Number(entry.target.getAttribute("data-index"));
          if (!Number.isNaN(index)) setActive(index);
        });
      },
      { rootMargin: "-45% 0px -45% 0px", threshold: 0 },
    );

    itemRefs.current.forEach((el) => el && observer.observe(el));
    return () => observer.disconnect();
  }, []);

  return (
    <section className="border-t border-black/10 bg-white px-6 py-20 md:px-10 lg:px-14">
      <div className="mx-auto max-w-[88rem]">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[0.6fr_0.4fr] lg:items-end">
          <h2 className="max-w-3xl text-3xl font-normal leading-tight tracking-tight text-[#20151c] [text-wrap:balance] md:text-5xl">
            Built for how you actually work.
          </h2>
          <p className="max-w-md text-sm leading-6 text-gray-600 md:text-base">
            Rizly adapts to the shape of your day, whether you are closing a round, running ops, or watching revenue move.
          </p>
        </div>

        <div className="mt-14 grid grid-cols-1 gap-10 lg:grid-cols-[1fr_0.8fr] lg:gap-16">
          <div>
            {useCases.map((useCase, index) => (
              <div
                key={useCase.label}
                ref={(el) => {
                  itemRefs.current[index] = el;
                }}
                data-index={index}
                className="flex min-h-[62vh] flex-col justify-center border-l-2 pl-8 transition-colors duration-500 lg:min-h-[70vh]"
                style={{ borderColor: index === active ? "#20151c" : "rgba(0,0,0,0.08)" }}
              >
                <span
                  className="mb-4 font-mono text-xs uppercase tracking-[0.2em] transition-colors duration-500"
                  style={{ color: index === active ? "#ff4f00" : "rgba(0,0,0,0.3)" }}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3
                  className="max-w-md text-2xl font-normal leading-snug tracking-tight transition-colors duration-500 md:text-3xl"
                  style={{ color: index === active ? "#20151c" : "rgba(32,21,28,0.28)" }}
                >
                  {useCase.tagline}
                </h3>
                <p
                  className="mt-4 max-w-sm text-sm leading-6 transition-colors duration-500 md:text-base"
                  style={{ color: index === active ? "#4b5563" : "rgba(75,85,99,0.35)" }}
                >
                  {useCase.description}
                </p>

                <div className="mt-6 flex w-full justify-center lg:hidden">
                  <div className="relative aspect-[448/848] w-full max-w-[240px] overflow-hidden rounded-2xl bg-black shadow-[0_24px_60px_-36px_rgba(32,21,28,0.4)]">
                    <video
                      src={useCase.video.src}
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

                <Link
                  href={useCase.href}
                  className="mt-6 inline-flex w-fit items-center gap-1.5 text-sm font-normal transition-colors duration-500"
                  style={{ color: index === active ? "#20151c" : "rgba(32,21,28,0.28)" }}
                >
                  {useCase.label} case study
                  <span aria-hidden="true">&rarr;</span>
                </Link>
              </div>
            ))}
          </div>

          <div className="hidden lg:block">
            <div className="sticky top-28 flex items-center justify-center rounded-[2rem] bg-[linear-gradient(135deg,#fff7f3_0%,#ffd9ce_42%,#f7b6c6_100%)] p-10 shadow-[0_42px_110px_-86px_rgba(244,114,98,0.56)]">
              <div className="relative aspect-[448/848] w-full max-w-[320px] overflow-hidden rounded-2xl bg-black shadow-[0_30px_80px_-40px_rgba(32,21,28,0.4)]">
                {useCases.map((useCase, index) => (
                  <video
                    key={useCase.href}
                    src={useCase.video.src}
                    autoPlay
                    loop
                    muted
                    playsInline
                    ref={(el) => {
                      if (el) el.playbackRate = 1.75;
                    }}
                    className="absolute inset-0 h-full w-full object-cover transition-opacity duration-700"
                    style={{ opacity: index === active ? 1 : 0 }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
