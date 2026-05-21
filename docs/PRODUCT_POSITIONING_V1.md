# ForgePilot Product Positioning V1.0

## Headline

Idea -> Delegation -> Reviewed Code.

Das lokale KI-Workflow-Tool, das Agenten koordiniert und ernsthaft kontrolliert.

## Subheadline

ForgePilot verwandelt vage Ideen in strukturierte Delegations, lässt KI-Agenten lokal oder in der Cloud arbeiten, prüft die Ergebnisse kritisch und schreibt brauchbares Wissen zurück.

Für Solo-Entwickler und kleine Teams, die KI wirklich produktiv nutzen wollen: ohne Chaos, ohne verlorenes Wissen und ohne Vendor-Lock.

## Positioning

ForgePilot ist kein weiteres All-in-One AI Agent Swarm.

ForgePilot ist ein fokussierter AI Workflow Orchestrator mit starkem Review-Layer. Es hilft Entwicklern, schneller und sicherer mit KI zu bauen.

## Primary Audience

Solo-Entwickler, technische Gründer und Indie-Hacker, die bereits Claude, Cursor, Ollama, LM Studio oder ähnliche Tools nutzen und frustriert sind von unkoordinierten Agenten-Sessions.

## MVP Feature Set

### Must Stay

- Idea -> structured Brief
- Brief -> Delegation with goal, acceptance criteria, allowed file scope, risk class, token/budget limit and preferred model
- Delegation execution with local-first model routing, cloud escalation and live logs
- Grok-Critic review with correctness, security, drift, score, verdict and concrete suggestions
- Knowledge writeback for approved results
- GitHub PR creation from successful delegations

### Secondary But Useful

- Multi-provider support: Claude, Grok, Gemini, Groq, Ollama, LM Studio, OpenRouter
- Local-first persistence with JSON Phase 0 and PostgreSQL Dual-Write migration path
- Mandatory simple auth
- Command Center with Next Best Action
- Basic project and delegation overview
- Import/export for JSON and CSV

## Explicitly Not MVP

- full PM agent
- agent swarm/control-plane as a product surface
- scope board and skill matrix as headline features
- advanced context packages
- complex work items with dependency management
- billing and pricing pages
- SaaS readiness dashboard
- Telegram notifications
- detailed DSGVO ledger beyond practical PII controls
- multi-tenancy/team workspaces
- advanced governance/policy engine

## Landing Page Copy

ForgePilot ist ein lokales AI Workflow Tool für Entwickler.

Es nimmt eine Idee, erstellt einen klaren Brief, erzeugt präzise Delegations, lässt KI-Agenten arbeiten, prüft die Ergebnisse mit einem unabhängigen Critic und schreibt das gewonnene Wissen dauerhaft zurück.

Warum ForgePilot anders ist:

- Local-first mit sinnvollem Model-Routing
- starke Scope- und Approval-Kontrolle
- unabhängiger Critic-Layer statt blindem Vertrauen
- kein Vendor-Lock
- selbst gehostet auf Maschine, Server oder NAS

## Next Product Priorities

1. README and product positioning must stay honest and focused.
2. Landing/dashboard must focus on the next useful action.
3. Command Center and Delegations page need premium UI first.
4. PostgreSQL migration and mandatory auth must finish before SaaS claims.
5. Run 5-10 real internal projects through the full MVP flow and document results.

## Product Guardrails

- Do not promise full autonomous software delivery.
- Do not sell JSON persistence as SaaS-ready architecture.
- Do not add more agent-control surfaces until the core delegation flow is excellent.
- Do not build billing before the single-user local tool is genuinely useful.
- Do not hide uncertainty in local model output; escalate when confidence is low.
