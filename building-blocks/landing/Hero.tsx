// Hero.tsx — Marketing hero section with eyebrow, headline, subtext, two CTAs.
// Destination: src/components/landing/Hero.tsx
import Link from 'next/link';
import { cn } from '@/lib/cn';

export interface HeroProps {
  eyebrow?: string;
  headline?: string;
  subtext?: string;
  primaryCta?: { label: string; href: string };
  secondaryCta?: { label: string; href: string };
  className?: string;
}

export function Hero({
  eyebrow = 'Now in public beta',
  headline = 'Build your next idea, faster than ever',
  subtext = 'A production-ready starting point with everything you need to ship. Opinionated where it helps, flexible where it counts.',
  primaryCta = { label: 'Get started', href: '/signup' },
  secondaryCta = { label: 'Learn more', href: '#features' },
  className,
}: HeroProps) {
  return (
    <section
      className={cn(
        'relative overflow-hidden px-6 py-24 sm:py-32',
        className,
      )}
    >
      {/* Gradient accent */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl"
      >
        <div className="relative left-1/2 aspect-[1155/678] w-[36rem] -translate-x-1/2 bg-gradient-to-tr from-indigo-500 to-fuchsia-500 opacity-20 dark:opacity-30 sm:w-[72rem]" />
      </div>

      <div className="mx-auto max-w-3xl text-center">
        {eyebrow ? (
          <p className="mb-4 inline-flex items-center rounded-full border border-zinc-200 bg-white/60 px-3 py-1 text-sm font-medium text-zinc-600 backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-300">
            {eyebrow}
          </p>
        ) : null}

        <h1 className="bg-gradient-to-br from-zinc-900 to-zinc-600 bg-clip-text text-4xl font-bold tracking-tight text-transparent dark:from-white dark:to-zinc-400 sm:text-6xl">
          {headline}
        </h1>

        {subtext ? (
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            {subtext}
          </p>
        ) : null}

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          {primaryCta ? (
            <Link
              href={primaryCta.href}
              className="inline-flex w-full items-center justify-center rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:w-auto"
            >
              {primaryCta.label}
            </Link>
          ) : null}
          {secondaryCta ? (
            <Link
              href={secondaryCta.href}
              className="inline-flex w-full items-center justify-center rounded-lg border border-zinc-300 bg-white px-6 py-3 text-sm font-semibold text-zinc-900 transition hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800 sm:w-auto"
            >
              {secondaryCta.label}
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}
