'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

type Session = { email: string; name?: string; userId: string };

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
        label: 'Features',
        description: 'Explore all the ways Rizly can help your team.',
        href: '/features',
      },
      {
        label: 'AI operator',
        description: 'Chat with Riz across inbox, calendar, and business data.',
        href: '/product/ai-operator',
      },
      {
        label: 'Email triage',
        description: 'Classify, summarize, draft, and route important messages.',
        href: '/product/email-triage',
      },
      {
        label: 'Approvals',
        description: 'Approve outbound actions before anything is sent.',
        href: '/product/approvals',
      },
    ],
  },
  {
    label: 'Solutions',
    items: [
      {
        label: 'Founders',
        description: 'Keep investor, customer, and ops work from slipping.',
        href: '/solutions/founders',
      },
      {
        label: 'Revenue teams',
        description: 'Watch Stripe, Razorpay, Postgres, and MongoDB signals.',
        href: '/solutions/revenue-teams',
      },
      {
        label: 'Busy operators',
        description: 'Turn scattered tasks into one approval flow.',
        href: '/solutions/busy-operators',
      },
    ],
  },
  {
    label: 'Learning',
    items: [
      {
        label: 'Trust',
        description: 'See how approval-first automation works.',
        href: '/trust',
      },
      {
        label: 'FAQ',
        description: 'Answers on setup, billing, and controls.',
        href: '/faq',
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

function PixelMark() {
  return (
    <span aria-hidden="true" className="rizly-pixel-mark hidden grid-cols-3 gap-[2px] sm:grid">
      {Array.from({ length: 9 }, (_, index) => (
        <span key={index} />
      ))}
    </span>
  );
}

function DropdownNav({ group, featured = false }: { group: DropdownGroup; featured?: boolean }) {
  const buttonClassName = 'rizly-nav-item inline-flex h-11 items-center gap-1.5 px-3 text-base font-normal text-white/90 transition-colors hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white/35';

  return (
    <div className="group relative" data-featured={featured || undefined}>
      <button type="button" className={buttonClassName} aria-haspopup="menu">
        {group.label}
        <Chevron className="transition-transform duration-200 group-hover:rotate-180" />
      </button>
      <div
        className="invisible absolute left-0 top-full z-50 mt-3 w-[330px] translate-y-1 rounded-[18px] border border-white/10 bg-[var(--rizly-surface)] p-2 opacity-0 shadow-[0_28px_90px_-30px_rgba(0,0,0,0.9)] transition duration-150 group-hover:visible group-hover:translate-y-0 group-hover:opacity-100 group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100"
        role="menu"
      >
        {group.items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="block rounded-xl px-4 py-3 text-left transition hover:bg-white/[0.06]"
            role="menuitem"
          >
            <span className="block text-base font-normal text-white/90">{item.label}</span>
            <span className="mt-1 block text-[13px] leading-5 text-[var(--rizly-text-muted)]">{item.description}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

export function Header({
  session,
  variant = 'full',
}: {
  session: Session | null;
  /** "minimal" strips the announcement bar, nav links, and right-side actions down to just the logo, and drops sticky positioning. */
  variant?: 'full' | 'minimal';
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const headerClassName = 'w-full bg-black font-display';
  const pricingClassName = 'hidden h-11 items-center rounded-full px-3 text-base font-normal text-white/90 transition hover:bg-white/[0.07] hover:text-white lg:inline-flex';
  const utilityLinkClassName = 'hidden h-10 items-center rounded-full px-3 text-base font-normal text-white/90 transition hover:bg-white/[0.07] hover:text-white xl:inline-flex';
  const loginClassName = 'hidden h-10 items-center rounded-full px-3 text-base font-normal text-white/90 transition hover:bg-white/[0.07] hover:text-white lg:inline-flex';
  const mobileLineClassName = 'bg-[var(--rizly-text)]';

  if (variant === 'minimal') {
    return (
      <div className="relative w-full bg-black text-[var(--rizly-text)]">
        <header className={headerClassName}>
          <nav
            className="mx-auto flex h-[72px] w-full max-w-[88rem] items-center border-b border-white/10 px-5 sm:px-8 lg:px-14"
            aria-label="Main navigation"
          >
            <Link className="group/logo flex w-fit shrink-0 items-center gap-3 transition-opacity hover:opacity-90" href="/">
              <Image
                alt="rizly Logo"
                width={112}
                height={26}
                className="h-8 w-auto object-contain opacity-85 brightness-0 invert"
                src="/rizly_white.png"
                priority
              />
              <PixelMark />
            </Link>
          </nav>
        </header>
      </div>
    );
  }

  return (
    <div className="sticky top-0 z-50 w-full bg-black text-[var(--rizly-text)]">
      <div className="w-full border-b border-white/10 bg-black">
        <div className="mx-auto flex min-h-11 w-full max-w-[88rem] items-center justify-center overflow-hidden px-4 py-2 sm:px-8">
          <a
            className="rizly-announcement group grid min-w-0 flex-1 grid-cols-[auto_minmax(0,auto)_minmax(24px,1fr)_auto] items-center gap-3 text-[13px] font-normal text-white/90 sm:gap-5 sm:text-sm"
            href="/agent"
          >
            <span className="rizly-announcement-badge relative inline-flex shrink-0 items-center gap-2 overflow-hidden bg-[var(--rizly-ai)] px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-white shadow-[0_8px_24px_-14px_rgba(35,61,77,0.7)]">
              <span className="relative h-1.5 w-1.5">
                <span className="absolute inset-0 rounded-full bg-[var(--rizly-accent)]/40 motion-safe:animate-ping" />
                <span className="absolute inset-0 rounded-full bg-[var(--rizly-accent)]" />
              </span>
              Field Note 01
            </span>
            <span className="truncate transition-colors duration-200 group-hover:text-white">
              Introducing Riz, the operator that asks before it acts
            </span>
            <span aria-hidden="true" className="rizly-pixel-rail h-[3px] min-w-0" />
            <span
              aria-hidden="true"
              className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/20 text-white transition-[transform,border-color,background-color] duration-200 ease-[cubic-bezier(0.23,1,0.32,1)] group-hover:translate-x-1 group-hover:border-white/55 group-hover:bg-white/10 group-active:scale-[0.96]"
            >
              ↗
            </span>
          </a>
        </div>
      </div>

      <header className={headerClassName}>
      <nav
        className="mx-auto grid h-[72px] w-full max-w-[88rem] grid-cols-[1fr_auto] items-center border-b border-white/10 px-5 sm:px-8 lg:grid-cols-[1fr_auto_1fr] lg:px-14"
        aria-label="Main navigation"
      >
        <Link className="group/logo flex w-fit shrink-0 items-center gap-3 justify-self-start transition-opacity hover:opacity-90" href="/">
          <Image
            alt="rizly Logo"
            width={112}
            height={26}
            className="h-8 w-auto object-contain opacity-85 brightness-0 invert"
            src="/rizly_white.png"
            priority
          />
          <PixelMark />
        </Link>

        <div className="hidden items-center gap-2 justify-self-center lg:flex" role="tablist" aria-label="Navigation groups">
          {navGroups.map((group, index) => (
            <DropdownNav key={group.label} group={group} featured={index === 0} />
          ))}
          <Link className={`${pricingClassName} rizly-nav-item`} href="/pricing">
            Pricing
          </Link>
        </div>

        <div className="hidden items-center gap-1 justify-self-end lg:flex">
          <Link className={utilityLinkClassName} href="/contact">
            Contact sales
          </Link>
          {session ? (
            <Link
              className="rizly-stepped-button inline-flex h-11 items-center justify-center border border-white bg-white px-5 text-base font-normal text-black transition-[transform,background-color,color] duration-200 hover:-translate-y-0.5 hover:bg-white/90 active:scale-[0.98]"
              href="/dashboard"
            >
              Go to dashboard
            </Link>
          ) : (
            <>
              <Link className={loginClassName} href="/login">
                Log in
              </Link>
              <Link
                className="rizly-stepped-button inline-flex h-11 items-center justify-center border border-white bg-white px-5 text-base font-normal text-black transition-[transform,background-color,color] duration-200 hover:-translate-y-0.5 hover:bg-white/90 active:scale-[0.98]"
                href="/signup"
              >
                Get started
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setIsMobileMenuOpen((open) => !open)}
          className="relative z-50 flex h-10 w-10 items-center justify-center justify-self-end rounded-full transition hover:bg-white/10 lg:hidden"
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
        <div className="fixed inset-x-0 top-[116px] z-40 max-h-[calc(100vh-116px)] overflow-y-auto border-t border-white/10 bg-black px-5 py-5 shadow-[0_28px_90px_-35px_rgba(0,0,0,0.95)] lg:hidden">
          <nav className="flex flex-col gap-2" aria-label="Mobile navigation">
            {navGroups.map((group) => (
              <div key={group.label} className="border-b border-white/10 pb-3">
                <div className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-white/35">
                  {group.label}
                </div>
                {group.items.map((item) => (
                  <Link
                    key={item.label}
                    onClick={() => setIsMobileMenuOpen(false)}
                    href={item.href}
                    className="block rounded-xl px-2 py-2.5 transition hover:bg-white/[0.06]"
                  >
                    <span className="block text-base font-normal text-white/90">{item.label}</span>
                    <span className="mt-0.5 block text-[13px] leading-5 text-[var(--rizly-text-muted)]">
                      {item.description}
                    </span>
                  </Link>
                ))}
              </div>
            ))}
            <Link
              onClick={() => setIsMobileMenuOpen(false)}
              href="/pricing"
              className="rounded-xl px-2 py-3 text-base font-semibold text-white/90"
            >
              Pricing
            </Link>
            {session ? (
              <Link
                onClick={() => setIsMobileMenuOpen(false)}
                href="/dashboard"
                className="mt-2 flex h-12 items-center justify-center rounded-full border border-white/20 bg-transparent text-base font-normal text-white/90 transition hover:border-white/40 hover:bg-white/[0.07] hover:text-white active:scale-[0.98]"
              >
                Go to dashboard
              </Link>
            ) : (
              <>
                <Link
                  onClick={() => setIsMobileMenuOpen(false)}
                  href="/login"
                  className="rounded-xl px-2 py-3 text-base font-semibold text-white/90"
                >
                  Log in
                </Link>
                <Link
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="mt-2 flex h-12 items-center justify-center rounded-full border border-white/20 bg-transparent text-base font-normal text-white/90 transition hover:border-white/40 hover:bg-white/[0.07] hover:text-white active:scale-[0.98]"
                  href="/signup"
                >
                  Get started
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
    </div>
  );
}
