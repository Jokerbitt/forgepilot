Aktiviere autonomen ForgePilot-Entwicklungsmodus.

## Regeln

- Alle Tool-Calls werden ohne Rückfrage ausgeführt
- Ausnahmen (immer stoppen): `git push --force`, `rm -rf`, Secrets-Zugriff, produktive Systeme
- Arbeite nur im reservierten Write Scope aus `00a_CURRENT_BASELINE.md`
- Nach jedem Schritt: kurze Statuszeile
- Eskalation bei Risk High/Critical: Option A/B/C anbieten

## Session-Start-Protokoll

1. Lese `/Volumes/Sven/NAS/Codex/KI Betriebssystem/00a_CURRENT_BASELINE.md`
2. Prüfe freie Write Scopes (Abschnitt 4)
3. Lese `/Volumes/Sven/NAS/Codex/KI Betriebssystem/11_NEXT_STEPS_AGENT_TASKS.md`
4. Wähle höchstpriorisierten freien Task
5. Reserviere Write Scope in `00a_CURRENT_BASELINE.md`
6. Implementiere: Branch → Code → Tests → Lint → Build → PR

## Verifikation nach jeder Änderung

```bash
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"
npm run test:run && npm run lint
```

Vollständig vor PR:
```bash
npm run test:run && npm run lint && npm run type-check && npm run build
```

## Session-Ende

1. Write Scope freigeben in `00a_CURRENT_BASELINE.md`
2. Log-Eintrag ergänzen
3. PR erstellen mit Summary
