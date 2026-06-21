# Agent Provider Strategy

ForgePilot should treat agent providers as replaceable execution or review profiles. The app should not require API keys for the first productive local test run when Claude Code, Codex CLI, Ollama, LM Studio, or another local/desktop agent is already authenticated on the machine.

## Current Default

- Claude Code and Codex are primary desktop coding agents when their CLIs are installed and authenticated.
- Ollama and LM Studio are local model hosts for private classification, summarization, and critic runs.
- Hermes is registered as a local critic/planning profile. It is best used for second opinions, risk review, and daily-report critique before it is trusted for code changes.
- OpenClaw is registered as a disabled external coding-agent profile. Enable it only after a local CLI or private endpoint is configured and validated.

## Hermes

Recommended first use:

- local critic review
- planning critique
- risk analysis
- summarization

Configuration:

```bash
OLLAMA_BASE_URL=http://localhost:11434
FORGEPILOT_HERMES_MODEL=nous-hermes2:latest
```

Hermes should stay propose-only by default. It may influence routing decisions and critic output, but should not write files until it has passed the same evidence harness as Claude Code and Codex.

## OpenClaw

Recommended first use:

- supervised implementation drafts
- repo navigation
- review assistance

Configuration options:

```bash
OPENCLAW_CLI=openclaw
OPENCLAW_ENDPOINT=http://localhost:8787
```

OpenClaw should remain disabled until ForgePilot can prove:

- authenticated runner availability
- isolated worktree execution
- no secret exposure in prompts, logs, or payloads
- diff generation
- tests pass
- PR summary and critic review are created

## Paperclip Decision

Do not add a hard Paperclip dependency for V1 unless the user already relies on Paperclip externally. ForgePilot needs a native workbench more than another integration:

- live run timeline
- evidence attachments
- branch diff preview
- critic notes
- PR and merge controls
- knowledge writeback

This can be built as a native “work evidence” layer and later export or sync to Paperclip-like tools if needed.

