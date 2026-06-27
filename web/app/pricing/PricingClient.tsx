"use client";

import { useState, Fragment } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { Reveal } from "../components/Reveal";
import { Faq } from "../components/sections/Faq";
import { FinalCta } from "../components/sections/FinalCta";

type Plan = {
  id: string;
  name: string;
  monthlyPrice: string;
  annualPrice: string;
  monthlyCadence: string;
  annualCadence: string;
  description: string;
  seats: string;
  features: string[];
  highlighted?: boolean;
};

const plans: Plan[] = [
  {
    id: "free",
    name: "Free",
    monthlyPrice: "$0",
    annualPrice: "$0",
    monthlyCadence: "7-day trial",
    annualCadence: "7-day trial",
    description: "Full features for a week, then choose a plan.",
    seats: "1 seat",
    features: ["Limited chat", "Basic memory", "Manual connector setup"],
  },
  {
    id: "starter",
    name: "Starter",
    monthlyPrice: "$49",
    annualPrice: "$39",
    monthlyCadence: "/ month",
    annualCadence: "/ month",
    description: "A founder-grade daily assistant with controlled background AI.",
    seats: "1 seat",
    features: ["Recurring subscription", "7-day trial", "Email triage", "Connector memory"],
  },
  {
    id: "pro",
    name: "Pro",
    monthlyPrice: "$99",
    annualPrice: "$79",
    monthlyCadence: "/ month",
    annualCadence: "/ month",
    description: "For a heavier inbox, more meetings, and proactive workflows.",
    seats: "1 seat",
    features: ["Recurring subscription", "7-day trial", "Priority agent runs", "Digest automation"],
    highlighted: true,
  },
  {
    id: "business",
    name: "Business",
    monthlyPrice: "$199",
    annualPrice: "$159",
    monthlyCadence: "/ month",
    annualCadence: "/ month",
    description: "Deeper support for background work.",
    seats: "1 seat",
    features: ["Recurring subscription", "7-day trial", "Priority support", "Higher usage limits"],
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
    categoryName: "Core Capabilities",
    rows: [
      {
        label: "AI agent seats",
        description: "Active slots for operators running inside your workspace.",
        values: ["1 seat", "1 seat", "1 seat", "1 seat"],
      },
      {
        label: "Email triage & drafts",
        description: "Reads incoming mail and prepares suggested drafts automatically.",
        values: ["Limited", "Full", "Full", "Full"],
      },
      {
        label: "Connector memory",
        description: "Retains context across channels, matching contacts to signals.",
        values: ["—", "Yes", "Yes", "Yes"],
      },
      {
        label: "Priority agent runs",
        description: "High-frequency task execution with fast agent processing queues.",
        values: ["—", "—", "Yes", "Yes"],
      },
      {
        label: "Digest automation",
        description: "Scheduled custom brief containing high-priority insights.",
        values: ["—", "—", "Yes", "Yes"],
      },
    ],
  },
  {
    categoryName: "Integrations & Connectors",
    rows: [
      {
        label: "Standard connectors",
        description: "Seamless connection to Gmail, Google Calendar, and Telegram.",
        values: ["Yes", "Yes", "Yes", "Yes"],
      },
      {
        label: "Business connectors",
        description: "Integration with Stripe, Razorpay, PostgreSQL, and MongoDB channels.",
        values: ["—", "—", "Yes", "Yes"],
      },
    ],
  },
  {
    categoryName: "Support & SLA",
    rows: [
      {
        label: "Support channel",
        description: "Access level to support agents for setup and troubleshooting.",
        values: ["Community", "Email (24h)", "Priority email", "Dedicated Slack"],
      },
      {
        label: "Budget overage protection",
        description: "Background activities pause at 100% usage to guarantee no extra fees.",
        values: ["Yes", "Yes", "Yes", "Yes"],
      },
    ],
  },
];

function AnimatedCheck({ delay }: { delay: number }) {
  return (
    <svg
      className="mt-0.5 h-4 w-4 shrink-0 text-blue-500"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={3}
    >
      <motion.path
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{
          duration: 0.4,
          delay: delay,
          ease: "easeInOut",
        }}
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M5 13l4 4L19 7"
      />
    </svg>
  );
}

// Parent animation settings for staggered fade-in of cards
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.08,
    },
  },
} as const;

const cardVariants = {
  hidden: { opacity: 0, y: 35 },
  show: {
    opacity: 1,
    y: 0,
    transition: {
      type: "spring",
      stiffness: 90,
      damping: 14,
    },
  },
} as const;

