# JOK-189 — M4 V1 Acceptance Test Scorecard

**Ziel:** 5 echte Tickets durch den vollständigen ForgePilot Loop — mit ehrlicher Messung.

---

## Definition of Done für M4

Ein Run gilt als **bestanden** wenn:
- Brief wird automatisch generiert (kein manuelles Nacharbeiten)
- Delegation wird gestartet und läuft durch bis PR oder Fehler
- Critic Review wird ausgeführt
- Writeback enthält mindestens eine Knowledge Card

Ein Run gilt als **fehlgeschlagen** wenn:
- Manueller Eingriff > 5 Min nötig
- PR wird nicht erstellt
- Critic Review schlägt ohne Recovery fehl

---

## Scorecard Vorlage

Für jeden Run eine Zeile ausfüllen:

| # | Ticket-Titel | Provider | Zeit Brief | Zeit Exec | PR? | Critic? | Writeback? | Eingriffe | Score |
|---|---|---|---|---|---|---|---|---|---|
| 1 | | | | | | | | | |
| 2 | | | | | | | | | |
| 3 | | | | | | | | | |
| 4 | | | | | | | | | |
| 5 | | | | | | | | | |

**Spalten-Legende:**
- **Zeit Brief**: Minuten von Idea-Eingabe bis Brief generiert
- **Zeit Exec**: Minuten von Delegation-Start bis PR/Fehler
- **PR?**: ✅ PR erstellt / ❌ nicht erstellt / ⚠️ manuell
- **Critic?**: ✅ Review erfolgt / ❌ Fehler / – nicht anwendbar
- **Writeback?**: ✅ ≥1 Knowledge Card / ❌ keine / – nicht anwendbar
- **Eingriffe**: Anzahl manueller Eingriffe > 1 Min
- **Score**: A (alles automatisch) / B (1–2 kleine Eingriffe) / C (>2 Eingriffe oder PR fehlt)

---

## Empfohlene Ticket-Typen für den Test

Einen Mix aus verschiedenen Schwierigkeiten wählen:

1. **Einfaches Bugfix-Ticket** — z.B. "Fix: Typo in Delegation-Detail-Titel"
2. **Kleines Feature** — z.B. "Add: Loading Skeleton auf Projects-Page"
3. **API-Änderung** — z.B. "Extend: /api/delegations mit filter=urgent"
4. **Refactoring** — z.B. "Refactor: extracte StatusBadge-Komponente"
5. **Test-Ticket** — z.B. "Add: Tests für onboarding/status API Route"

---

## Auswertungs-Kriterien für M4 Done

| Metrik | Ziel |
|---|---|
| ≥4 von 5 Runs mit Score A oder B | ✅ M4 erfüllt |
| Ø Zeit Brief < 3 Min | ✅ Brief-Generation akzeptabel |
| Ø Zeit Exec < 15 Min | ✅ Execution performant |
| PR-Rate ≥ 80% (4/5 PRs) | ✅ Kernnutzen lieferbar |
| Critic-Rate ≥ 80% | ✅ Qualitätssicherung funktioniert |

---

## Ergebnisse eintragen

Ergebnisse als JSON in `config/execute-loop-evidence.json` via:

```bash
npm run evidence:record -- \
  --title "Fix: Typo in Delegation Detail" \
  --has-pr true \
  --has-critic true \
  --has-writeback true \
  --time-saved 15 \
  --interventions 0 \
  --pr-url "https://github.com/Jokerbitt/forgepilot/pull/123"
```

Alternativ direkter Script-Aufruf mit mehr Feldern:

```bash
npx tsx scripts/record-acceptance-run.ts \
  --title "Fix: Typo in Delegation Detail" \
  --has-pr true \
  --has-critic true \
  --has-writeback true \
  --time-saved 15 \
  --interventions 0
```

---

_Erstellt: 2026-05-24 — JOK-189 Milestone: M4 Reliable Daily Assistant V1_
