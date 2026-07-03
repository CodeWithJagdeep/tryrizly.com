'use client';

import { useState, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Reveal } from '../components/Reveal';
import { Faq } from '../components/sections/Faq';

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
    monthlyCadence: '15 days',
    annualCadence: '15 days',
    description: "Experience Rizly's full capabilities risk-free.",
    users: '1 user',
    features: ['All Pro features included', 'Full integrations access', 'Email & calendar automation', 'Priority support'],
  },
  {
    id: 'professional',
    name: 'Professional',
    monthlyPrice: '$49',
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
    monthlyPrice: '$99',
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
        values: ['-', '-', 'Yes', 'Yes'],
      },
      {
        label: 'Decision Tracking',
        description: 'Automated tracking of agreements and commitments.',
        values: ['-', '-', 'Yes', 'Yes'],
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
        values: ['-', '-', 'Yes', 'Yes'],
      },
      {
        label: 'Custom Integrations',
        description: 'Connect proprietary systems and internal databases.',
        values: ['-', '-', '-', 'Yes'],
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
    <div className='flex flex-1 flex-col relative bg-[#0a0a0f] overflow-hidden'>
      {/* Header Section */}
      <section className='pt-24 pb-16 md:pt-32 md:pb-24 relative'>
        <div className='mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8'>
          <Reveal>
            <h1 className='text-5xl md:text-6xl font-bold text-white tracking-tight mb-6'>
              Simple, transparent pricing
            </h1>
            <p className='text-xl text-white/50 max-w-2xl mx-auto leading-relaxed mb-8'>
              Start with a 15-day free trial. No credit card required. Scale as you grow.
            </p>
          </Reveal>

          {/* Billing Toggle */}
          <Reveal delay={0.1}>
            <div className='flex justify-center items-center gap-4 mt-12'>
              <button
                onClick={() => setIsAnnual(false)}
                className={`px-6 py-3 rounded-full text-base font-bold transition-colors ${
                  !isAnnual ? 'bg-white text-[#0a0a0f]' : 'text-white/40 hover:text-white/70'
                }`}
              >
                Monthly
              </button>

              <button
                onClick={() => setIsAnnual(true)}
                className={`flex items-center gap-2.5 px-6 py-3 rounded-full text-base font-bold transition-colors ${
                  isAnnual ? 'bg-white text-[#0a0a0f]' : 'text-white/40 hover:text-white/70'
                }`}
              >
                Annually
                <span className='inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-[#FE7F2D] text-white'>
                  Save 20%
                </span>
              </button>
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
                    className={`relative flex flex-col h-full rounded-2xl border p-8 transition-all duration-300 ${
                      isPopular
                        ? 'border-[#FE7F2D]/40 bg-[#FE7F2D]/[0.06] shadow-[0_18px_40px_-24px_rgba(254,127,45,0.45)]'
                        : 'border-white/10 bg-white/[0.03] hover:border-white/20'
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
                      <h3 className='text-2xl font-bold text-white mb-2'>{plan.name}</h3>
                      <p className='text-sm text-white/50'>{plan.description}</p>
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
                            className='text-5xl font-bold text-white'
                          >
                            {isAnnual ? plan.annualPrice : plan.monthlyPrice}
                          </motion.span>
                        </AnimatePresence>
                        {plan.id !== 'enterprise' && (
                          <span className='text-sm font-medium text-white/40'>{isAnnual ? plan.annualCadence : plan.monthlyCadence}</span>
                        )}
                      </div>
                      <p className='text-xs text-white/30 font-medium uppercase tracking-wide mt-2'>{plan.users}</p>
                    </div>

                    {/* CTA Button */}
                    <button
                      className={`w-full py-3 px-4 rounded-full font-semibold transition-all mb-8 ${
                        isPopular
                          ? 'bg-[#FE7F2D] text-white hover:bg-[#E56F1F] shadow-lg shadow-[#FE7F2D]/20'
                          : 'border border-white/15 text-white hover:bg-white/5'
                      }`}
                    >
                      {plan.id === 'enterprise' ? 'Contact sales' : 'Start free trial'}
                    </button>

                    {/* Features */}
                    <div className='border-t border-white/10 pt-8'>
                      <ul className='space-y-4'>
                        {plan.features.map((feature) => (
                          <li key={feature} className='flex items-start gap-3'>
                            <CheckIcon />
                            <span className='text-sm text-white/70 font-medium'>{feature}</span>
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
      <section className='py-24 relative'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
          <Reveal>
            <div className='mb-16 text-center'>
              <h2 className='text-4xl font-bold text-white mb-4'>Detailed feature comparison</h2>
              <p className='text-white/50 text-lg'>Compare capabilities across all plans</p>
            </div>
          </Reveal>

          <Reveal delay={0.1}>
            <div className='overflow-x-auto rounded-2xl border border-white/10 bg-white/[0.03]'>
              <table className='w-full'>
                <thead>
                  <tr className='border-b border-white/10'>
                    <th className='px-6 py-6 text-left font-bold text-white bg-white/[0.02]'>Features</th>
                    {plans.map((plan) => (
                      <th
                        key={plan.id}
                        className={`px-6 py-6 text-left font-bold text-center ${
                          plan.highlighted ? 'bg-[#FE7F2D]/[0.06] border-x border-[#FE7F2D]/30' : ''
                        }`}
                      >
                        <div className='text-white text-sm font-bold'>{plan.name}</div>
                        <div className='text-xs text-white/40 mt-1'>
                          {plan.monthlyPrice === 'Custom' ? 'Custom' : `${isAnnual ? plan.annualPrice : plan.monthlyPrice}`}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {comparisonCategories.map((category) => (
                    <Fragment key={category.categoryName}>
                      <tr className='bg-white/[0.02] border-b border-white/10'>
                        <td colSpan={5} className='px-6 py-4'>
                          <h4 className='font-bold text-white/70 text-sm uppercase tracking-wider'>{category.categoryName}</h4>
                        </td>
                      </tr>
                      {category.rows.map((row) => (
                        <motion.tr
                          key={row.label}
                          onHoverStart={() => setHoveredRow(row.label)}
                          onHoverEnd={() => setHoveredRow(null)}
                          className='border-b border-white/5'
                          animate={{
                            backgroundColor: hoveredRow === row.label ? 'rgba(254,127,45,0.05)' : 'rgba(0,0,0,0)',
                          }}
                        >
                          <td className='px-6 py-5'>
                            <div className='font-semibold text-white text-sm'>{row.label}</div>
                            <div className='text-xs text-white/40 mt-1.5'>{row.description}</div>
                          </td>
                          {row.values.map((value, i) => (
                            <td
                              key={i}
                              className={`px-6 py-5 text-center text-sm font-medium ${
                                plans[i].highlighted ? 'bg-[#FE7F2D]/[0.04]' : ''
                              }`}
                            >
                              {value === 'Yes' ? (
                                <span className='inline-flex items-center justify-center h-6 w-6 rounded-full bg-white/10'>
                                  <CheckIcon />
                                </span>
                              ) : value === '-' ? (
                                <span className='text-white/20'>-</span>
                              ) : (
                                <span className='text-white/70'>{value}</span>
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

      {/* FAQ */}
      <Faq />
    </div>
  );
}
