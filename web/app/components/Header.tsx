'use client';

import { useState } from 'react';
import Link from 'next/link';

type DropdownItem = {
  label: string;
  description: string;
  href: string;
};

type DropdownGroup = {
  label: string;
  items: DropdownItem[];
};

const navGroups: DropdownGroup[] = [
  {
    label: 'Product',
    items: [
      {
        label: 'AI operator',
        description: 'Chat with Riz across inbox, calendar, and business data.',
        href: '/#capabilities',
      },
      {
        label: 'Email triage',
        description: 'Classify, summarize, draft, and route important messages.',
        href: '/#capabilities',
      },
      {
        label: 'Approvals',
        description: 'Approve outbound actions before anything is sent.',
        href: '/#how-it-works',
      },
    ],
  },
  {
    label: 'Solutions',
    items: [
      {
        label: 'Founders',
        description: 'Keep investor, customer, and ops work from slipping.',
        href: '/#day-in-life',
      },
      {
        label: 'Revenue teams',
        description: 'Watch Stripe, Razorpay, Postgres, and MongoDB signals.',
        href: '/#integrations',
      },
      {
        label: 'Busy operators',
        description: 'Turn scattered tasks into one approval flow.',
        href: '/#how-it-works',
      },
    ],
  },
  {
    label: 'Learning',
    items: [
      {
        label: 'Blog',
        description: 'Read product notes and operator workflows.',
        href: '/blog',
      },
      {
        label: 'Trust',
        description: 'See how approval-first automation works.',
        href: '/#trust',
      },
      {
        label: 'FAQ',
        description: 'Answers on setup, billing, and controls.',
        href: '/#faq',
      },
    ],
  },
];

function Chevron({ className = '' }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      width="10"
      height="10"
      viewBox="0 0 16 16"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M8 10.98c-.15 0-.35-.05-.45-.15l-5.5-4.5a.75.75 0 1 1 .95-1.15l5 4.1 5-4.1a.75.75 0 0 1 .95 1.15l-5.5 4.5c-.1.1-.3.15-.45.15Z"
        fill="currentColor"
      />
    </svg>
  );
}

