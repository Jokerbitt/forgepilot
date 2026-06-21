# 5 · Praxis-Beispiel: Eine App entwickeln (Schritt für Schritt)

[← Geführte Journey](04-gefuehrte-journey.md) · [Weiter: Reverse-Engineering-Beispiel →](06-beispiel-reverse-engineering.md)

---

In diesem Beispiel bauen wir eine **kleine Kundenverwaltung (CRM)** — von der Idee bis zur laufenden, getesteten App. Du brauchst keine Programmierkenntnisse. Voraussetzung: ein KI-Provider ist in `/settings` eingerichtet (siehe [Erste Schritte](02-erste-schritte.md)).

> Du kannst denselben Ablauf für jede Idee nutzen. Statt frei zu starten, kannst du in `/suggestions` auch eine der 6 **Vorlagen** anklicken (CRM, Buchungstool, Shop, Blog, Aufgaben-Board, Bestandsverwaltung).

---

## Schritt 1 — Idee eingeben

Öffne **`/studio`** (Idea Studio). Im ersten Schritt das Feld ausfüllen:

> *„Eine App, mit der mein Team Kunden, Firmen und Notizen verwaltet und sieht, welche Aufgaben offen sind."*

Klick **„Weiter →"**.

## Schritt 2 — Konzept schärfen (Human-in-the-Loop)

ForgePilot schlägt ein **Ziel** und einen **App-Namen** vor — beide kannst du anpassen.

1. Klick **„Blueprint erstellen"**. Es erscheinen:
   - **Empfehlungen** (grün) — z.B. „Mit Kontakten + Firmen starten, Aufgaben später."
   - **Zu beachten** (orange) — z.B. „DSGVO: personenbezogene Daten."
2. Optional ins Feedback-Feld schreiben („Bitte auch eine einfache Suche.") → **„Konzept anpassen ↻"**.
3. Optional **„🔍 Kritiker drüberschauen lassen"** — ein zweites KI-Modell prüft kritisch (Pro / Contra / Beachten).
4. Klick **„Funktionen vorschlagen →"**.

## Schritt 3 — Funktionen wählen

Du siehst eine Liste vorgeschlagener Funktionen, alle angehakt. **Hake ab, was du nicht brauchst** — z.B. nur:

- ☑ Kontakte verwalten (Name, E-Mail, Firma)
- ☑ Firmen verwalten
- ☑ Notizen je Kontakt
- ☐ ~~Aufgaben mit Fälligkeit~~ *(später)*

Eigene Wünsche kannst du unter **„Sonstiges"** ergänzen. Dann **„Weiter zum Bauen →"**.

## Schritt 4 — (optional) Was kostet das?

Wenn du über `/suggestions` arbeitest, erscheint vor dem Bauen **„💶 Was kostet das? (lokal/Cloud schätzen)"**. ForgePilot schätzt pro Schritt, ob er **lokal (kostenlos, Ollama)** oder über **Cloud** läuft, und nennt eine grobe Gesamtsumme. Einfache Schritte laufen lokal, anspruchsvolle in der Cloud.

## Schritt 5 — Bauen starten

Im Studio: **„🚀 App autonom bauen"** (über `/suggestions`: **„Planen & bauen (N)"**).

Es erscheint die Bestätigung:

> *„✅ 3 Schritt(e) geplant — werden jetzt nacheinander gebaut & validiert. Jede Phase muss grün bauen + Tests bestehen, bevor die nächste startet."*

### Was jetzt im Hintergrund passiert

```
„Planen & bauen"
   │  POST /api/suggestions/build
   ▼
Plan erstellen  (suggestionsToPlan → config/delegation-plans.json)
   │  Phasen z.B.: 1) Datenmodell + Setup  2) Kontakte/Firmen-UI  3) Notizen + Suche
   ▼
POST /api/delegations/plan/[id]/execute
   │  pro Phase eine Delegation; chainNextId verkettet sie; Phase 1 startet sofort
   ▼
Phase 1  → KI-Agent baut → npm run build ✅ → npm run test:run ✅   (Build-Gate + Test-Gate)
   │                                              └─ rot? → Kette stoppt, kein Folgefehler
   ▼
Phase 2  (baut im selben Workspace auf Phase 1 auf) → Gates ✅
   ▼
Phase 3  → Gates ✅ → Ergebnis wird in den Ziel-Repo geschrieben (Writeback)
```

Wichtig: Die **Gates** sorgen dafür, dass eine kaputte Phase die nächste **nicht** startet. So entstehen keine Folgefehler. (Siehe [Konzepte → Phase-Gate](07-konzepte-glossar.md).)

## Schritt 6 — Build live verfolgen

Klick **„Fortschritt ansehen →"** (führt zu **`/delegations`**) oder bleib auf der Seite — der **Build-Fortschritt** zeigt „Schritt 2 von 3 läuft …". In `/delegations` kannst du jede Phase öffnen (`/delegations/[id]`), Live-Logs lesen und bei Bedarf eingreifen.

## Schritt 7 — Prüfen (geführte Journey)

Nach dem Build erscheint **„App ausprobieren & weiter verbessern"**. Nutze:

- **„🔍 Qualitäts-Report"** — wurde gründlich geprüft?
- **„💶 Kosten-Rückblick"** — war es teurer als gedacht? (z.B. *„günstiger als gedacht — 0,65 € statt 0,92 €"*).
- **„🔬 Funktionsbeweis"** — App-URL eintragen, **„Funktion prüfen"** → antwortet die App wirklich?

## Schritt 8 — Live schalten

**„🚀 App live schalten"** (oder Seite **`/deploy`**): Repo-Pfad → **„Lokal starten"** → **„Live schalten"**. Du bekommst eine **URL**. Mit dem **📡 Betriebs-Monitor** (Journey) kannst du sie laufend auf Erreichbarkeit + Antwortzeit prüfen.

## Schritt 9 — Weiterentwickeln

Die App ist nie „eingefroren". In **„App ausprobieren & weiter verbessern"**:

- **Bausteine per Klick:** z.B. **„🔑 Login & Registrierung"** hinzufügen.
- **In eigenen Worten ändern:** „Die Notiz-Liste soll nach Datum sortiert sein." → **„Änderung umsetzen"**.
- **Echte Daten:** bestehende Kundenliste als CSV über **„Importieren & einbauen"**.
- **Sicher iterieren:** vor einem Umbau **„📸 Snapshot"**, zur Not **„↩ Zurück"**.
- **Fürs Handy:** **„Als App fürs Handy einrichten"** (PWA).

Jede Änderung läuft wieder durch dieselbe Plan → Phasen → Gates-Mechanik. So wächst die App kontrolliert.

---

### Zusammengefasst

| Schritt | Aktion | Seite |
|---|---|---|
| 1 | Idee beschreiben | `/studio` |
| 2 | Blueprint + Kritiker | `/studio` |
| 3 | Funktionen wählen | `/studio` |
| 4 | Kosten schätzen *(optional)* | `/suggestions` |
| 5 | „App autonom bauen" | `/studio` |
| 6 | Build verfolgen | `/delegations` |
| 7 | Qualität/Kosten/Funktion prüfen | Journey |
| 8 | Live schalten | `/deploy` |
| 9 | Weiterentwickeln | Journey |

---

[← Geführte Journey](04-gefuehrte-journey.md) · [Weiter: Reverse-Engineering-Beispiel →](06-beispiel-reverse-engineering.md)
