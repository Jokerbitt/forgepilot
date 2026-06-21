# Ollama Runner — local model as a (free) build runner

ForgePilot can execute a delegation with a **local Ollama model** instead of the
Claude cloud API. The agent runs a tool-use loop against a model served by
Ollama, edits files in an isolated workspace, gates the result with a build, and
(for local target repos) writes the result back. Cloud cost is `0`; a
Claude-equivalent cost is still computed for comparison.

This doc describes how it is wired today. Source of truth is the code under
`src/lib/agent-runner/`, `src/lib/ai/` and `src/lib/delegations/`.

---

## 1. Activation & configuration

The execution path is chosen by `selectDelegationExecutionMode()`
(`src/lib/delegations/execution-mode.ts`): when the resolved route is
`ollama-agent`, the `OllamaAgentRunner` runs; otherwise it falls back to the
Claude API / simulation. If Ollama is not reachable, the mode selection falls
back automatically (`isOllamaReachable()` in `src/lib/ai/ollama-client.ts`,
~2 s fail-open probe).

| Env var | Purpose | Default |
|---|---|---|
| `OLLAMA_BASE_URL` | Ollama endpoint (also read from `api-keys.json`) | `http://localhost:11434` |
| `FORGEPILOT_RUNNER_ROOT` | where workspaces/worktrees are created | `<os.tmpdir>/forgepilot-runner-worktrees` |
| `FORGEPILOT_RUNNER_BASE_REF` | git ref the agent works from | `HEAD` |
| `FORGEPILOT_RUNNER_TARGET_REPO` | external target repo (local path or GitHub URL) | _(unset → worktree mode on this repo)_ |
| `FORGEPILOT_KEEP_RUNNER_WORKTREES` | keep the workspace after a run | `false` |
| `FORGEPILOT_KEEP_FAILED_RUNNER_WORKTREES` | keep workspaces of failed runs (for debugging) | `true` |

**Endpoints used:** `POST <baseUrl>/api/chat` (agent turns),
`GET <baseUrl>/api/tags` (autodetect available models).

**Autodetect:** querying `/api/tags` returns the installed models (with size /
modified date); on failure it returns an empty list and the error
`Ollama not running` (see `src/lib/ai/providers/__tests__/ollama-autodetect.test.ts`).

---

## 2. Models

Defaults live in `config/nba-settings.json` (see `src/lib/nba-engine/nba-config.ts`):

- **`localCodingModel`** — default `qwen2.5-coder:14b` (the agent/coding model)
- **`localFastModel`** — default `llama3.2:3b` (classification/summary/compression)

When a model has to be picked from what's installed, the preferred fallback order
is (`src/lib/ai/ollama-client.ts`):

```
llama3.3 > llama3.2 > qwen2.5:7b > qwen2.5 > mistral > gemma3 > llama3
```

**Background workloads** (`src/lib/ai/ollama-workloads.ts`) use the fast model:
`classify()` (≤32 tokens), `summarize()`, `compressContext()`. `embed()` uses a
hard-coded `bge-m3`. All have timeouts and fail open.

---

## 3. Tools exposed to the model

Defined and dispatched in `src/lib/agent-runner/tools.ts`
(`executeToolCall(call, cwd)`). All accept relative or absolute paths and
truncate their output.

| Tool | Signature | Notes |
|---|---|---|
| `bash_exec` | `(command)` | 30 s default timeout; output capped (~2000 chars); blocks dangerous patterns (`rm -rf /`, `mkfs`, `dd …of=/dev/`, fork bombs) |
| `read_file` | `(path)` | output capped (~4000 chars) |
| `write_file` | `(path, content)` | full file write / create; for **new** files or complete rewrites only |
| `edit_file` | `(path, old_string, new_string)` | **surgical** exact-match replace (see below) |
| `list_dir` | `(path)` | dirs suffixed with `/`; output capped |

### `edit_file` (the surgical edit tool)

Added so the local model stops destroying files with full rewrites. It does an
exact, **unique** string replacement:

- `old_string` must be non-empty.
- It must match **exactly once** — if not found, or found more than once, the
  tool returns an error (the model must add surrounding context to disambiguate).
- On success it replaces that one occurrence and reports a character-count delta.

This mirrors the main agent's `Edit` semantics and keeps changes minimal and
reviewable.

---

## 4. Guards / hardening

Local 14B models are fragile; these guards keep them honest
(`src/lib/agent-runner/ollama-runner.ts`, tests in `ollama-runner.test.ts`):

- **Lean prompt** — the full `buildPrompt()` (skills, knowledge, codebase scout)
  makes 14B models go silent, so the runner uses `buildOllamaTaskPrompt()`
  (`src/lib/delegations/ollama-prompt.ts`): task + context + DoD + how-to-act
  only. A focused `SYSTEM_PROMPT` carries the tool-use / completion contract.
- **No false success on empty turns** — `MAX_NO_PROGRESS_TURNS = 3`. If the model
  replies with no tool call (and no `TASK_COMPLETE`), it is nudged to act; after
  3 no-progress turns the run fails (`success=false`) instead of reporting a
  hollow success.
- **Premature-complete guard** — a `TASK_COMPLETE` with zero executed tool calls
  is rejected and nudged ("you reported complete but made no changes"); 3× → fail.
- **Build-gate before writeback** — after a successful run against a target repo,
  a workspace build must pass before any writeback happens (see the execute
  route). A red build means no writeback.

---

## 5. Workspace & writeback (external target repos, "A2")

Workspace preparation has two modes (`src/lib/agent-runner/worktree.ts`):

1. **Worktree mode** (default, ForgePilot's own repo): `git worktree add --detach
   <workspace> <baseRef>`, `node_modules` symlinked from the source; cleaned up
   with `git worktree remove --force`.
2. **Clone mode** (`FORGEPILOT_RUNNER_TARGET_REPO` set): `git clone --depth 1
   <target> <workspace>`. For **local** targets, `node_modules` is symlinked in
   so the build/tests can run; for remote URLs the agent must `npm install`
   itself (a fresh clone has no `node_modules`).

**Writeback** happens only when the run succeeded **and** the target is a **local
path** (not a GitHub URL):

1. Push the workspace HEAD to a backup branch `forgepilot/result-<delegation-id>`.
2. In the target repo, fetch that commit and `git merge --ff-only FETCH_HEAD`.
3. If the fast-forward merge changed `package.json` (or deps are missing), run
   `npm install`.

Remote GitHub targets get the backup-branch push but no automatic merge.

---

## 6. Known limitations

- **14B silence on full prompts** — mitigated by the lean prompt; do not feed the
  full delegation prompt to local models.
- **No `node_modules` for remote clones** — only local targets get the symlink;
  remote targets need an explicit install step.
- **Writeback is local-only** — remote GitHub targets are not auto-merged.
- **Cost is `0`** for Ollama runs; the `claudeEquivalentUsd` figure is an
  estimate using hard-coded Claude Sonnet pricing for comparison only.
- **Quality** depends entirely on the local model; the guards prevent false
  success and file destruction but do not raise a weak model's capability.

---

## Quick start (local)

```bash
# 1. install + run Ollama, pull the default models
ollama pull qwen2.5-coder:14b
ollama pull llama3.2:3b

# 2. point ForgePilot at it (optional — localhost is the default)
export OLLAMA_BASE_URL=http://localhost:11434

# 3. run a delegation whose execution route resolves to "ollama-agent"
```

See also: [`docs/agent-provider-strategy.md`](agent-provider-strategy.md),
[`docs/local-testing.md`](local-testing.md).
