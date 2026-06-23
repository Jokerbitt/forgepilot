/**
 * Language-agnostic verify-gate resolver (pure).
 *
 * The runner's build/test gate (execute route) must verify the agent's work
 * BEFORE it is written back to a target repo. Historically the gate derived its
 * commands ONLY from a Node `package.json` (`npm run build` / `npm run <test>`).
 * Non-Node repos (Python, Go, Rust — no package.json) therefore produced NO
 * gate commands → the gate `skipped` → unverified code reached the target. That
 * silently undermined the verify-gate for every non-Node project.
 *
 * This resolver detects the stack from the workspace's top-level file listing
 * and returns the build/test commands to run as `{ cmd, args }` pairs, so the
 * runner can spawn them directly instead of hard-coding `npm`. It is pure: the
 * input is the list of file names present (no real fs access needed) plus, for
 * Node, the already-parsed `package.json` scripts — keeping it unit-testable.
 *
 * The Node path reproduces the previous behaviour EXACTLY so the many existing
 * Node tests keep passing:
 *   - build: present only when a `build` script exists → `npm run build`
 *   - test:  `resolveVerifyScripts(scripts).test` (test:run ?? … ?? test)
 *            → `npm run <script>`, absent when there is no test script.
 */

import { resolveVerifyScripts } from './verify-scripts'

export type StackId = 'node' | 'python' | 'go' | 'rust' | 'unknown'

/** A single command to spawn for a gate step. */
export interface GateCommand {
  /** Executable to spawn (e.g. `npm`, `python3`, `go`, `cargo`). */
  cmd: string
  /** Arguments passed to the executable. */
  args: string[]
}

export interface StackGate {
  /** Detected stack — drives which build/test commands are returned. */
  stack: StackId
  /** Build command, or undefined when the stack has no (sensible) build step. */
  build?: GateCommand
  /** Test command, or undefined when no test step can be derived. */
  test?: GateCommand
}

export interface StackGateInput {
  /**
   * Top-level file names present in the workspace (basenames, not full paths).
   * Only marker files matter — e.g. `package.json`, `go.mod`, `Cargo.toml`.
   */
  files: string[]
  /**
   * Parsed `package.json` scripts for the Node path. Ignored for other stacks.
   * Pass `undefined` when there is no package.json or it could not be read.
   */
  scripts?: Record<string, string> | undefined | null
}

/** Detect the stack from the marker files present (Node wins when ambiguous). */
export function detectStack(files: string[]): StackId {
  const set = new Set(files)
  if (set.has('package.json')) return 'node'
  if (set.has('pyproject.toml') || set.has('setup.py') || set.has('requirements.txt')) return 'python'
  if (set.has('go.mod')) return 'go'
  if (set.has('Cargo.toml')) return 'rust'
  return 'unknown'
}

/**
 * Resolve the build/test gate commands for a workspace.
 *
 * - Node: identical to the legacy npm logic (build only when a build script
 *   exists; test via resolveVerifyScripts).
 * - Python: test = `python3 -m pytest -q`; no build step (Python has no
 *   meaningful compile gate here).
 * - Go: build = `go build ./...`; test = `go test ./...`.
 * - Rust: build = `cargo build`; test = `cargo test`.
 * - Unknown: no commands — the caller logs this as explicitly "ungated".
 */
export function resolveStackGate(input: StackGateInput): StackGate {
  const stack = detectStack(input.files)

  switch (stack) {
    case 'node': {
      const v = resolveVerifyScripts(input.scripts)
      return {
        stack,
        // Node build mirrors the previous gate: present iff a build script exists.
        ...(v.build ? { build: { cmd: 'npm', args: ['run', v.build] } } : {}),
        ...(v.test ? { test: { cmd: 'npm', args: ['run', v.test] } } : {}),
      }
    }
    case 'python':
      return {
        stack,
        test: { cmd: 'python3', args: ['-m', 'pytest', '-q'] },
      }
    case 'go':
      return {
        stack,
        build: { cmd: 'go', args: ['build', './...'] },
        test: { cmd: 'go', args: ['test', './...'] },
      }
    case 'rust':
      return {
        stack,
        build: { cmd: 'cargo', args: ['build'] },
        test: { cmd: 'cargo', args: ['test'] },
      }
    case 'unknown':
      return { stack }
  }
}
