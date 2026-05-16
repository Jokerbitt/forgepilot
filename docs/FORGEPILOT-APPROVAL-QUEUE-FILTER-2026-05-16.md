---
tags: [forgepilot, approval, queue, delegation, ui]
erstellt: 2026-05-16
autor: Codex
status: aktuell
---

# ForgePilot Approval Queue Filter

## Ziel

Der Delegation Center soll nicht nur alle Delegationen anzeigen, sondern gezielt die Aufgaben hervorheben, bei denen Sven wirklich entscheiden muss. Dadurch wird der Autopilot nutzbar, ohne dass kritische Freigaben im allgemeinen Task-Strom untergehen.

## Umgesetzt

Im Delegation Center gibt es jetzt einen eigenen Freigabe-Filter:

- `Alle`
- `Freigabe noetig`
- `Auto-freigegeben`
- `RiskClass C`

Zusätzlich zeigt der Header die Anzahl freigabepflichtiger Delegationen direkt an.

## Schnelle Freigabe

Wartende Delegationen mit RiskClass A oder B koennen direkt in der Tabellenzeile freigegeben werden.

Dabei wird:

- der Status auf `approved` gesetzt,
- `requiresApproval` auf `false` gesetzt,
- ein Log-Eintrag `Manuell freigegeben.` geschrieben.

RiskClass C bekommt bewusst keinen Schnellfreigabe-Button. Diese Aufgaben bleiben fuer Review und Detailpruefung reserviert.

## Technische Datei

- `src/app/delegations/page.tsx`

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
- RiskClass C: 1

## Naechster sinnvoller Schritt

Als naechstes sollte der Freigabeprozess in den Drawer erweitert werden:

- Approval-Erklaerung mit Policy-Grund anzeigen
- RiskClass-C-Review-Checkliste
- Optional: Freigabe nur nach kurzem Review-Kommentar

