/**
 * Resolve which ANTHROPIC_API_KEY (if any) to inject into a spawned Claude CLI
 * runner's environment.
 *
 * The Claude CLI gives `ANTHROPIC_API_KEY` PRECEDENCE over
 * `CLAUDE_CODE_OAUTH_TOKEN`. So when a Max OAuth token (from `claude
 * setup-token`) is present for zero-credit headless auth, injecting a
 * (possibly credit-less) API key would silently shadow the OAuth token and the
 * run 401s. In that case we must defer to the OAuth token and inject NO key.
 *
 * Pure + unit-testable — the spawning code stays a thin shell around this.
 */
export function resolveCliAnthropicKey(opts: {
  /** Value of CLAUDE_CODE_OAUTH_TOKEN in the runner's environment, if any. */
  oauthToken?: string | null
  /** ANTHROPIC_API_KEY configured via Settings / .env, if any. */
  storedKey?: string | null
}): string | undefined {
  const oauth = opts.oauthToken?.trim()
  if (oauth && oauth.length > 0) {
    // Defer to the OAuth token — a stored key would shadow it (CLI precedence).
    return undefined
  }
  const key = opts.storedKey?.trim()
  return key && key.length > 0 ? key : undefined
}
