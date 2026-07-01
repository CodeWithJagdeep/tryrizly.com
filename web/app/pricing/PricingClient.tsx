'use client';

import { useState, Fragment } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { Reveal } from '../components/Reveal';
import { Faq } from '../components/sections/Faq';
import { FinalCta } from '../components/sections/FinalCta';

type Plan = {
  id: string;
  name: string;
  monthlyPrice: string;
  annualPrice: string;
  monthlyCadence: string;
  annualCadence: string;
  description: string;
  users: string;
  features: string[];
  highlighted?: boolean;
};

const plans: Plan[] = [
  {
    id: 'trial',
    name: 'Trial',
    monthlyPrice: '$0',
    annualPrice: '$0',
    monthlyCadence: '14 days',
    annualCadence: '14 days',
    description: "Experience Rizly's full capabilities risk-free.",
    users: '1 user',
    features: ['All Pro features included', 'Full integrations access', 'Email & calendar automation', 'Priority support'],
  },
  {
    id: 'professional',
    name: 'Professional',
    monthlyPrice: '$59',
    annualPrice: '$47',
    monthlyCadence: '/month',
    annualCadence: '/month',
    description: 'For individuals managing complex workflows.',
    users: '1 user',
    features: ['Email triage & drafting', 'Calendar synchronization', 'Cross-channel memory', 'Telegram integration'],
  },
  {
    id: 'business',
    name: 'Business',
    monthlyPrice: '$119',
    annualPrice: '$95',
    monthlyCadence: '/month',
    annualCadence: '/month',
    description: 'For power users and small teams.',
    users: 'Up to 3 users',
    features: ['Priority execution queues', 'Advanced automation', 'Business integrations', 'Email support 24/7'],
    highlighted: true,
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    monthlyPrice: 'Custom',
    annualPrice: 'Custom',
    monthlyCadence: 'Contact us',
    annualCadence: 'Contact us',
    description: 'Custom solutions for large organizations.',
    users: 'Unlimited users',
    features: ['Dedicated account team', 'Custom integrations', '99.9% SLA guarantee', 'Advanced compliance'],
  },
];

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
    categoryName: 'Core Capabilities',
    rows: [
      {
        label: 'Email Management',
        description: 'Intelligent inbox triage with automatic draft generation.',
        values: ['Full', 'Full', 'Full', 'Full'],
      },
      {
        label: 'Calendar Intelligence',
        description: 'Meeting sync, preparation packets, and scheduling.',
        values: ['Full', 'Full', 'Full', 'Full'],
      },
      {
        label: 'Contextual Memory',
        description: 'Cross-channel context and entity relationship mapping.',
        values: ['Limited', 'Full', 'Full', 'Full'],
      },
      {
        label: 'Priority Processing',
        description: 'Expedited task execution with optimized queues.',
        values: ['—', '—', 'Yes', 'Yes'],
      },
      {
        label: 'Decision Tracking',
        description: 'Automated tracking of agreements and commitments.',
        values: ['—', '—', 'Yes', 'Yes'],
      },
    ],
  },
  {
    categoryName: 'Integrations',
    rows: [
      {
        label: 'Standard Connectors',
        description: 'Gmail, Calendar, Telegram, and messaging platforms.',
        values: ['Yes', 'Yes', 'Yes', 'Yes'],
      },
      {
        label: 'Business Systems',
        description: 'Stripe, Razorpay, PostgreSQL, and enterprise tools.',
        values: ['—', '—', 'Yes', 'Yes'],
      },
      {
        label: 'Custom Integrations',
        description: 'Connect proprietary systems and internal databases.',
        values: ['—', '—', '—', 'Yes'],
      },
    ],
  },
  {
    categoryName: 'Support & Reliability',
    rows: [
      {
        label: 'Support Channel',
        description: 'Access level for setup and troubleshooting.',
        values: ['Email', 'Email (24h)', 'Email (24h)', 'Dedicated Team'],
      },
      {
        label: 'Uptime Guarantee',
        description: 'Service level agreement and cost protection.',
        values: ['99%', '99%', '99.5%', '99.9%'],
      },
      {
        label: 'API Rate Limits',
        description: 'Monthly execution quota and concurrent operations.',
        values: ['Limited', 'Standard', 'High', 'Custom'],
      },
    ],
  },
];

