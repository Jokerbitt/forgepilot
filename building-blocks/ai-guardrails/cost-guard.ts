// Cost estimation and per-session/per-day budget enforcement for LLM calls.
// Destination: src/lib/ai/guardrails/cost-guard.ts

/** Price per 1M tokens, in USD. Keep in sync with vendor pricing. */
interface ModelPrice {
  inputPerMTok: number;
  outputPerMTok: number;
}

/**
 * Small price table. Local models are free. Unknown models fall back to
 * FALLBACK_PRICE so cost is over- rather than under-estimated.
 */
const PRICE_TABLE: Record<string, ModelPrice> = {
  // Anthropic (illustrative — verify against current pricing).
  'claude-sonnet-4-5': { inputPerMTok: 3, outputPerMTok: 15 },
  'claude-haiku-4-5': { inputPerMTok: 1, outputPerMTok: 5 },
  // Local models cost nothing.
  'llama3.2': { inputPerMTok: 0, outputPerMTok: 0 },
};

const FALLBACK_PRICE: ModelPrice = { inputPerMTok: 5, outputPerMTok: 20 };

/** Thrown when a request would exceed the configured budget. */
export class BudgetExceededError extends Error {
  constructor(
    readonly spentUsd: number,
    readonly limitUsd: number,
  ) {
    super(
      `Budget exceeded: $${spentUsd.toFixed(4)} spent of $${limitUsd.toFixed(
        2,
      )} limit`,
    );
    this.name = 'BudgetExceededError';
  }
}

/** Estimate USD cost of a single call given token counts and model name. */
export function estimateCost(
  inputTokens: number,
  outputTokens: number,
  model: string,
): number {
  const price = PRICE_TABLE[model] ?? FALLBACK_PRICE;
  const input = (inputTokens / 1_000_000) * price.inputPerMTok;
  const output = (outputTokens / 1_000_000) * price.outputPerMTok;
  return input + output;
}

/**
 * Check whether more spend is allowed. Pure function — caller tracks the
 * running total (per session, per day, etc.) and passes it in.
 */
export function checkBudget(
  spentUsd: number,
  limitUsd: number,
): { allowed: boolean; reason?: string } {
  if (spentUsd >= limitUsd) {
    return {
      allowed: false,
      reason: `Budget of $${limitUsd.toFixed(2)} reached (spent $${spentUsd.toFixed(
        4,
      )}).`,
    };
  }
  return { allowed: true };
}

/** Throwing variant for use as a hard gate before a call. */
export function assertBudget(spentUsd: number, limitUsd: number): void {
  if (!checkBudget(spentUsd, limitUsd).allowed) {
    throw new BudgetExceededError(spentUsd, limitUsd);
  }
}
