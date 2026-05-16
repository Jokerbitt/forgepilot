---
tags: [forgepilot, antigravity, handoff, coordination, ssot]
erstellt: 2026-05-16
autor: Codex
status: aktuell
---

# Antigravity Handoff - ForgePilot Stand 2026-05-16

## Bitte zuerst lesen

Antigravity soll vor weiterer Arbeit diese NAS-SSOT-Dateien lesen:

1. `Z:\NAS\Codex\KI Betriebssystem\FORGEPILOT-AKTUELLER-STAND.md`
2. `Z:\NAS\Codex\KI Betriebssystem\FORGEPILOT-WEBSITE-REVIVE-2026-05-16.md`
3. `Z:\NAS\Codex\KI Betriebssystem\FORGEPILOT-APPROVAL-AUTOPILOT-2026-05-16.md`
4. `Z:\NAS\Codex\KI Betriebssystem\CLAUDE-CODE-CODEX-GUIDELINES.md`
5. `Z:\NAS\Codex\KI Betriebssystem\ANTIGRAVITY-ONBOARDING.md`

Der NAS-Ordner bleibt die zentrale Projektwahrheit. Chat-Verlauf und lokale Repo-Docs sind nur Arbeitskopien.

## Was seit M4.9 passiert ist

### Website-Revive

Codex hat die ForgePilot-App nach den letzten Änderungen wieder stabilisiert.

- TypeScript grün
- Lint grün
- Tests grün
- Production Build grün
- Dashboard, Delegation Center und Settings über HTTP 200 geprüft
- Lokale Demo-Daten wiederbelebt

Wichtig: Die Demo-Daten bitte nicht löschen. Sie sind aktuell die stabile Testbasis für UI, NBA Engine, Delegation Center und Expert Mode.

Relevante Dateien:

- `config/local-items.json`
- `config/delegations.json`
- `config/nba-settings.json`
- `Z:\NAS\Codex\KI Betriebssystem\05_Testdaten\local-items.demo.json`
- `Z:\NAS\Codex\KI Betriebssystem\05_Testdaten\delegations.demo.json`
- `Z:\NAS\Codex\KI Betriebssystem\05_Testdaten\nba-settings.demo.json`

### Neue lokale WorkItem-Quelle

`local` ist jetzt eine offizielle `WorkItemSource`.

Dadurch kann ForgePilot offline und ohne Linear/GitHub-Daten getestet werden:

- `/api/work-items?source=local`
- `/api/work-items?source=all`
- `/api/recommendations`

### Approval & Autopilot

Es gibt jetzt einen ersten Mechanismus, damit Sven nicht alles händisch bestätigen muss.

Modi:

- `manual`: Jede Delegation braucht Freigabe.
- `balanced`: Standard. RiskClass A läuft ohne Extra-Klick, RiskClass B/C brauchen Freigabe.
- `autopilot`: Score-basierte automatische Freigabe.

Technische Dateien:

- `src/lib/nba-engine/approval-policy.ts`
- `src/lib/nba-engine/approval-policy.test.ts`
- `src/lib/nba-engine/nba-config.ts`
- `config/nba-settings.json`
- `src/app/settings/page.tsx`
- `src/components/command-center/NBACard.tsx`
- `src/components/delegation/DelegationModal.tsx`
- `src/app/api/magic-create/route.ts`

Aktuelle Default-Konfiguration:

```json
{
  "approvalMode": "balanced",
  "autopilotMinScore": 85,
  "autopilotMaxRiskClass": "A"
}
```

Sicherheitsregel:

Class C soll weiter bewusst geschützt bleiben. Bei Produktion, Secrets, Löschen, Deployment und externen Kosten muss ein Approval Gate greifen.

## Aktueller Verifikationsstand

Zuletzt geprüft:

- `npm run type-check`: grün
- `npm run lint`: grün
- `npm run test:run`: 58/58 Tests grün
- `npm run build`: grün
- `/`: HTTP 200
- `/delegations`: HTTP 200
- `/settings`: HTTP 200
- `/api/settings`: HTTP 200
- `/api/recommendations`: HTTP 200

Hinweis: Wenn der Dev-Server nach einem Production Build alte `.next` Chunks sucht, alten Dev-Server stoppen, `.next` löschen und `npm run dev` neu starten. Das ist ein Next-Dev-Cache-Thema, kein fachlicher App-Fehler.

## Nächster sinnvoller Arbeitsauftrag für Antigravity

Bitte als nächsten kleinen, klaren Schritt umsetzen:

### Approval Visibility Badges

Ziel: Jede Delegation und jede NBA-Karte soll sichtbar machen, ob sie automatisch laufen darf oder Freigabe braucht.

Badges:

- `Auto-freigegeben`
- `Freigabe nötig`
- `Blockiert durch RiskClass`

Wo:

- NBA Card Delegation Panel
- Delegation Center Tabelle
- Delegation Drawer / Detailbereich

Akzeptanzkriterien:

- Kein neues Verhalten ohne sichtbare Erklärung.
- RiskClass C wird klar als nicht-autonom markiert.
- `requiresApproval` wird in der UI verständlich angezeigt.
- Tests bleiben grün.
- Kein `any`.

## Bitte vermeiden

- Demo-Daten löschen oder durch leere Dateien ersetzen.
- `approvalMode` auf `autopilot` als Default setzen.
- Class C automatisch laufen lassen.
- Parallel große Refactors im Delegation Flow machen.
- NAS-SSOT vergessen.

## Übergabetext für Antigravity

Antigravity: Bitte arbeite ab jetzt auf Basis des NAS-SSOT weiter. Codex hat ForgePilot stabilisiert, lokale Demo-Daten eingerichtet und einen ersten Approval-/Autopilot-Modus eingebaut. Der nächste sinnvolle Schritt ist nicht mehr ein neues großes Feature, sondern Transparenz: Zeige im UI klar an, wann eine Delegation auto-freigegeben ist, wann Freigabe nötig ist und wann RiskClass die Autonomie blockiert. Danach bitte TypeScript, Lint, Tests und Build ausführen und den Stand im NAS-SSOT dokumentieren.

