'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

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

function DropdownNav({ group, dark }: { group: DropdownGroup; dark: boolean }) {
  const buttonClassName = dark
    ? 'inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-white/78 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white/50'
    : 'inline-flex h-11 items-center gap-1.5 rounded-full px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-300';

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
            <span className="block text-sm font-semibold text-slate-950">{item.label}</span>
            <span className="mt-1 block text-xs leading-5 text-slate-500">{item.description}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();
  const isHome = pathname === '/';

  const headerClassName = isHome
    ? 'sticky top-0 z-50 w-full border-b border-white/10 bg-black font-neue-haas'
    : 'sticky top-0 z-50 w-full border-b border-slate-200/70 bg-white/95 font-neue-haas backdrop-blur-md';
  const pricingClassName = isHome
    ? 'hidden h-11 items-center rounded-full px-3 text-sm font-medium text-white/78 transition hover:bg-white/10 hover:text-white lg:inline-flex'
    : 'hidden h-11 items-center rounded-full px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 lg:inline-flex';
  const utilityLinkClassName = isHome
    ? 'hidden h-10 items-center rounded-full px-3 text-sm font-medium text-white/72 transition hover:bg-white/10 hover:text-white xl:inline-flex'
    : 'hidden h-10 items-center rounded-full px-3 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-950 xl:inline-flex';
  const loginClassName = isHome
    ? 'hidden h-10 items-center rounded-full px-3 text-sm font-medium text-white/78 transition hover:bg-white/10 hover:text-white lg:inline-flex'
    : 'hidden h-10 items-center rounded-full px-3 text-sm font-medium text-slate-700 transition hover:bg-slate-100 hover:text-slate-950 lg:inline-flex';
  const mobileLineClassName = isHome ? 'bg-white' : 'bg-slate-950';

  return (
    <header className={headerClassName}>
      <Link
        href="/signup"
        className={
          isHome
            ? 'group block w-full border-b border-white/10 bg-[#0b0b0d] px-4 py-2.5 text-center text-xs font-medium text-white/82 transition-colors hover:bg-[#121216]'
            : 'group block w-full border-b border-slate-200/70 bg-[#d5e5ff] px-4 py-2.5 text-center text-xs font-medium text-slate-800 transition-colors hover:bg-[#c0d9ff]'
        }
      >
        <span className="mx-auto flex max-w-337 items-center justify-center gap-2">
          <span className="rounded-full bg-[#2563eb] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-white">
            New
          </span>
          <span>Your inbox, calendar, and business data — one message away.</span>
          <svg
            className="h-4 w-4 transition-transform group-hover:translate-x-1"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </span>
      </Link>

      <nav
        className="mx-auto flex h-[68px] max-w-337 items-center gap-6 px-4 sm:px-6 lg:px-11.5"
        aria-label="Main navigation"
      >
        <Link className="flex shrink-0 items-center transition-opacity hover:opacity-80" href="/">
          <img
            alt="Heyriz Logo"
            loading="lazy"
            width={isHome ? 100 : 112}
            height={isHome ? 23 : 26}
            decoding="async"
            data-nimg="1"
            className={isHome ? 'object-contain brightness-0 invert' : 'object-contain'}
            style={{ color: 'transparent' }}
            src={isHome ? '/heyriz-transparent.png' : '/heyriz.png'}
          />
        </Link>

        <div className="hidden items-center gap-1 lg:flex" role="tablist" aria-label="Navigation groups">
          {navGroups.map((group) => (
            <DropdownNav key={group.label} group={group} dark={isHome} />
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
            className="inline-flex h-11 items-center justify-center rounded-full bg-[#3784ff] px-5 text-sm font-semibold text-white transition hover:bg-[#2c72e5] active:scale-[0.98]"
            href="/signup"
          >
            Get started
          </Link>
        </div>

        <button
          onClick={() => setIsMobileMenuOpen((open) => !open)}
          className="relative z-50 ml-auto flex h-10 w-10 items-center justify-center rounded-full transition hover:bg-white/10 lg:hidden"
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
                <div className="mb-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">
                  {group.label}
                </div>
                {group.items.map((item) => (
                  <Link
                    key={item.label}
                    onClick={() => setIsMobileMenuOpen(false)}
                    href={item.href}
                    className="block rounded-xl px-2 py-2.5"
                  >
                    <span className="block text-sm font-semibold text-slate-950">{item.label}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-slate-500">
                      {item.description}
                    </span>
                  </Link>
                ))}
              </div>
            ))}
            <Link
              onClick={() => setIsMobileMenuOpen(false)}
              href="/pricing"
              className="rounded-xl px-2 py-3 text-sm font-semibold text-slate-950"
            >
              Pricing
            </Link>
            <Link
              onClick={() => setIsMobileMenuOpen(false)}
              href="/login"
              className="rounded-xl px-2 py-3 text-sm font-semibold text-slate-950"
            >
              Log in
            </Link>
            <Link
              onClick={() => setIsMobileMenuOpen(false)}
              className="mt-2 flex h-12 items-center justify-center rounded-full bg-[#3784ff] text-sm font-semibold text-white"
              href="/signup"
            >
              Get started
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
