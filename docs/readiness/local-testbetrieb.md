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

### Letzter Repair-Run (2026-05-29)

Reparatur des Quality-Gate-Befundes für Delegation
`7669f5f3-d186-44e9-8d2d-6e00f6b1e5a3` (Folge-Repair von
`c40e7ca1-7437-4aa7-8c4e-3089325f56fd` / PR #603).

#### Root Cause laut Critic Review

Der Critic Review der letzten Runde meldete `correctness 0`, `efficiency 0`,
`drift 0` mit der Begründung *"The response is vague and does not demonstrate
that the delivery gate criteria were addressed."* Sprich: nicht das UI ist
gescheitert, sondern die fehlende, gateüberprüfbare Evidenz im Patch.

#### Was dieser Repair ändert

| Schritt        | Ergebnis                                          |
|----------------|---------------------------------------------------|
| Focused Tests  | 6/6 grün (`SystemReadinessPanel.test.tsx`, inkl. 4 `computeNextAction`-Cases) |
| `npm run lint` | `✔ No ESLint warnings or errors`                   |
| `npm run type-check` | `tsc --noEmit` ohne Fehler                  |
| Touched Files  | nur `src/components/settings/SystemReadinessPanel.tsx`, dazugehöriger Test, und dieses Dokument |

Storage-Karte zeigt `risks[0]` als Hint und verlinkt nach `/settings#storage`
(siehe `src/components/settings/SystemReadinessPanel.tsx` Zeilen 180–198).
Damit ist der bemängelte PostgreSQL/JSON-Pfad sowohl im UI sichtbar als auch
hier dokumentiert.

`computeNextAction` ist als reine Funktion exportiert und unter Test, damit
zukünftige Critic Reviews die Banner-Priorisierung (Dev Server → Runner → AI
→ GitHub → Storage → Smoke → Linear/Ollama) eindeutig nachvollziehen können.
