'use client';

import Link from 'next/link';
import { Fragment } from 'react';
import { Eyebrow } from '../components/product/Eyebrow';
import { HeroGlow } from '../components/product/HeroGlow';
import { FaqSection } from '../components/home/FaqSection';
import { PricingCards, plans } from '../components/PricingCards';

type FeatureRow = {
  label: string;
  description: string;
  values: [string, string, string];
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
        values: ['Full', 'Full', 'Full'],
      },
      {
        label: 'Email triage & drafting',
        description: 'Inbox analysis, summaries, and reply drafts awaiting your approval.',
        values: ['Yes', 'Yes', 'Yes'],
      },
      {
        label: 'Morning brief & reminders',
        description: 'A daily brief in your timezone, plus follow-ups that chase themselves.',
        values: ['Yes', 'Yes', 'Yes'],
      },
      {
        label: 'Contextual memory',
        description: 'People, companies, and decisions remembered across channels.',
        values: ['Full', 'Full', 'Full'],
      },
      {
        label: 'Priority agent runs',
        description: 'Your requests jump the queue with stronger models.',
        values: ['—', 'Yes', 'Yes'],
      },
      {
        label: 'Weekly digest automation',
        description: 'A business digest composed and delivered every week.',
        values: ['—', 'Yes', 'Yes'],
      },
    ],
  },
  {
    categoryName: 'Integrations',
    rows: [
      {
        label: 'Standard connectors',
        description: 'Gmail, Google Calendar, and Telegram.',
        values: ['Yes', 'Yes', 'Yes'],
      },
      {
        label: 'Business systems',
        description: 'Stripe, Razorpay, PostgreSQL, and MongoDB.',
        values: ['—', 'Yes', 'Yes'],
      },
    ],
  },
  {
    categoryName: 'Usage & support',
    rows: [
      {
        label: 'Monthly AI credits',
        description: 'How much background AI work your plan covers each month.',
        values: ['1,200', '3,400', '8,000'],
      },
      {
        label: 'Support',
        description: 'How to reach us when something needs a human.',
        values: ['Email', 'Priority email', 'Priority email'],
      },
    ],
  },
];

function CheckIcon({ className = 'text-[#ff4f00]' }: { className?: string }) {
  return (
    <svg className={`h-4 w-4 shrink-0 ${className}`} fill='none' viewBox='0 0 20 20' stroke='currentColor' strokeWidth='2.5' aria-hidden='true'>
      <path strokeLinecap='round' strokeLinejoin='round' d='M16 6 8.5 13.5 4 9' />
    </svg>
  );
}

export function PricingClient() {
  return (
    <div className='flex flex-1 flex-col bg-white text-black'>
      {/* Header */}
      <section className='relative overflow-hidden border-b border-black/10 bg-white'>
        <HeroGlow />
        <div className='relative mx-auto flex max-w-4xl flex-col items-center px-6 pb-16 pt-28 text-center md:px-10'>
          <Eyebrow>Pricing</Eyebrow>
          <h1 className='max-w-2xl text-4xl font-normal leading-[1.08] tracking-tight text-[#20151c] [text-wrap:balance] md:text-5xl'>
            Simple, honest pricing
          </h1>
          <p className='mt-6 max-w-xl text-sm leading-6 text-gray-600 md:text-base'>
            Every paid plan starts with a 10-day free trial of the full product, no credit card required. If you
            don&apos;t convert, you land on Free, not on a lock-out.
          </p>
        </div>
      </section>

      {/* Pricing cards */}
      <section className='border-t border-black/10 bg-[#fcfcfc] px-6 py-20 md:px-10 lg:px-14'>
        <div className='mx-auto max-w-[88rem]'>
          <PricingCards />
          <p className='mt-8 text-center text-sm text-gray-500'>
            Prices in USD, billed monthly through Razorpay. Cancel anytime, you keep access until the end of the
            period.
          </p>
        </div>
      </section>

      {/* Comparison table */}
      <section className='border-t border-black/10 bg-white px-6 py-20 md:px-10 lg:px-14'>
        <div className='mx-auto max-w-[88rem]'>
          <div className='mb-14 text-center'>
            <h2 className='text-3xl font-normal leading-tight tracking-tight text-[#20151c] md:text-4xl'>
              Compare plans in detail
            </h2>
            <p className='mt-3 text-sm text-gray-600 md:text-base'>What each tier actually includes.</p>
          </div>

          <div className='overflow-hidden overflow-x-auto rounded-2xl bg-[#fcfcfc] shadow-[0_30px_80px_-60px_rgba(32,21,28,0.4)]'>
            <table className='w-full min-w-[760px] border-collapse'>
              <thead>
                <tr>
                  <th className='px-6 py-5 text-left text-xs font-normal uppercase tracking-[0.16em] text-gray-400'>
                    Features
                  </th>
                  {plans.map((plan) => (
                    <th key={plan.id} className={`px-4 py-5 text-center ${plan.highlighted ? 'bg-[#20151c] text-white' : ''}`}>
                      <div className={`text-sm font-normal uppercase tracking-[0.12em] ${plan.highlighted ? 'text-[#ff4f00]' : 'text-[#20151c]'}`}>
                        {plan.name}
                      </div>
                      <div className={`mt-1 text-xs ${plan.highlighted ? 'text-white/50' : 'text-gray-500'}`}>
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
                    <tr className='bg-white'>
                      <td colSpan={4} className='px-6 py-3'>
                        <h4 className='text-xs font-normal uppercase tracking-[0.16em] text-gray-500'>
                          {category.categoryName}
                        </h4>
                      </td>
                    </tr>
                    {category.rows.map((row) => (
                      <tr key={row.label} className='border-t border-black/[0.06]'>
                        <td className='px-6 py-4'>
                          <div className='text-sm font-normal text-[#20151c]'>{row.label}</div>
                          <div className='mt-1 text-xs leading-5 text-gray-500'>{row.description}</div>
                        </td>
                        {row.values.map((value, i) => (
                          <td
                            key={i}
                            className={`px-4 py-4 text-center text-sm ${plans[i].highlighted ? 'bg-[#20151c]/[0.03]' : ''}`}
                          >
                            {value === 'Yes' ? (
                              <span className='inline-flex'>
                                <CheckIcon />
                              </span>
                            ) : value === '—' ? (
                              <span className='text-gray-300'>—</span>
                            ) : (
                              <span className='text-gray-700'>{value}</span>
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
        </div>
      </section>

      {/* Custom needs strip */}
      <section className='border-t border-black/10 bg-[#fcfcfc] px-6 py-14 md:px-10 lg:px-14'>
        <div className='mx-auto flex max-w-[88rem] flex-col items-start justify-between gap-6 md:flex-row md:items-center'>
          <div>
            <h2 className='text-2xl font-normal tracking-tight text-[#20151c]'>
              Need more seats, custom integrations, or an SLA?
            </h2>
            <p className='mt-2 text-sm text-gray-600'>We work with teams on custom setups. Tell us what you need.</p>
          </div>
          <Link
            href='/contact'
            className='inline-flex h-12 shrink-0 items-center justify-center rounded-full bg-[#20151c] px-8 text-sm font-normal text-white transition hover:bg-black'
          >
            Talk to us
          </Link>
        </div>
      </section>

      {/* FAQ */}
      <FaqSection />
    </div>
  );
}
