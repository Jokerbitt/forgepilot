# ForgePilot aktueller Stand

Stand: 2026-05-15 22:22
Branch: `feature/M0-foundation`
Workspace: `C:\Users\svenb\dev\forgepilot`
NAS-SSOT: `Z:\NAS\Codex\KI Betriebssystem`

## M0 Foundation

Status: abgeschlossen und verifiziert.

Gebaut:

- Next.js 14 App Router Grundsetup
- TypeScript strict
- Vitest
- Tailwind
- zentrale Domain-Modelle:
  - `WorkItem`
  - `TaskContract`
  - `Delegation`
  - `AgentRun`
  - `TraceEvent`
  - `ApprovalRequest`
  - `CostEntry`
  - `CostBudget`
  - `CostSummary`
  - `NBARecommendation`
  - `NBAScore`
  - `ConnectorManifest`
  - `ConnectorHealth`
- Re-Exports ueber `src/types/index.ts`
- Claude-Projektkontext unter `.claude/CLAUDE.md`

Verifikation:

- `npm run type-check`: erfolgreich
- `npm run lint`: erfolgreich
- `npm run test:run`: 39/39 Tests erfolgreich nach M1-Erweiterung
- `npm run build`: erfolgreich

## M1 Connector-Schicht

Status: begonnen, Foundation fuer Linear und GitHub implementiert.

Gebaut:

- `src/lib/connectors/shared.ts`
  - gemeinsamer `Fetcher` Typ
  - Health-Helfer fuer `ok`, `error`, `degraded`, `unconfigured`
  - Rate-Limit-Parser fuer GitHub-kompatible Header
- `src/lib/connectors/config.ts`
  - Env-basierte Config-Reader fuer Linear/GitHub
  - Repository-Listen-Parser ohne Secret-Ausgabe
- `src/lib/connectors/registry.ts`
  - zentrale Connector Registry
  - Manifest-Liste fuer spaeteres Onboarding UI
  - `getConnectorHealth`
  - `getAllConnectorHealth`
- `src/app/api/connectors/health/route.ts`
  - dynamische Health-API fuer alle registrierten Connectoren
  - liefert Manifeste und Health-Status, aber keine Secrets
- `src/lib/connectors/linear.ts`
  - `LinearConnectorConfig`
  - `linearConnectorManifest`
  - `getLinearConnectorHealth`
  - `mapLinearIssueToWorkItem`
- `src/lib/connectors/github.ts`
  - `GitHubConnectorConfig`
  - `githubConnectorManifest`
  - `getGitHubConnectorHealth`
  - `mapGitHubPullRequestToWorkItem`
  - `mapGitHubIssueToWorkItem`
- Tests:
  - `src/lib/connectors/linear.test.ts`
  - `src/lib/connectors/github.test.ts`
  - `src/lib/connectors/config.test.ts`
  - `src/lib/connectors/registry.test.ts`

Wichtige Designentscheidungen:

- UI und App sollen nicht mit rohen Linear-/GitHub-API-Objekten arbeiten.
- Connectoren normalisieren externe Daten frueh in `WorkItem`.
- Health-Checks duerfen Fehler nicht als leere Liste verstecken.
- Echte API-Secrets werden nicht in Tests oder Dokumentation abgelegt.
- Fetch wird injizierbar gehalten, damit Connectoren sauber testbar bleiben.

## Kritische Hinweise

- Das GitHub-Remote zeigt bereits auf `https://github.com/Jokerbitt/forgepilot`.
- Der Branch ist `feature/M0-foundation`.
- `tsconfig.tsbuildinfo` ist aktuell im Git-Index getrackt und wurde durch TypeScript/Build veraendert. Das sollte vor dem ersten PR bewusst bereinigt werden, idealerweise aus dem Git-Index entfernen und in `.gitignore` belassen.
- Linear-Projekt/Tickets fuer ForgePilot muessen noch operativ angelegt oder bestaetigt werden.
- Noch kein Push/PR durch Codex, weil oeffentliches Pushen vorher Freigabe braucht.

## Empfohlener naechster Schritt

M1 fortsetzen mit:

1. kleines Command-Center Health Widget
2. echte Linear/GitHub Fetch-Funktionen fuer WorkItems
3. Status-/Prioritaets-Mapping ueber Konfiguration verfeinern
4. Connector-Onboarding UI entwerfen
5. Rate-Limit-/Permission-Fehler sichtbarer machen
6. danach Next Best Action Engine an echte WorkItems anschliessen

M1 bleibt erfolgreich, wenn es zuerst stabile Connectoren und sichtbare Health-Zustaende liefert. Noch keine Agenten-Autonomie starten, bevor Task Contract, Approval und Trace im UI greifbar sind.
