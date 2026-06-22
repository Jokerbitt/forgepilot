/**
 * Workspace-isolation prompt fragments for the agent runner.
 *
 * The agent runs with its cwd set to an ISOLATED checkout (a depth-1 clone or a
 * git worktree) of the target repo. The result writeback + the changed-file gate
 * (see agent-runner/worktree.ts: getWorkspaceChangedFiles / writebackLocalResult)
 * read ONLY from that workspace path. If the agent `cd`s into the original
 * target repo and edits there instead, the gate finds "no changes", an auto-retry
 * fires, and the work is lost (observed in 1/3 hardening runs).
 *
 * These pure builders make the "work in the current directory, never cd to
 * another copy" instruction explicit and unit-testable, without pulling the full
 * prompt builder out of the route.
 */

/**
 * Intro line for a LOCAL external target. `targetRepo` is given only as context
 * (which project the task is for) — NOT as a working path. The working path is
 * always the current directory (the isolated checkout).
 */
export function buildIsolatedTargetIntro(targetRepo: string): string {
  return `You are an autonomous software engineering agent. Your task targets the project **${targetRepo}** — but you are working inside an ISOLATED checkout of it located at your CURRENT working directory. Do all work here, in the current directory; never \`cd\` to \`${targetRepo}\` or any other copy of the repo (that copy is read-only context — editing it bypasses the result writeback and your work is lost). FIRST read the current directory's CLAUDE.md / README.md and package.json to learn its stack, scripts and conventions — do NOT assume ForgePilot's stack.`
}

/**
 * Anti-drift rule line that forbids leaving the isolated workspace. Applies to
 * every run (ForgePilot worktree and external clone alike).
 */
export const WORKSPACE_ISOLATION_RULE =
  '- **Stay in your workspace**: your isolated checkout IS the current working directory. Never `cd` out of it into another copy of the repo — edits there are NOT written back and the run is wasted.'
