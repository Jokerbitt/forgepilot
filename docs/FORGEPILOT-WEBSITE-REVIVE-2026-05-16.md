---
tags: [forgepilot, status, reparatur, testdaten, ssot]
erstellt: 2026-05-16
autor: Codex
status: aktuell
---

# ForgePilot Website Revive - 2026-05-16

## Kurzfassung

Die lokale ForgePilot-Webseite wurde nach den letzten Claude-Code-Aenderungen wieder stabilisiert. Build, TypeScript, Lint und Tests laufen wieder gruen. Fuer lokale Funktionspruefungen wurden belastbare Demo-Daten fuer WorkItems, Empfehlungen und Delegationen hinterlegt.

## Was repariert wurde

- Lokale WorkItems sind jetzt ein offizieller `WorkItemSource` (`local`) und werden ueber `/api/work-items?source=local` sowie `/api/work-items?source=all` ausgeliefert.
- `/api/recommendations` nutzt jetzt auch lokale Demo-WorkItems, damit das Dashboard ohne externe Linear/GitHub-Daten sinnvoll testbar bleibt.
- `/api/magic-create` erzeugt deterministische Schaetzwerte fuer Aufwand, Risiko und Kosten statt zufaelliger Demo-Werte.
- NBA-Settings werden mit Default-Werten gemerged, damit unvollstaendige Config-Dateien die App nicht mehr ausbremsen.
- `as any`-Casts im Expert-/Delegation-Flow wurden entfernt und durch typisierte Auswahl-Helfer ersetzt.
- Lint-Warnungen in `ManualTicketModal`, `MagicConfirmModal` und `NBACard` wurden beseitigt.
- Demo-Delegationen zeigen jetzt laufende, pending, abgeschlossene und blockierte/gescheiterte Agenten-Zustaende.

## Testdaten

Neue bzw. erneuerte Testdaten liegen in:

- `config/local-items.json`
- `config/delegations.json`
- `config/nba-settings.json`

Enthalten sind unter anderem:

- `LOCAL-1001`: Expert Mode Modell- und Provider-Auswahl testen
- `LOCAL-1002`: Task Detail Drawer mit Tabs vorbereiten
- `LOCAL-1003`: NAS-SSOT Writeback Assistant konzipieren
- `LOCAL-1004`: Production Secrets Rotation pruefen, RiskClass C, nicht autonom delegierbar
- `LOCAL-1005`: Obsidian Knowledge Writeback Demo, blockiert durch `LOCAL-1003`

## Verifikation

Ausgefuehrt am 2026-05-16:

- `npm run type-check` - erfolgreich
- `npm run lint` - erfolgreich, keine Warnungen
- `npm run test:run` - erfolgreich, 55/55 Tests gruen
- `npm run build` - erfolgreich
- `GET /` - HTTP 200 bei lokal gestartetem Dev-Server
- `GET /api/work-items?source=local` - HTTP 200
- `GET /api/delegations` - HTTP 200

## Hinweis fuer Claude Code

Vor weiterer Arbeit bitte die lokalen Demo-Daten nicht loeschen. Sie sind aktuell bewusst als stabile Testbasis angelegt, damit Dashboard, NBA-Empfehlungen, Delegation Center und Expert Mode ohne externe API-Abhaengigkeit getestet werden koennen.

Naechster sinnvoller Schritt:

1. UI im Browser manuell durchklicken.
2. Expert Mode Flow mit `LOCAL-1001` pruefen.
3. Delegation Center mit den vier Demo-Delegationen pruefen.
4. Danach erst echte Linear/GitHub-Daten wieder als Connector-Layer dazumischen.

