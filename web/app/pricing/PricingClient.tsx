'use client';

import Link from 'next/link';
import { Fragment } from 'react';
import { Reveal } from '../components/Reveal';
import { Faq } from '../components/sections/Faq';
import { PricingCards, plans } from '../components/PricingCards';

type FeatureRow = {
  label: string;
  description: string;
  values: [string, string, string, string];
};

type FeatureCategory = {
  categoryName: string;
  rows: FeatureRow[];
};

const comparisonCategories: FeatureCategory[] = [
  {
    categoryName: 'Core capabilities',
    rows: [
      {
        label: 'Chat with Riz',
        description: 'Ask, delegate, and approve from Telegram or the dashboard.',
        values: ['Limited', 'Full', 'Full', 'Full'],
      },
      {
        label: 'Email triage & drafting',
        description: 'Inbox analysis, summaries, and reply drafts awaiting your approval.',
        values: ['—', 'Yes', 'Yes', 'Yes'],
      },
      {
        label: 'Morning brief & reminders',
        description: 'A daily brief in your timezone, plus follow-ups that chase themselves.',
        values: ['—', 'Yes', 'Yes', 'Yes'],
      },
      {
        label: 'Contextual memory',
        description: 'People, companies, and decisions remembered across channels.',
        values: ['Basic', 'Full', 'Full', 'Full'],
      },
      {
        label: 'Priority agent runs',
        description: 'Your requests jump the queue with stronger models.',
        values: ['—', '—', 'Yes', 'Yes'],
      },
      {
        label: 'Weekly digest automation',
        description: 'A business digest composed and delivered every week.',
        values: ['—', '—', 'Yes', 'Yes'],
      },
    ],
  },
  {
    categoryName: 'Integrations',
    rows: [
      {
        label: 'Standard connectors',
        description: 'Gmail, Google Calendar, and Telegram.',
        values: ['Yes', 'Yes', 'Yes', 'Yes'],
      },
      {
        label: 'Business systems',
        description: 'Stripe, Razorpay, PostgreSQL, and MongoDB.',
        values: ['—', '—', 'Yes', 'Yes'],
      },
    ],
  },
  {
    categoryName: 'Usage & support',
    rows: [
      {
        label: 'Monthly AI allowance',
        description: 'How much background AI work your plan covers each month.',
        values: ['Minimal', 'Standard', 'High', 'Highest'],
      },
      {
        label: 'Support',
        description: 'How to reach us when something needs a human.',
        values: ['Email', 'Email', 'Priority email', 'Priority email'],
      },
    ],
  },
];

