/**
 * Agent Spawn Helpers
 *
 * Generates consistent, safe agent prompts with isolation rules built in.
 * Use spawnAgentPrompt() instead of writing raw prompts — it enforces:
 *   1. Correct worktree isolation
 *   2. Pre-flight branch check
 *   3. Scope claim before editing
 *   4. Validator run before commit
 */

import type { AgentType, SkillCategory } from './agent-skills'

export interface AgentTask {
  milestone: string          // e.g. "M51"
  branch: string             // e.g. "feature/m51-example"
  title: string              // Human-readable task name
  agentType: AgentType
  primarySkill: SkillCategory
  /** Files this agent will create/modify — for scope pre-check */
  plannedFiles: string[]
  /** The actual implementation spec */
  spec: string
}

const ISOLATION_BLOCK = `
## ⚠️ ISOLATION — PFLICHTLEKTÜRE VOR JEDEM EDIT

Du arbeitest in einem isolierten Git-Worktree. Folgende Regeln sind UNVERHANDELBAR:

1. **Dein Arbeitsverzeichnis ist dein Worktree** (der Pfad wird dir vom System mitgeteilt)
2. **NIEMALS** \`git -C /Users/svenbittl/dev/forgepilot\` verwenden — das ist der Haupt-Repo
3. **NIEMALS** Dateien unter \`/Users/svenbittl/dev/forgepilot/src/\` direkt editieren (nur über deinen Worktree-Pfad)
4. **Vor dem ersten Edit**: Verifiziere mit \`git branch --show-current\` dass du auf dem richtigen Branch bist
5. **Scope-Claim via API**: \`POST /api/agents/scope\` aufrufen bevor du anfängst (verhindert Konflikte)
6. **Validator vor Commit**: \`npm run validate:agent\` muss 0 Errors zeigen

## Pre-Flight Checklist (in dieser Reihenfolge ausführen)

\`\`\`bash
# 1. Sicherstellen dass wir im richtigen Verzeichnis sind
pwd  # muss dein worktree sein, NICHT /Users/svenbittl/dev/forgepilot

# 2. Branch verifizieren
git branch --show-current  # muss feature/mXX-... sein

# 3. Von aktuellem main starten
git fetch origin && git reset --hard origin/main
git checkout -b BRANCH_NAME  # oder: git checkout BRANCH_NAME

# 4. PATH setzen
export PATH="/opt/homebrew/Cellar/node@22/22.22.3/bin:$PATH"

# 5. Scope claimen (verhindert Überschneidungen)
curl -s -X POST http://localhost:3000/api/agents/scope \\
  -H "Content-Type: application/json" \\
  -d '{"agentId":"AGENT_ID","agentType":"AGENT_TYPE","milestone":"MILESTONE","branch":"BRANCH_NAME","filePatterns":PATTERNS}' \\
  | grep -q '"success":true' && echo "✅ Scope claimed" || echo "❌ Scope conflict — check /api/agents/scope"
\`\`\`

## Post-Work Checklist (vor Commit)

\`\`\`bash
export PATH="/opt/homebrew/Cellar/node@22/22.22.3/bin:$PATH"
npm run type-check          # muss: 0 Errors
npm run test:run -- PATTERN # muss: alle neuen Tests grün
npm run build               # muss: Build successful (kein prerender error)

# Scope freigeben nach Commit
curl -s -X DELETE http://localhost:3000/api/agents/scope/AGENT_ID
\`\`\`

## Kritische Verbote

- ❌ Keine \`export interface/function\` in Next.js Route-Dateien (außer HTTP-Handler)
- ❌ Keine Imports aus \`@/app/api/...\` in Client-Komponenten
- ❌ \`useSearchParams()\` braucht \`<Suspense>\`-Wrapper
- ❌ Nie direkt auf \`config/*.json\` schreiben — immer atomic (.tmp → rename)
`

export function spawnAgentPrompt(task: AgentTask): string {
  const patternsJson = JSON.stringify(task.plannedFiles)

  return `Du bist ein KI-Entwickler-Agent und implementierst **${task.milestone} — ${task.title}** in ForgePilot.

## Kontext
ForgePilot ist ein Next.js 14 App Router Projekt.
Stack: TypeScript strict, Tailwind CSS, Vitest, file-based JSON unter \`config/*.json\`.
GitHub: https://github.com/Jokerbitt/forgepilot
${ISOLATION_BLOCK}

## Deine Aufgabe: ${task.title}

Branch: \`${task.branch}\`
Geplante Dateien: ${patternsJson}
Agent-ID für Scope-Claim: \`agent-${task.milestone.toLowerCase()}-$(date +%s)\`

${task.spec}

## Abschluss

Wenn alles implementiert, getestet und gebaut ist:
1. Commit: \`git commit -m "feat(${task.milestone.toLowerCase()}): ${task.title.toLowerCase()}"\`
2. Gib einen strukturierten Abschlussbericht zurück:
   - Branch-Name
   - Commit-Hash
   - Neu erstellte Dateien
   - Geänderte Dateien
   - Test-Ergebnis (X/Y grün)
   - TypeScript-Status (0 Errors / N Errors)

Fang jetzt an — starte mit der Pre-Flight Checklist.`
}
