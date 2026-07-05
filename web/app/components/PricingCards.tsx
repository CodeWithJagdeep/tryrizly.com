import Link from 'next/link';

export type Plan = {
  id: string;
  name: string;
  price: string;
  cadence: string;
  description: string;
  cta: string;
  href: string;
  features: string[];
  highlighted?: boolean;
  /** Launch/intro price shown instead of `price`, e.g. "$15 for your first 3 months". */
  introPrice?: string;
  introNote?: string;
};

// Mirrors apps/billing/src/plans.ts — keep the two in sync. No "Free" card:
// there's no standing free plan, just a 10-day trial on any paid plan below
// (see apps/billing/src/plans.ts "free" entry for the post-trial floor state,
// which stays internal/unmarketed).
export const plans: Plan[] = [
  {
    id: 'starter',
    name: 'Starter',
    price: '$20',
    cadence: '/month',
    introPrice: '$10',
    introNote: 'First month, then $20/mo',
    description: 'Founder-grade daily assistant with controlled background AI.',
    cta: 'Start 10-day free trial',
    href: '/signup',
    features: ['Email triage & drafting', 'Morning brief & reminders', 'Connector memory', '1,200 AI credits/month'],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$49',
    cadence: '/month',
    description: 'Heavier inbox, meetings, and proactive workflow automation.',
    cta: 'Start 10-day free trial',
    href: '/signup',
    features: ['Everything in Starter', 'Priority agent runs', 'Weekly digest automation', '3,400 AI credits/month'],
    highlighted: true,
  },
  {
    id: 'business',
    name: 'Business',
    price: '$100',
    cadence: '/month',
    description: 'The highest AI budget for deep background work.',
    cta: 'Start 10-day free trial',
    href: '/signup',
    features: ['Everything in Pro', '8,000 AI credits/month', 'Business-system integrations', 'Priority support'],
  },
];

function CheckIcon() {
  return (
    <svg className='h-4 w-4 shrink-0 text-[#FE7F2D]' fill='none' viewBox='0 0 20 20' stroke='currentColor' strokeWidth='2.5' aria-hidden='true'>
      <path strokeLinecap='round' strokeLinejoin='round' d='M16 6 8.5 13.5 4 9' />
    </svg>
  );
}

/** The joined pricing-card grid used on /pricing and the homepage — one source, no drift. */
export function PricingCards() {
  return (
    <div className='grid grid-cols-1 overflow-hidden border-2 border-black md:grid-cols-3'>
      {plans.map((plan, index) => (
        <div
          key={plan.id}
          className={`relative flex flex-col p-8 ${
            index > 0 ? 'border-t-2 border-black md:border-t-0 md:border-l-2' : ''
          } ${index === 2 ? 'md:border-t-2 lg:border-t-0' : ''} ${index === 3 ? 'md:border-t-2 lg:border-t-0' : ''} ${
            plan.highlighted ? 'bg-black text-white' : 'bg-white'
          }`}
        >
          {plan.highlighted && (
            <span className='absolute right-0 top-0 bg-[#FE7F2D] px-3 py-1.5 text-[11px] font-black uppercase tracking-[0.16em] text-white'>
              Most popular
            </span>
          )}

          <h3 className={`text-[13px] font-black uppercase tracking-[0.2em] ${plan.highlighted ? 'text-[#FE7F2D]' : 'text-slate-400'}`}>
            {plan.name}
          </h3>
          <div className='mt-5 flex items-baseline gap-1.5'>
            <span className='font-neue-haas text-5xl font-medium tracking-tight'>{plan.introPrice ?? plan.price}</span>
            <span className={`text-sm font-medium ${plan.highlighted ? 'text-white/50' : 'text-slate-400'}`}>
              {plan.cadence}
            </span>
            {plan.introPrice && (
              <span className={`text-sm font-medium line-through ${plan.highlighted ? 'text-white/40' : 'text-slate-300'}`}>
                {plan.price}
              </span>
            )}
          </div>
          {plan.introNote && (
            <p className='mt-1 text-xs font-semibold text-[#FE7F2D]'>{plan.introNote}</p>
          )}
          <p className={`mt-4 min-h-[48px] text-sm leading-6 ${plan.highlighted ? 'text-white/60' : 'text-slate-500'}`}>
            {plan.description}
          </p>

          <Link
            href={plan.href}
            className={`mt-6 inline-flex h-12 items-center justify-center px-4 text-sm font-semibold transition-colors ${
              plan.highlighted
                ? 'bg-[#FE7F2D] text-white hover:bg-white hover:text-black'
                : 'bg-black text-white hover:bg-[#FE7F2D]'
            }`}
          >
            {plan.cta}
          </Link>

          <ul className={`mt-8 space-y-3.5 border-t-2 pt-7 ${plan.highlighted ? 'border-white/15' : 'border-black/10'}`}>
            {plan.features.map((feature) => (
              <li key={feature} className='flex items-start gap-2.5'>
                <span className='mt-0.5'>
                  <CheckIcon />
                </span>
                <span className={`text-sm font-medium leading-5 ${plan.highlighted ? 'text-white/80' : 'text-slate-700'}`}>
                  {feature}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
