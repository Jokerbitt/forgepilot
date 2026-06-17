// cn.ts — Tailwind class merge helper. Destination: src/lib/cn.ts
// Combines clsx (conditional classes) with tailwind-merge (dedupes conflicts).
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
