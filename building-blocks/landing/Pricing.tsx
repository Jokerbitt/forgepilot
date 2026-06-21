// Pricing.tsx — Pricing cards with a highlighted recommended tier and per-tier CTA.
// Destination: src/components/landing/Pricing.tsx
import Link from 'next/link';
import { cn } from '@/lib/cn';

export interface PricingTier {
  name: string;
  price: string;
  period?: string;
  description?: string;
  features: string[];
  highlighted?: boolean;
  cta?: { label: string; href: string };
}

export interface PricingProps {
  eyebrow?: string;
  heading?: string;
  tiers?: PricingTier[];
  className?: string;
}

const DEFAULT_TIERS: PricingTier[] = [
  {
    name: 'Free',
    price: '$0',
    period: '/mo',
    description: 'For trying things out.',
    features: ['1 project', 'Community support', 'Basic analytics'],
    cta: { label: 'Get started', href: '/signup' },
  },
  {
    name: 'Pro',
    price: '$19',
    period: '/mo',
    description: 'For growing teams.',
    features: [
      'Unlimited projects',
      'Priority support',
      'Advanced analytics',
      'Custom domains',
    ],
    highlighted: true,
    cta: { label: 'Start free trial', href: '/signup?plan=pro' },
  },
  {
    name: 'Team',
    price: '$49',
    period: '/mo',
    description: 'For scaling organizations.',
    features: [
      'Everything in Pro',
      'SSO & SAML',
      'Audit logs',
      'Dedicated support',
    ],
    cta: { label: 'Contact sales', href: '/contact' },
  },
];

export function Pricing({
  eyebrow = 'Pricing',
  heading = 'Simple, transparent pricing',
  tiers = DEFAULT_TIERS,
  className,
}: PricingProps) {
  return (
    <section id="pricing" className={cn('px-6 py-24 sm:py-32', className)}>
      <div className="mx-auto max-w-2xl text-center">
        {eyebrow ? (
          <p className="text-base font-semibold text-indigo-600 dark:text-indigo-400">
            {eyebrow}
          </p>
        ) : null}
        {heading ? (
          <h2 className="mt-2 text-3xl font-bold tracking-tight text-zinc-900 dark:text-white sm:text-4xl">
            {heading}
          </h2>
        ) : null}
      </div>

      <div className="mx-auto mt-16 grid max-w-6xl grid-cols-1 items-start gap-8 lg:grid-cols-3">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={cn(
              'flex flex-col rounded-3xl border p-8 shadow-sm',
              tier.highlighted
                ? 'border-indigo-600 bg-white ring-1 ring-indigo-600 dark:border-indigo-500 dark:bg-zinc-900 dark:ring-indigo-500'
                : 'border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900',
            )}
          >
            <div className="flex items-center justify-between gap-x-4">
              <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
                {tier.name}
              </h3>
              {tier.highlighted ? (
                <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-semibold text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                  Recommended
                </span>
              ) : null}
            </div>

            {tier.description ? (
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                {tier.description}
              </p>
            ) : null}

            <p className="mt-6 flex items-baseline gap-x-1">
              <span className="text-4xl font-bold tracking-tight text-zinc-900 dark:text-white">
                {tier.price}
              </span>
              {tier.period ? (
                <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  {tier.period}
                </span>
              ) : null}
            </p>

            <ul
              role="list"
              className="mt-8 flex-1 space-y-3 text-sm text-zinc-600 dark:text-zinc-300"
            >
              {tier.features.map((feature) => (
                <li key={feature} className="flex gap-x-3">
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-5 w-5 flex-none text-indigo-600 dark:text-indigo-400"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.704 4.153a.75.75 0 0 1 .143 1.052l-8 10.5a.75.75 0 0 1-1.127.075l-4.5-4.5a.75.75 0 0 1 1.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 0 1 1.05-.143Z"
                      clipRule="evenodd"
                    />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>

            {tier.cta ? (
              <Link
                href={tier.cta.href}
                className={cn(
                  'mt-8 inline-flex w-full items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
                  tier.highlighted
                    ? 'bg-indigo-600 text-white hover:bg-indigo-500 focus-visible:outline-indigo-600'
                    : 'border border-zinc-300 bg-white text-zinc-900 hover:bg-zinc-50 focus-visible:outline-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800',
                )}
              >
                {tier.cta.label}
              </Link>
            ) : null}
          </div>
        ))}
      </div>
    </section>
  );
}
