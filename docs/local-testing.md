# Lokaler Volltest

Testet den kompletten ForgePilot-Flow ohne laufenden Dev-Server — ruft lib-Funktionen direkt auf.

## Schnellstart

```bash
# Auto-Erkennung: besten verfügbaren LLM nehmen
npm run test:flow

# Mit Ollama (kostenlos, lokal — empfohlen):
ollama pull llama3.2
npm run test:flow:ollama

# Mit Anthropic API:
ANTHROPIC_API_KEY=sk-... npm run test:flow

# Nur Konnektivität testen (kein Schreiben):
npm run test:flow:dry
```

## Alle Optionen

```bash
npm run test:flow                              # auto mode
npm run test:flow:verbose                      # mit detailliertem Output
npm run test:flow:ollama                       # Ollama + verbose
npm run test:flow:dry                          # dry-run

# CLI-Flags direkt:
npx tsx scripts/test-flow.ts --provider=anthropic
npx tsx scripts/test-flow.ts --dry-run --verbose
npx tsx scripts/test-flow.ts --no-cleanup      # Testdaten nicht löschen
```

## Getesteter Flow

| Schritt | Was wird getestet |
|---------|-------------------|
| 0 | Provider Detection (Anthropic / Ollama / LM Studio) |
| 1 | Brief erstellen (Datei-Persistenz) |
| 2 | KI-Generierung via echtem LLM |
| 3 | Delegation erstellen |
| 4 | Delegation auf `completed` setzen |
| 5 | Knowledge Writeback → `config/knowledge-cards.json` |

Testdaten (Brief + Delegation) werden nach dem Lauf automatisch gelöscht.
