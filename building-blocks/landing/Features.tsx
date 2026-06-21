// Features.tsx — Responsive 3-col feature card grid driven by a `features` prop.
// Destination: src/components/landing/Features.tsx
import type { ReactNode } from 'react';
import { cn } from '@/lib/cn';

export interface Feature {
  icon?: ReactNode;
  title: string;
  description: string;
}

export interface FeaturesProps {
  eyebrow?: string;
  heading?: string;
  features?: Feature[];
  className?: string;
}

const DEFAULT_FEATURES: Feature[] = [
  {
    title: 'Fast by default',
    description:
      'Server components, streaming, and smart caching out of the box — no config required.',
  },
  {
    title: 'Type-safe end to end',
    description:
      'Strict TypeScript across the stack catches mistakes before they reach production.',
  },
  {
    title: 'Accessible & themeable',
    description:
      'WCAG-minded components with first-class dark mode and keyboard support.',
  },
];

export function Features({
  eyebrow = 'Features',
  heading = 'Everything you need to ship',
  features = DEFAULT_FEATURES,
  className,
}: FeaturesProps) {
  return (
    <section
      id="features"
      className={cn('px-6 py-24 sm:py-32', className)}
    >
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

      <ul
        role="list"
        className="mx-auto mt-16 grid max-w-6xl grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
      >
        {features.map((feature) => (
          <li
            key={feature.title}
            className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900"
          >
            {feature.icon ? (
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400">
                {feature.icon}
              </div>
            ) : null}
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-white">
              {feature.title}
            </h3>
            <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              {feature.description}
            </p>
          </li>
        ))}
      </ul>
    </section>
  );
}