function DropdownNav({ group }: { group: DropdownGroup }) {
  const buttonClassName = 'inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-[15px] font-medium text-black/90 transition hover:bg-slate-100 hover:text-black focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300';

  return (
    <div className="group relative">
      <button type="button" className={buttonClassName} aria-haspopup="menu">
        {group.label}
        <Chevron className="transition-transform duration-200 group-hover:rotate-180" />
      </button>
      <div
        className="invisible absolute left-0 top-full z-50 mt-3 w-[330px] translate-y-1 rounded-[18px] border border-slate-200 bg-white p-2 opacity-0 shadow-[0_24px_80px_-28px_rgba(15,23,42,0.45)] transition duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100"
        role="menu"
      >
        {group.items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="block rounded-xl px-4 py-3 text-left transition hover:bg-slate-50"
            role="menuitem"
          >
            <span className="block text-[15px] font-semibold text-black">{item.label}</span>
            <span className="mt-1 block text-[13px] leading-5 text-slate-500">{item.description}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const headerClassName = 'sticky top-0 z-50 w-full bg-white/95 font-neue-haas backdrop-blur-md';
  const pricingClassName = 'hidden h-11 items-center rounded-full px-3 text-[15px] font-medium text-black/90 transition hover:bg-slate-100 hover:text-black lg:inline-flex';
  const utilityLinkClassName = 'hidden h-10 items-center rounded-full px-3 text-[15px] font-medium text-black/90 transition hover:bg-slate-100 hover:text-black xl:inline-flex';
  const loginClassName = 'hidden h-10 items-center rounded-full px-3 text-[15px] font-medium text-black/90 transition hover:bg-slate-100 hover:text-black lg:inline-flex';
  const mobileLineClassName = 'bg-slate-950';

  return (
    <>
      {/* Promotional Header */}
      <div className="sticky top-0 z-50 w-full border-b border-[#233D4D]/20 bg-[#233D4D] px-4 py-3.5 sm:px-6 lg:px-14">
        <div className="flex flex-col items-center justify-center gap-3 text-center sm:flex-row sm:justify-center sm:gap-4">
          <p className="text-sm font-medium text-white">
            We're changing how AI works. You stay in control. AI works for you.
          </p>
          <a href="#" className="whitespace-nowrap text-sm font-semibold text-white/90 transition hover:text-white">
            Discover the difference
            <span className="ml-1.5">→</span>
          </a>
        </div>
      </div>

      <header className={headerClassName}>
      <nav
        className="flex h-[68px] items-center gap-6 px-14"
        aria-label="Main navigation"
      >
        <Link className="flex shrink-0 items-center transition-opacity hover:opacity-80" href="/">
          <img
            alt="Heyriz Logo"
            loading="lazy"
            width={112}
            height={26}
            decoding="async"
            data-nimg="1"
            className="h-8 w-auto object-contain"
            style={{ color: 'transparent' }}
            src="/heyriz_white.png"
          />
        </Link>

        <div className="hidden items-center gap-1 lg:flex" role="tablist" aria-label="Navigation groups">
          {navGroups.map((group) => (
            <DropdownNav key={group.label} group={group} />
          ))}
        </div>

        <Link className={pricingClassName} href="/pricing">
          Pricing
        </Link>

        <div className="flex-1" />

        <div className="hidden items-center gap-1 lg:flex">
          <Link className={utilityLinkClassName} href="/#trust">
            Contact sales
          </Link>
          <Link className={loginClassName} href="/login">
            Log in
          </Link>
          <Link
            className="inline-flex h-11 items-center justify-center bg-[#FE7F2D] px-5 text-[15px] font-medium text-white transition hover:opacity-90 active:scale-[0.98]"
            href="/signup"
          >
            Get started
          </Link>
        </div>

        <button
          onClick={() => setIsMobileMenuOpen((open) => !open)}
          className="relative z-50 ml-auto flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-slate-100 lg:hidden"
          aria-label={isMobileMenuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={isMobileMenuOpen}
        >
          <div className="flex h-5 w-5 flex-col justify-center">
            <span
              className={`mb-1 block h-0.5 w-5 transition-transform duration-300 ${mobileLineClassName}`}
              style={{
                transform: isMobileMenuOpen ? 'rotate(45deg) translate(4px, 4px)' : 'none',
              }}
            />
            <span
              className={`mb-1 block h-0.5 w-5 transition-opacity duration-300 ${mobileLineClassName}`}
              style={{ opacity: isMobileMenuOpen ? 0 : 1 }}
            />
            <span
              className={`block h-0.5 w-5 transition-transform duration-300 ${mobileLineClassName}`}
              style={{
                transform: isMobileMenuOpen ? 'rotate(-45deg) translate(5px, -5px)' : 'none',
              }}
            />
          </div>
        </button>
      </nav>

      {isMobileMenuOpen && (
        <div className="fixed inset-x-0 top-[104px] z-40 max-h-[calc(100vh-104px)] overflow-y-auto border-t border-slate-200 bg-white px-5 py-5 shadow-[0_24px_80px_-35px_rgba(15,23,42,0.35)] lg:hidden">
          <nav className="flex flex-col gap-2" aria-label="Mobile navigation">
            {navGroups.map((group) => (
              <div key={group.label} className="border-b border-slate-100 pb-3">
                <div className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-slate-400">
                  {group.label}
                </div>
                {group.items.map((item) => (
                  <Link
                    key={item.label}
                    onClick={() => setIsMobileMenuOpen(false)}
                    href={item.href}
                    className="block rounded-xl px-2 py-2.5"
                  >
                    <span className="block text-[15px] font-semibold text-black">{item.label}</span>
                    <span className="mt-0.5 block text-[13px] leading-5 text-slate-500">
                      {item.description}
                    </span>
                  </Link>
                ))}
              </div>
            ))}
            <Link
              onClick={() => setIsMobileMenuOpen(false)}
              href="/pricing"
              className="rounded-xl px-2 py-3 text-[15px] font-semibold text-black"
            >
              Pricing
            </Link>
            <Link
              onClick={() => setIsMobileMenuOpen(false)}
              href="/login"
              className="rounded-xl px-2 py-3 text-[15px] font-semibold text-black"
            >
              Log in
            </Link>
            <Link
              onClick={() => setIsMobileMenuOpen(false)}
              className="mt-2 flex h-12 items-center justify-center rounded-full bg-[#3784ff] text-[15px] font-semibold text-white"
              href="/signup"
            >
              Get started
            </Link>
          </nav>
        </div>
      )}
    </header>
    </>
  );
}
