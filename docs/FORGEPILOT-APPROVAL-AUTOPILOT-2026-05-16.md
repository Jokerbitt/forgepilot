---
tags: [forgepilot, autopilot, approval, delegation, safety]
erstellt: 2026-05-16
autor: Codex
status: aktuell
---

# ForgePilot Approval & Autopilot

## Ziel

ForgePilot soll nicht jede Kleinigkeit händisch bestätigen lassen. Der Nutzer soll delegieren können, ohne ständig im Weg zu stehen. Gleichzeitig dürfen riskante Aufgaben nicht unkontrolliert automatisch laufen.

## Eingebaute Modi

### Manuell

Jede Delegation braucht eine ausdrückliche Freigabe. Das ist maximal kontrolliert, aber im Alltag langsam.

### Ausgewogen

Standardmodus.

- RiskClass A läuft ohne zusätzliche Freigabe.
- RiskClass B und C brauchen weiterhin Freigabe.

Das ist der empfohlene Modus für den aktuellen Projektstand.

### Autopilot

Score-basierte automatische Freigabe.

- Aufgaben laufen automatisch, wenn der NBA-Score mindestens `autopilotMinScore` erreicht.
- Zusätzlich muss die RiskClass kleiner oder gleich `autopilotMaxRiskClass` sein.
- Standard: Mindestscore `85`, maximale RiskClass `A`.

## Technische Umsetzung

- Zentrale Policy: `src/lib/nba-engine/approval-policy.ts`
- Settings-Konfiguration: `config/nba-settings.json`
- UI: `/settings`, Abschnitt `Freigabe & Autopilot`
- Delegation-Flow: NBA Card, Delegation Modal und Magic Create nutzen die Policy.
- Tests: `src/lib/nba-engine/approval-policy.test.ts`

## Sicherheitsregel

Class C bleibt auch langfristig grundsätzlich freigabepflichtig, außer Sven setzt den Autopilot bewusst sehr offen. Für echte Produktion, Secrets, Löschoperationen, Deployments und externe Kosten sollte ForgePilot zusätzlich ein Approval Gate erzwingen.

## Verifikation

Stand 2026-05-16:

- `npm run type-check`: grün
- `npm run lint`: grün
- `npm run test:run`: 58/58 Tests grün
- `npm run build`: grün
- `/`: HTTP 200
- `/delegations`: HTTP 200
- `/settings`: HTTP 200
- `/api/settings`: HTTP 200 mit `approvalMode: balanced`
- `/api/recommendations`: HTTP 200

## Nächster sinnvoller Schritt

Der nächste Ausbau sollte ein sichtbares Badge direkt an jeder Delegation sein:

- `Freigabe nötig`
- `Auto-freigegeben`
- `Blockiert durch RiskClass`

Damit ist jederzeit nachvollziehbar, warum ForgePilot etwas automatisch startet oder bewusst stoppt.

