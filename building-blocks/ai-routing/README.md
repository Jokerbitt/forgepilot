# AI Routing

App-agnostic provider auto-routing: prefer a local model (Ollama) for cheap/fast
tasks, fall back to a cloud model (Anthropic) for quality or when local is down.

## Files

| File                    | Role                                            |
| ----------------------- | ----------------------------------------------- |
| `provider-types.ts`     | `AIProvider`, `AIResult`, `GenerateOptions`.    |
| `ollama-provider.ts`    | Local provider (`http://localhost:11434`).      |
| `anthropic-provider.ts` | Cloud provider (`@anthropic-ai/sdk`).           |
| `auto-router.ts`        | `resolveProvider()` + `generateText()`.         |

## Environment variables

| Var                 | Default                 | Meaning                                            |
| ------------------- | ----------------------- | -------------------------------------------------- |
| `AI_MODE`           | `auto`                  | `auto` \| `local` \| `cloud`. Forces routing.      |
| `OLLAMA_HOST`       | `http://localhost:11434`| Ollama base URL.                                   |
| `OLLAMA_MODEL`      | `llama3.2`              | Local model name.                                  |
| `ANTHROPIC_API_KEY` | _(unset)_               | Enables the cloud provider when present.           |

## How routing decides local vs cloud

In `AI_MODE=auto` the router probes availability, then orders providers by the
request `purpose`:

- **`purpose: 'fast'`** (default) → **local first**, cloud fallback. Keeps cheap,
  high-volume work (summaries, classification, chat) on-device.
- **`purpose: 'coding'`** → **cloud first**, local fallback. Routes harder
  reasoning to the stronger model.

Unavailable providers are filtered out before the call, and `generateText()`
retries the next provider in priority order if one throws. `AI_MODE=local` or
`cloud` pins routing to a single kind (useful for tests or offline work).

```ts
import { generateText } from './auto-router';

const result = await generateText({
  prompt: 'Summarize this changelog.',
  maxTokens: 512,
  purpose: 'fast',
});
console.log(result.text, `via ${result.provider}/${result.model}`);
```

## Adding a provider

1. Implement `AIProvider` from `provider-types.ts` (id, name, kind, `generate`,
   `isAvailable`). `isAvailable()` must never throw — return `false` on failure.
2. Register the instance in `auto-router.ts` (`localProviders` or
   `cloudProviders`). Array order = fallback priority within that kind.
3. Return a normalized `AIResult`; populate token counts when the vendor reports
   them so the cost-guard can meter spend.
