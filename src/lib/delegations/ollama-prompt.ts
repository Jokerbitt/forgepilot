/**
 * Lean task prompt for the Ollama (local-model) runner.
 *
 * Local 14B coder models (qwen2.5-coder) return EMPTY responses when fed the full
 * delegation buildPrompt (context cards + codebase scout + ForgePilot identity) —
 * empirically they only act on a short, focused prompt. The tool-use + TASK_COMPLETE
 * protocol already lives in the runner's SYSTEM_PROMPT, so the user prompt only
 * needs the task itself. Pure + unit-testable.
 */
export function buildOllamaTaskPrompt(contract: {
  goal: string
  context?: string
  definitionOfDone?: string[]
}): string {
  const dod = (contract.definitionOfDone ?? []).filter(Boolean)
  return [
    `TASK: ${contract.goal}`,
    contract.context?.trim() ? `\nCONTEXT:\n${contract.context.trim()}` : '',
    dod.length ? `\nDEFINITION OF DONE:\n${dod.map(d => `- ${d}`).join('\n')}` : '',
    `\nYou are in the project's working directory. Use the tools NOW: read the relevant file(s) with read_file, make the smallest change with write_file, verify with bash_exec ("npm run build"), then commit with bash_exec ("git add -A && git commit -m ..."). Reply TASK_COMPLETE with a one-line summary when done, or TASK_BLOCKED with the reason if you truly cannot proceed. Do not just describe — act with tool calls.`,
  ].filter(Boolean).join('\n')
}
