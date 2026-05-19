# ForgePilot — Vision & Philosophy

## The Problem We're Solving

Most developers today use AI the same way they used Stack Overflow in 2010 — one isolated question at a time, copy-pasting answers into a codebase that the AI has never seen, losing every ounce of context the moment the chat window closes.

The result: repetitive prompting, inconsistent outputs, zero institutional memory, and AI that never actually learns your codebase, your architecture decisions, or how you think.

We believe this is a fundamental workflow problem, not a model quality problem.

## The Vision

**ForgePilot is an AI operating system for developers** — a structured layer between you and AI models that handles context, memory, delegation, control, and learning automatically.

Instead of prompting ChatGPT with a half-remembered requirement, you work with a system that:

1. **Knows your codebase** — automatically indexes relevant files, knowledge cards, and past decisions before every AI call
2. **Remembers everything** — orchestration results write back to a knowledge store that grows smarter with every run
3. **Controls the AI** — delegation has risk classes, approval flows, and drift detection built in — the AI doesn't go rogue
4. **Respects your privacy** — PII is scrubbed before it leaves your machine, a processing ledger tracks every AI call (GDPR Art. 30), and everything runs on your own hardware

The end state: a developer with ForgePilot is not just faster — they are qualitatively different. Their AI compounds. Every task makes the next one better.

## Core Principles

### 1. Local-First, Always
Your ideas, your code, your keys, your data — they live on your machine. Cloud sync is opt-in, never required. We believe the best AI workflow tool is one you fully control.

### 2. Context is Everything
An AI call without context is a coin flip. ForgePilot's context engineering layer — a 5-layer stack of system, task, knowledge, constraints, and privacy-scrubbed content — ensures every AI call starts with the right information.

### 3. Control Before Speed
We deliberately add approval flows, risk classes, and drift detection. Not because AI is dangerous, but because *unreviewed AI output in production is a liability*. ForgePilot makes human oversight fast and frictionless, not slow and bureaucratic.

### 4. Memory Compounds
Every orchestration run produces knowledge cards. Those cards feed the next run's context. Over time, a ForgePilot instance trained on a codebase becomes dramatically better than a cold AI model — because it knows the domain.

### 5. Any AI, Anywhere
We are radically provider-agnostic. Anthropic, OpenAI, Groq, Mistral, Ollama, LM Studio — and any OpenAI-compatible endpoint you add yourself. We don't lock you in. We don't even charge for the AI — you bring your own keys.

## Who This Is For

**Primary audience:** Developers and solopreneurs who ship software and want to use AI seriously — not as a toy, but as a reliable part of their workflow.

**Secondary audience:** Small dev teams (2–5 people) who want a shared AI workflow layer without the complexity of enterprise AI platforms.

**Not for:** Anyone who wants a fully autonomous AI that runs without oversight. ForgePilot is explicitly designed for humans who want to stay in the loop.

## The Open Core Model

ForgePilot's core is MIT licensed and always will be. Self-hosted, self-run, full features.

We will build a commercial layer on top — managed cloud hosting, team features, enterprise compliance — to fund ongoing development. But the engine that makes ForgePilot powerful will always be open.

We believe open source is the right model for infrastructure that touches code, keys, and personal data. You should be able to read every line of code that handles your API keys and your ideas.

## What We're Building Toward

In the near term:
- A fully local AI workflow OS that any developer can self-host in 5 minutes
- An ecosystem of community-built providers and connectors
- A knowledge writeback system that makes every project's AI smarter over time

In the medium term:
- Multi-user collaboration with proper tenant isolation
- A marketplace for ForgePilot skills and connectors
- Deep integration with the tools developers actually use (Linear, GitHub, Jira, Notion)

Long term:
- A standard for structured AI delegation that other tools can build on
- An open eval harness that the community uses to measure AI quality across providers and tasks
- A world where "AI drift" and "AI hallucination" are treated as engineering problems with engineering solutions — not just facts of life

## How You Can Help

ForgePilot is built in the open because the problems it solves are bigger than any one developer.

If you believe AI should be **controllable, transparent, and privacy-respecting by default**, contribute.

If you've built something on top of ForgePilot — a new provider, a new connector, a better eval — share it.

If you think we're wrong about something — a design decision, a principle, a direction — open an issue and tell us.

The best AI workflow tools will be built by communities of developers who use them every day. This is an invitation to be part of that.

---

*ForgePilot is built by [Sven Bittl](https://github.com/Jokerbitt) and contributors.*  
*Star the repo if you believe in this vision. It helps more than you think.*
