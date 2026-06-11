# Todo-App produktiver Testlauf

Stand: 2026-05-29

Dieser Testlauf belegt den ersten schmalen ForgePilot-App-Run: Idee -> Projektplan -> Delegationen -> PRs -> CI -> Merge -> nutzbare App.

## Was gebaut wurde

- Fokussierte Todo-Webapp unter `/todo`.
- Aufgaben mit Titel, Prioritaet und Status.
- Persistenz ueber `/api/todo`.
- PostgreSQL als primaerer Store, JSON-Fallback fuer lokale Stoerfaelle.
- Serverseitige Validierung fuer eingehende Aufgaben.
- Klare API-Fehlertexte fuer ungueltige Eingaben.

## Erfolgreiche PRs

- PR #609: Todo-Aufgaben dauerhaft speichern.
- PR #610: Todo-Persistenz gegen lokale DB-Ausfaelle haerten.
- PR #611: Todo-API und Validierung absichern.
- PR #612: API-Happy-Path-Test als explizite Evidence ergaenzen.

## Manueller Testpfad

1. App starten: `npm run dev -- --port 3026`.
2. Browser oeffnen: `http://localhost:3026/todo`.
3. Aufgabe mit Titel, Prioritaet und Status anlegen.
4. Seite neu laden.
5. Erwartung: Aufgabe bleibt sichtbar.
6. Status wechseln.
7. Seite neu laden.
8. Erwartung: Status bleibt erhalten.
9. Leeren Titel ueber API senden.
10. Erwartung: API liefert `400` mit verstaendlichem Fehlertext.

## API-Smoke-Test

```bash
curl -s -X PUT http://localhost:3026/api/todo \
  -H 'Content-Type: application/json' \
  -d '{"todos":[{"id":"manual-1","title":"Manueller Test","priority":"medium","status":"open","createdAt":"2026-05-29T19:58:00.000Z"}]}'

curl -s http://localhost:3026/api/todo
```

Validierungsfehler:

```bash
curl -s -X PUT http://localhost:3026/api/todo \
  -H 'Content-Type: application/json' \
  -d '{"todos":[{"id":"broken","title":"   ","priority":"high","status":"open","createdAt":"2026-05-29T19:58:00.000Z"}]}'
```

Erwartete Antwort:

```json
{"error":"Aufgabe 1: Titel darf nicht leer sein."}
```

## Automatisierte Evidenz

- `npm run test:run -- src/app/api/todo/route.test.ts src/__tests__/todo-store.test.ts src/lib/demo-runs/todo-webapp.test.ts`
- `npm run type-check`
- `npm run lint`
- `npm run build`

## Bekannte Grenzen

- Die Todo-App ist bewusst klein und dient als erster End-to-End-Beweis.
- Auth ist lokal fuer Pre-Launch-Tests deaktiviert und muss vor Launch wieder aktiv sein.
- Der naechste produktive Schritt ist ein gefuehrter App-Run aus ForgePilot heraus: Idee eingeben, Plan bestaetigen, Delegation starten, PR pruefen.

## Naechste sinnvolle Schritte

- Live View weiter vereinfachen: nur aktive Agenten, naechste Aktion und letzter PR.
- Approval Queue standardmaessig auf relevante Projekt-Slices filtern.
- Aus dem Todo-Run eine wiederverwendbare Vorlage fuer weitere Test-Apps ableiten.
