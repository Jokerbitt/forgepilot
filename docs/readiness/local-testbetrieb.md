# Lokale ForgePilot-Readiness für produktiven Testbetrieb

Diese Übersicht erklärt, welche Signale das **System Readiness Panel**
(`/settings`) anzeigt und wie du als Operator schnell den nächsten sicheren
Schritt erkennst.

## Anzeigequellen

| Karte        | Datenquelle                          | Wann grün?                                              |
|--------------|--------------------------------------|---------------------------------------------------------|
| Dev Server   | mind. eine API-Route antwortet (200) | Next.js läuft und mind. eine Route ist erreichbar       |
| Runner       | `GET /api/system/cli-status`         | `zeroKeyReady === true` (Claude CLI **oder** Codex CLI) |
| Storage      | `GET /api/storage-status`            | `mode === 'postgres' && postgresConfigured === true`    |
| GitHub       | `GET /api/connectors/health`         | Token gesetzt, Health `ok`                              |
| Linear       | `GET /api/connectors/health`         | Optional — `unconfigured` ist nur Warn                  |
| AI Provider  | `GET /api/ai/status`                 | `resolvedProvider.providerId !== 'placeholder'`         |
| Ollama       | `GET /api/ai/status`                 | `ollamaRunning === true` (optional)                     |
| Smoke Test   | `GET /api/smoke-test`                | `ok === true`                                           |

## Storage-Modi

| Modus     | Anzeige                                         | Risiko / Nächster Schritt                                  |
|-----------|-------------------------------------------------|------------------------------------------------------------|
| `json`    | "JSON-Dateien · nur Dev/Bootstrap" (warn)       | Race Conditions, keine Transaktionen → für Produktion auf  |
|           |                                                 | `STORAGE_MODE=postgres` wechseln                           |
| `dual`    | "Dual-Write · PG verbunden / PG fehlt"          | Wenn PG fehlt: still im JSON-Fallback → DATABASE_URL setzen|
| `postgres`| "PostgreSQL aktiv · production-ready" (ok)      | —                                                          |
| `postgres`| ohne DATABASE_URL/SUPABASE_URL (error)          | App schlägt fehl → ENV setzen oder Modus zurückstufen      |

Siehe auch `docs/postgres-cutover.md`.

## Runner-Modi

| Modus              | Bedeutung                                         |
|--------------------|---------------------------------------------------|
| `claude-cli`       | Claude Code CLI installiert + authentifiziert     |
| `codex-cli`        | Codex CLI installiert + authentifiziert           |
| `claude-api`       | Nur ANTHROPIC_API_KEY hinterlegt, keine CLI       |
| `openai-api`       | Nur OPENAI_API_KEY hinterlegt, keine CLI          |
| `simulation`       | Kein Runner verfügbar — nur Trockenlauf möglich   |

Empfohlen für produktiven Testbetrieb: **`claude-cli` oder `codex-cli`**, da
zero-key (kein Token-Leak-Risiko in Logs).

## Nächste sichere Aktion

Das Panel berechnet aus allen warn/error-Karten den **Nächste sichere Aktion**
Banner. Reihenfolge der Priorität:

1. Dev Server (ohne läuft nichts)
2. Runner (ohne kein Execute)
3. AI Provider
4. GitHub
5. Storage
6. Smoke Test
7. Linear / Ollama (optional)

Banner-Link führt direkt zur relevanten Settings-Sektion. Sind alle Karten
grün, wird kein Banner angezeigt.

## Anti-Drift bei Autonomie

Vage Tasks (Titel + Goal identisch, < 4 Wörter, keine Dateipfade) werden vom
Autonomie-Layer **vor** dem Execute auf konkrete Datei-Patterns getightent
oder zurückgewiesen. Siehe `## Allowed file patterns` im Execution-Brief.
Operator-Verantwortung: bei jedem produktiven Testbetrieb-Run sicherstellen,
dass `Allowed file patterns` gesetzt sind.

## Validierung

```bash
npm run test:run -- src/components/settings/SystemReadinessPanel.test.tsx
npm run test:run -- src/app/api/storage-status/route.test.ts
npm run test:run -- src/app/api/system/cli-status/route.test.ts
npm run type-check
npm run lint
```
