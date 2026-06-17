// Startup environment-variable validation with Zod — fails fast on misconfiguration.
// Destination: src/lib/security/env-validation.ts
// Import this from `instrumentation.ts` (register()) or another server entry point
// so the process refuses to boot with a broken environment.

import { z } from 'zod';

const envSchema = z.object({
  // Required.
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid connection URL'),
  NODE_ENV: z
    .enum(['development', 'test', 'production'])
    .default('development'),

  // Optional — present only when the corresponding feature is enabled.
  OPENAI_API_KEY: z.string().min(1).optional(),
  SENTRY_DSN: z.string().url().optional(),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | null = null;

/**
 * Validates `process.env` against the schema. Throws a single error that lists
 * every missing or invalid variable, so a misconfigured deploy fails loudly at
 * startup instead of crashing deep inside a request later.
 *
 * The result is cached, so repeated calls are cheap.
 */
export function validateEnv(): Env {
  if (cached !== null) return cached;

  const result = envSchema.safeParse(process.env);
  if (!result.success) {
    const lines = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`,
    );
    throw new Error(
      `Invalid environment configuration:\n${lines.join('\n')}`,
    );
  }

  cached = result.data;
  return cached;
}
