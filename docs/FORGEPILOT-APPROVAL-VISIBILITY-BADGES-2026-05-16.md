---
tags: [forgepilot, approval, ui, delegation, safety]
erstellt: 2026-05-16
autor: Codex
status: aktuell
---

# ForgePilot Approval Visibility Badges

## Ziel

ForgePilot soll nicht nur automatisch entscheiden, ob eine Delegation Freigabe braucht. Die App muss diese Entscheidung auch sichtbar machen, damit Sven und alle Agenten verstehen, warum etwas automatisch laufen darf oder bewusst blockiert bleibt.

## Umgesetzt

Neue gemeinsame UI-Komponente:

- `src/components/shared/ApprovalBadge.tsx`

Die Komponente zeigt drei Zustände:

- `Auto-freigegeben`
- `Freigabe noetig`
- `Blockiert durch RiskClass`

Eingebaut in:

- NBA Card
- Associated Tasks innerhalb der NBA Card
- Delegation Center Tabelle
- Delegation Drawer Header
- Delegation Drawer Details

## Wirkung

Im Standardmodus `balanced` ist jetzt direkt sichtbar:

- RiskClass A kann ohne zusaetzlichen Klick laufen.
- RiskClass B/C bleibt freigabepflichtig.
- RiskClass C wird als blockiert/kritisch markiert.

Damit ist der Autopilot nicht mehr eine unsichtbare Backend-Entscheidung, sondern eine nachvollziehbare UI-Information.

## Verifikation

Stand 2026-05-16:

- `npm run type-check`: gruen
- `npm run lint`: gruen
- `npm run test:run`: 58/58 Tests gruen
- `npm run build`: gruen
- `/`: HTTP 200
- `/delegations`: HTTP 200
- `/settings`: HTTP 200
- `/api/settings`: HTTP 200
- `/api/delegations`: HTTP 200

Aktueller Demo-Daten-Check:

- Approval Mode: `balanced`
- Delegationen gesamt: 5
- Auto-freigegeben: 2
- Freigabe noetig: 3

## Naechster sinnvoller Schritt

Als naechstes sollte ForgePilot einen kleinen `Approval Queue` Filter bekommen:

- Nur freigabepflichtige Delegationen anzeigen
- RiskClass-C-Tasks oben halten
- Ein-Klick-Freigabe fuer gepruefte Class-B-Aufgaben