function CheckIcon({ className = 'text-[#FE7F2D]' }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 shrink-0 ${className}`} fill='none' viewBox='0 0 20 20' stroke='currentColor' strokeWidth='2.5' aria-hidden='true'>
      <path strokeLinecap='round' strokeLinejoin='round' d='M16 6 8.5 13.5 4 9' />
    </svg>
  );
}

export function PricingClient() {
  return (
    <div className='flex flex-1 flex-col bg-white text-slate-900'>
      {/* Header */}
      <section className='border-b-2 border-black pt-24 pb-16 md:pt-32 md:pb-20'>
        <div className='mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8'>
          <Reveal>
            <span className='inline-block border-2 border-[#FE7F2D] px-3 py-1 text-[12px] font-black uppercase tracking-[0.2em] text-[#FE7F2D]'>
              Pricing
            </span>
            <h1 className='mt-8 font-neue-haas text-5xl font-medium tracking-tight text-black md:text-6xl'>
              Simple, honest pricing
            </h1>
            <p className='mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-slate-500 md:text-xl'>
              Every paid plan starts with a 10-day free trial of the full product — no credit card
              required. If you don&apos;t convert, you land on Free, not on a lock-out.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Pricing cards */}
      <section className='px-4 py-16 sm:px-6 md:py-24 lg:px-8'>
        <div className='mx-auto max-w-7xl'>
          <Reveal>
            <PricingCards />
          </Reveal>

          <Reveal delay={0.1}>
            <p className='mt-6 text-center text-sm text-slate-400'>
              Prices in USD, billed monthly through Razorpay. Cancel anytime — you keep access until
              the end of the period.
            </p>
          </Reveal>
        </div>
      </section>

      {/* Comparison table */}
      <section className='border-t-2 border-black bg-slate-50 py-16 md:py-24'>
        <div className='mx-auto max-w-7xl px-4 sm:px-6 lg:px-8'>
          <Reveal>
            <div className='mb-12 text-center md:mb-16'>
              <h2 className='font-neue-haas text-3xl font-medium tracking-tight text-black md:text-4xl'>
                Compare plans in detail
              </h2>
              <p className='mt-3 text-lg text-slate-500'>What each tier actually includes.</p>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className='overflow-x-auto border-2 border-black bg-white'>
              <table className='w-full min-w-[760px] border-collapse'>
                <thead>
                  <tr className='border-b-2 border-black'>
                    <th className='px-6 py-5 text-left text-[13px] font-black uppercase tracking-[0.16em] text-slate-400'>
                      Features
                    </th>
                    {plans.map((plan) => (
                      <th
                        key={plan.id}
                        className={`px-4 py-5 text-center ${plan.highlighted ? 'bg-black text-white' : ''}`}
                      >
                        <div className={`text-sm font-black uppercase tracking-[0.12em] ${plan.highlighted ? 'text-[#FE7F2D]' : 'text-black'}`}>
                          {plan.name}
                        </div>
                        <div className={`mt-1 text-xs font-medium ${plan.highlighted ? 'text-white/50' : 'text-slate-400'}`}>
                          {plan.price}
                          {plan.cadence === '/month' ? '/mo' : ''}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonCategories.map((category) => (
                    <Fragment key={category.categoryName}>
                      <tr className='border-b border-black/10 bg-slate-50'>
                        <td colSpan={5} className='px-6 py-3'>
                          <h4 className='text-[12px] font-black uppercase tracking-[0.18em] text-slate-500'>
                            {category.categoryName}
                          </h4>
                        </td>
                      </tr>
                      {category.rows.map((row) => (
                        <tr key={row.label} className='border-b border-black/10 transition-colors last:border-b-0 hover:bg-[#FE7F2D]/[0.04]'>
                          <td className='px-6 py-4'>
                            <div className='text-sm font-semibold text-black'>{row.label}</div>
                            <div className='mt-1 text-xs leading-5 text-slate-500'>{row.description}</div>
                          </td>
                          {row.values.map((value, i) => (
                            <td
                              key={i}
                              className={`px-4 py-4 text-center text-sm font-medium ${
                                plans[i].highlighted ? 'bg-black/[0.03]' : ''
                              }`}
                            >
                              {value === 'Yes' ? (
                                <span className='inline-flex'>
                                  <CheckIcon />
                                </span>
                              ) : value === '—' ? (
                                <span className='text-slate-300'>—</span>
                              ) : (
                                <span className='text-slate-700'>{value}</span>
                              )}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Custom needs strip */}
      <section className='border-t-2 border-black'>
        <div className='mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-4 py-12 sm:px-6 md:flex-row md:items-center lg:px-8'>
          <div>
            <h2 className='font-neue-haas text-2xl font-medium tracking-tight text-black'>
              Need more seats, custom integrations, or an SLA?
            </h2>
            <p className='mt-2 text-slate-500'>
              We work with teams on custom setups. Tell us what you need.
            </p>
          </div>
          <Link
            href='/contact'
            className='inline-flex h-12 shrink-0 items-center justify-center border-2 border-black bg-white px-8 text-sm font-semibold text-black transition-colors hover:bg-black hover:text-white'
          >
            Talk to us
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <Faq />
    </div>
  );
}