export function PricingClient() {
  const [isAnnual, setIsAnnual] = useState(false);
  const [hoveredRow, setHoveredRow] = useState<string | null>(null);

  return (
    <div className="flex flex-1 flex-col relative overflow-hidden bg-slate-50/20">
      {/* Visual Accents - Dot Matrix and Glow Blobs */}
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_40%,#000_60%,transparent_100%)] opacity-70" />
      
      <div className="absolute top-[-10%] left-[10%] -z-10 h-[500px] w-[500px] rounded-full bg-blue-400/5 blur-[120px] pointer-events-none" />
      <div className="absolute top-[20%] right-[5%] -z-10 h-[600px] w-[600px] rounded-full bg-teal-300/5 blur-[130px] pointer-events-none" />

      {/* Header Section */}
      <section className="pt-24 pb-12 md:pt-32 md:pb-16 relative">
        <div className="mx-auto max-w-7xl px-4 text-center sm:px-6 lg:px-8">
          <Reveal>
            <h1 className="font-neue-haas mx-auto max-w-2xl text-4xl font-normal tracking-tight text-[#0f172a] sm:text-5xl md:text-6xl">
              One price, no surprise overage.
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[#475569] md:text-lg">
              Pick a plan and know exactly what you'll pay every month.
            </p>
          </Reveal>

          {/* Monthly / Annual Billing Toggle Switcher */}
          <div className="mt-10 flex justify-center items-center">
            <Reveal delay={0.1}>
              <div className="relative flex items-center gap-3">
                <span className={`text-sm font-medium transition-colors duration-200 ${!isAnnual ? "text-slate-900" : "text-slate-400"}`}>
                  Monthly
                </span>
                
                <div className="relative flex rounded-full bg-slate-200/60 p-1 border border-slate-200/80 w-16 h-8 items-center cursor-pointer" onClick={() => setIsAnnual(!isAnnual)}>
                  <motion.div
                    className="h-6 w-6 rounded-full bg-white shadow-sm border border-slate-100 flex items-center justify-center"
                    layout
                    transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    style={{ x: isAnnual ? 30 : 0 }}
                  />
                </div>

                <div className="relative flex items-center">
                  <span className={`text-sm font-medium transition-colors duration-200 ${isAnnual ? "text-slate-900 font-semibold" : "text-slate-400"}`}>
                    Annually
                  </span>
                  
                  {/* Floating Discount Badge */}
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ duration: 0.3 }}
                    className="absolute left-full ml-3 whitespace-nowrap bg-gradient-to-r from-teal-500 to-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-sm"
                    style={{ originX: 0 }}
                  >
                    <motion.span
                      className="inline-block"
                      animate={{ y: [0, -4, 0] }}
                      transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                    >
                      Save 20%
                    </motion.span>
                  </motion.div>
                </div>
              </div>
            </Reveal>
          </div>
        </div>
      </section>

      {/* Plans Section */}
      <section className="pb-20 md:pb-28 relative" id="plans">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            variants={containerVariants}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, amount: 0.15 }}
            className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4 items-stretch"
          >
            {plans.map((plan, index) => {
              const isPopular = plan.highlighted;
              return (
                <motion.div
                  key={plan.id}
                  variants={cardVariants}
                  whileHover={{ 
                    y: -8, 
                    scale: 1.015,
                    transition: { duration: 0.25, ease: "easeOut" } 
                  }}
                  className="relative flex h-full"
                >
                  <div
                    className={`flex h-full w-full flex-col rounded-2xl border p-6 transition-all duration-300 relative overflow-hidden group ${
                      isPopular
                        ? "border-blue-500/80 bg-white shadow-[0_20px_40px_-15px_rgba(55,132,255,0.18)]"
                        : "border-slate-200/90 bg-white hover:border-slate-300 shadow-sm"
                    }`}
                  >
                    {/* Visual glowing aura for popular plan */}
                    {isPopular && (
                      <div className="absolute top-0 right-0 -mr-20 -mt-20 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl pointer-events-none group-hover:bg-blue-500/20 transition-colors duration-300" />
                    )}

                    {isPopular && (
                      <div className="mb-4">
                        <span className="inline-flex items-center rounded-full bg-gradient-to-r from-blue-500 to-indigo-500 px-3 py-1 text-[11px] font-bold tracking-wider uppercase text-white shadow-sm">
                          Most popular
                        </span>
                      </div>
                    )}
                    
                    <h2 className="text-xl font-bold text-slate-900">{plan.name}</h2>
                    
                    {/* Animated Price display */}
                    <div className="mt-4 flex items-baseline gap-1.5 h-12 overflow-hidden">
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={isAnnual ? "annual" : "monthly"}
                          initial={{ y: 24, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: -24, opacity: 0 }}
                          transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
                          className="text-4xl font-extrabold text-slate-900 tracking-tight"
                        >
                          {isAnnual ? plan.annualPrice : plan.monthlyPrice}
                        </motion.span>
                      </AnimatePresence>
                      <span className="text-sm font-medium text-slate-400">
                        {isAnnual ? plan.annualCadence : plan.monthlyCadence}
                      </span>
                    </div>

                    <p className="mt-3 text-sm leading-relaxed text-slate-500 flex-grow min-h-[48px]">
                      {plan.description}
                    </p>
                    
                    <div className="border-t border-slate-100 my-5 pt-4">
                      <p className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
                        {plan.seats}
                      </p>
                      
                      <ul className="mt-4 flex flex-col gap-3 text-sm text-slate-600">
                        {plan.features.map((feature, fIndex) => (
                          <li key={feature} className="flex items-start gap-2.5">
                            <AnimatedCheck delay={(index * 0.1) + (fIndex * 0.05) + 0.3} />
                            <span className="leading-tight">{feature}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <Link
                      href="/signup"
                      className={`mt-6 flex h-11 w-full items-center justify-center rounded-full text-sm font-semibold transition-all duration-200 ${
                        isPopular
                          ? "bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-md shadow-blue-500/10 hover:shadow-lg hover:shadow-blue-500/20 hover:brightness-105"
                          : "border border-slate-200 text-slate-800 hover:bg-slate-50 hover:border-slate-300"
                      }`}
                    >
                      Start free trial
                    </Link>
                  </div>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className="bg-slate-50/30 border-t border-b border-slate-100 py-20 md:py-28 relative">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center md:text-left">
            <Reveal>
              <h2 className="font-neue-haas text-3xl font-normal tracking-tight text-slate-900 md:text-4xl">
                Compare plans side by side.
              </h2>
              <p className="mt-2 text-sm text-slate-500">
                Detailed breakdowns of features for each tier.
              </p>
            </Reveal>
          </div>

          <Reveal delay={0.1}>
            <div className="mt-10 overflow-x-auto rounded-2xl border border-slate-200/80 bg-white shadow-md">
              <table className="w-full min-w-[768px] text-left text-sm border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70">
                    <th className="px-6 py-6 font-semibold text-slate-900 text-sm md:text-base w-[32%]">
                      Feature Breakdown
                    </th>
                    {plans.map((plan) => {
                      const isPopular = plan.highlighted;
                      return (
                        <th 
                          key={plan.id} 
                          className={`px-6 py-6 text-left relative transition-colors duration-150 w-[17%] ${
                            isPopular ? "bg-blue-50/20 border-x border-blue-500/10" : ""
                          }`}
                        >
                          {isPopular && (
                            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-blue-500 to-indigo-500" />
                          )}
                          <div className="font-bold text-slate-900 text-sm md:text-base flex items-center gap-1.5">
                            {plan.name}
                            {isPopular && (
                              <span className="inline-block h-1.5 w-1.5 rounded-full bg-blue-500 animate-ping" />
                            )}
                          </div>
                          <div className="text-xs font-semibold text-slate-500 mt-1">
                            {isAnnual ? plan.annualPrice : plan.monthlyPrice}
                            <span className="text-[10px] font-normal text-slate-400">
                              {plan.id === "free" ? "" : isAnnual ? "/mo" : "/mo"}
                            </span>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {comparisonCategories.map((category) => (
                    <Fragment key={category.categoryName}>
                      {/* Category Header Row */}
                      <tr className="bg-slate-50/40 border-y border-slate-100">
                        <td 
                          colSpan={5} 
                          className="px-6 py-3 text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-100/40"
                        >
                          {category.categoryName}
                        </td>
                      </tr>
                      {category.rows.map((row) => (
                        <motion.tr 
                          key={row.label}
                          onHoverStart={() => setHoveredRow(row.label)}
                          onHoverEnd={() => setHoveredRow(null)}
                          className="transition-colors duration-150"
                          animate={{
                            backgroundColor: hoveredRow === row.label ? "rgba(59, 130, 246, 0.03)" : "rgba(255,255,255,0)"
                          }}
                        >
                          <td className="px-6 py-4.5">
                            <div className="font-semibold text-slate-800 leading-snug">{row.label}</div>
                            <div className="text-xs text-slate-400 font-normal mt-0.5 max-w-[280px] leading-normal">
                              {row.description}
                            </div>
                          </td>
                          {row.values.map((value, i) => {
                            const plan = plans[i];
                            const isPopular = plan.highlighted;
                            const isCheck = value === "Yes";
                            const isDash = value === "—";
                            
                            return (
                              <td 
                                key={plan.id} 
                                className={`px-6 py-4.5 transition-colors duration-150 ${
                                  isPopular ? "bg-blue-50/10 border-x border-blue-500/5" : ""
                                }`}
                              >
                                {isCheck ? (
                                  <div className="flex items-center gap-1.5 text-emerald-600 font-semibold">
                                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100">
                                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    </span>
                                  </div>
                                ) : isDash ? (
                                  <span className="text-slate-300 font-light">—</span>
                                ) : (
                                  <span className={`font-semibold ${
                                    value === "Full" || value.includes("Slack") || value.includes("Priority")
                                      ? "text-slate-800" 
                                      : "text-slate-500 font-medium"
                                  }`}>
                                    {value}
                                  </span>
                                )}
                              </td>
                            );
                          })}
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

      {/* FAQ and Final CTA Sections */}
      <Faq />
      <FinalCta />
    </div>
  );
}