function CheckIcon() {
  return (
    <svg className='h-5 w-5 text-[#FE7F2D]' fill='currentColor' viewBox='0 0 20 20'>
      <path
        fillRule='evenodd'
        d='M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z'
        clipRule='evenodd'
      />
    </svg>
  );
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
} as const;

const cardVariants = {
  hidden: { opacity: 0, y: 30 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: 'spring',
      stiffness: 90,
      damping: 15,
    },
  },
} as const;

export function PricingClient() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  return (
    <div className='flex flex-1 flex-col relative bg-white overflow-hidden'>
      {/* Header Section */}
      <section className='pt-24 pb-16 md:pt-32 md:pb-24 relative'>
        <div className='mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8'>
          <Reveal>
            <div className='inline-block mb-6'>
              <span className='inline-flex items-center px-4 py-1.5 rounded-full text-sm font-semibold bg-[#EAECF0] text-[#233D4D]'>
                Flexible Plans for Every Business
              </span>
            </div>
            <h1 className='text-5xl md:text-6xl font-bold text-[#000000] tracking-tight mb-6'>
              Simple, Transparent Pricing
            </h1>
            <p className='text-xl text-[#233D4D] max-w-2xl mx-auto leading-relaxed mb-8'>
              Start with a 14-day free trial. No credit card required. Scale as you grow.
            </p>
          </Reveal>

          {/* Billing Toggle */}
          <Reveal delay={0.1}>
            <div className='flex justify-center items-center gap-8 mt-12'>
              <span className={`text-sm font-semibold transition-colors ${!isAnnual ? 'text-[#000000]' : 'text-[#666666]'}`}>
                Monthly
              </span>

              <button
                onClick={() => setIsAnnual(!isAnnual)}
                className='relative flex items-center h-8 w-16 rounded-full bg-[#233D4D] transition-all hover:opacity-90'
              >
                <motion.div
                  className='h-7 w-7 rounded-full bg-[#FE7F2D] absolute'
                  layout
                  transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                  style={{ left: isAnnual ? 'calc(100% - 28px)' : '2px' }}
                />
              </button>

              <div className='flex items-center gap-2'>
                <span className={`text-sm font-semibold transition-colors ${isAnnual ? 'text-[#000000]' : 'text-[#666666]'}`}>
                  Annually
                </span>
                {isAnnual && (
                  <span className='inline-flex items-center px-2 py-1 rounded-full text-xs font-bold bg-[#FE7F2D] text-white'>
                    Save 20%
                  </span>
                )}
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className='pb-24 relative px-4 sm:px-6 lg:px-8'>
        <div className='max-w-7xl mx-auto'>
          <motion.div
            variants={containerVariants}
            initial='hidden'
            whileInView='show'
            viewport={{ once: true, amount: 0.2 }}
            className='grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6'
          >
            {plans.map((plan) => {
              const isPopular = plan.highlighted;
              return (
                <motion.div key={plan.id} variants={cardVariants}>
                  <div
                    className={`relative flex flex-col h-full rounded-2xl border-2 p-8 transition-all duration-300 ${
                      isPopular
                        ? 'border-[#FE7F2D] bg-[#FFF9F5] shadow-lg shadow-[#FE7F2D]/10'
                        : 'border-[#EAECF0] bg-white hover:border-[#233D4D]'
                    }`}
                  >
                    {/* Popular Badge */}
                    {isPopular && (
                      <div className='absolute -top-4 left-8'>
                        <span className='inline-flex items-center px-4 py-1 rounded-full text-xs font-bold bg-[#FE7F2D] text-white uppercase tracking-wider'>
                          Most Popular
                        </span>
                      </div>
                    )}

                    {/* Plan Name & Description */}
                    <div className='mb-6'>
                      <h3 className='text-2xl font-bold text-[#000000] mb-2'>{plan.name}</h3>
                      <p className='text-sm text-[#666666]'>{plan.description}</p>
                    </div>

                    {/* Pricing */}
                    <div className='mb-6'>
                      <div className='flex items-baseline gap-1.5 h-16'>
                        <AnimatePresence mode='wait'>
                          <motion.span
                            key={isAnnual ? 'annual' : 'monthly'}
                            initial={{ y: 24, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            exit={{ y: -24, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className='text-5xl font-bold text-[#000000]'
                          >
                            {isAnnual ? plan.annualPrice : plan.monthlyPrice}
                          </motion.span>
                        </AnimatePresence>
                        {plan.id !== 'enterprise' && (
                          <span className='text-sm font-medium text-[#666666]'>{isAnnual ? plan.annualCadence : plan.monthlyCadence}</span>
                        )}
                      </div>
                      <p className='text-xs text-[#999999] font-medium uppercase tracking-wide mt-2'>{plan.users}</p>
                    </div>

                    {/* CTA Button */}
                    <button
                      className={`w-full py-3 px-4 rounded-lg font-semibold transition-all mb-8 ${
                        isPopular
                          ? 'bg-[#FE7F2D] text-white hover:bg-[#E56F1F] shadow-lg shadow-[#FE7F2D]/20'
                          : 'bg-[#EAECF0] text-[#000000] hover:bg-[#D0D4DB] border-2 border-[#EAECF0]'
                      }`}
                    >
                      {plan.id === 'enterprise' ? 'Contact Sales' : 'Start Free Trial'}
                    </button>

                    {/* Features */}
                    <div className='border-t border-[#EAECF0] pt-8'>
                      <ul className='space-y-4'>
                        {plan.features.map((feature) => (
                          <li key={feature} className='flex items-start gap-3'>
                            <CheckIcon />
                            <span className='text-sm text-[#233D4D] font-medium'>{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Comparison Table */}
      <section className='bg-[#EAECF0] py-24 relative'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <Reveal>
            <div className='mb-16 text-center'>
              <h2 className='text-4xl font-bold text-[#000000] mb-4'>Detailed Feature Comparison</h2>
              <p className='text-[#666666] text-lg'>Compare capabilities across all plans</p>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className='overflow-x-auto rounded-xl border-2 border-white bg-white'>
              <table className='w-full'>
                <thead>
                  <tr className='border-b-2 border-[#EAECF0]'>
                    <th className='px-6 py-6 text-left font-bold text-[#000000] bg-[#EAECF0]'>Features</th>
                    {plans.map((plan) => (
                      <th
                        key={plan.id}
                        className={`px-6 py-6 text-left font-bold text-center ${
                          plan.highlighted ? 'bg-[#FFF9F5] border-x-2 border-[#FE7F2D]' : 'bg-white'
                        }`}
                      >
                        <div className='text-[#000000] text-sm font-bold'>{plan.name}</div>
                        <div className='text-xs text-[#666666] mt-1'>
                          {plan.monthlyPrice === 'Custom' ? 'Custom' : `${isAnnual ? plan.annualPrice : plan.monthlyPrice}`}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonCategories.map((category) => (
                    <Fragment key={category.categoryName}>
                      <tr className='bg-[#EAECF0] border-b-2 border-[#EAECF0]'>
                        <td colSpan={5} className='px-6 py-4'>
                          <h4 className='font-bold text-[#233D4D] text-sm uppercase tracking-wider'>{category.categoryName}</h4>
                        </td>
                      </tr>
                      {category.rows.map((row) => (
                        <motion.tr
                          key={row.label}
                          onHoverStart={() => setHoveredRow(row.label)}
                          onHoverEnd={() => setHoveredRow(null)}
                          className='border-b border-[#EAECF0]'
                          animate={{
                            backgroundColor: hoveredRow === row.label ? '#FFF9F5' : 'transparent',
                          }}
                        >
                          <td className='px-6 py-5'>
                            <div className='font-semibold text-[#000000] text-sm'>{row.label}</div>
                            <div className='text-xs text-[#666666] mt-1.5'>{row.description}</div>
                          </td>
                          {row.values.map((value, i) => (
                            <td
                              key={i}
                              className={`px-6 py-5 text-center text-sm font-medium ${
                                plans[i].highlighted ? 'bg-[#FFF9F5]' : ''
                              }`}
                            >
                              {value === 'Yes' ? (
                                <span className='inline-flex items-center justify-center h-6 w-6 rounded-full bg-[#EAECF0]'>
                                  <CheckIcon />
                                </span>
                              ) : value === '—' ? (
                                <span className='text-[#CCCCCC]'>—</span>
                              ) : (
                                <span className='text-[#233D4D]'>{value}</span>
                              )}
                            </td>
                          ))}
                        </motion.tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </Reveal>
        </div>
      </section>

      {/* FAQ and CTA */}
      <Faq />
      <FinalCta />
    </div>
  );
}
