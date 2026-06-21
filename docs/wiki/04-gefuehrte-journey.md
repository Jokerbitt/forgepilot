# 4 · Die geführte Journey (nach dem Build)

[← Seiten-Referenz](03-seiten-referenz.md) · [Weiter: App-Beispiel →](05-beispiel-app-entwicklung.md)

---

Sobald eine App gebaut ist, erscheint in `/suggestions` (und `/reverse`) der Bereich **„App ausprobieren & weiter verbessern"** (Komponente `AppFeedback`). Er bündelt alle Bausteine, mit denen du die App ausprobierst, prüfst, erweiterst und absicherst — alles in Klartext, ohne Programmierkenntnisse.

Oben stehen zwei Knöpfe: **„🚀 App live schalten"** (führt zu `/deploy`) und **„💾 Backup (.zip)"** (lädt die App als Archiv herunter).

## Build verfolgen & prüfen

### 🔄 Build-Fortschritt (`BuildProgress`)
Zeigt live „Schritt X von Y läuft …" mit Fortschrittsbalken (indigo = läuft, grün = fertig, amber = Fehler). Pollt im Hintergrund den Status der Delegationen und zeigt Selbstheilung (Retries) sichtbar an.

### 🔍 Qualitäts-Report (`QualityReport`)
Knopf **„🔍 Qualitäts-Report"** → fasst in Klartext zusammen, wie gründlich geprüft wurde (Definition-of-Done-Verdikt der Delegationen): wie viele Schritte geprüft wurden und ob alles bestanden hat.

### 💶 Kosten-Rückblick (`CostReview`) · *Phase 4.2*
Knopf **„💶 Kosten-Rückblick"** → vergleicht die **tatsächlichen** Kosten gegen die **Vorab-Schätzung** und das Budget. Verdikt in Klartext: *günstiger / im Rahmen / teurer / kostenlos*, plus Budget-Status.
> Echtes Beispiel: *„✅ Die App war günstiger als gedacht — 0,65 € statt geschätzt 0,92 € (−29 %) · ✅ Im Budget: 0,65 € von 1,84 €."*

## Funktion & Betrieb prüfen

### 🔬 Funktionsbeweis (`FunctionProof`) · *Phase 4.1*
Felder für **URL** (z.B. `http://localhost:3001`) und **Seiten** (z.B. `/, /login`) → **„Funktion prüfen"**. Probt die laufende App und zeigt, ob sie wirklich antwortet — verwandelt „sollte gehen" in „nachweislich erreichbar".

### 📡 Betriebs-Monitor (`Monitoring`) · *Phase 4.3*
Felder **URL** + **Seiten** → **„Status prüfen"**. Prüft eine live geschaltete App auf Erreichbarkeit **und Antwortzeit** und liefert eine Ampel:
- 🟢 **stabil** — alle Seiten antworten schnell,
- 🟡 **eingeschränkt/langsam** — teilweise erreichbar oder hohe Latenz,
- 🔴 **offline** — nichts antwortet; wiederholte Ausfälle werden als „X Prüfungen in Folge" gemerkt.

### 📱 App fürs Handy / PWA (`PwaSetup`) · *Phase 4.4*
- **„PWA-Check"** → sagt, ob die App schon als Handy-App installierbar ist (Manifest + Service-Worker vorhanden?).
- **„Als App fürs Handy einrichten"** → richtet Manifest + Service-Worker automatisch ein (als Folge-Build), damit die App auf dem Home-Bildschirm landet und offline startet.

### 📱 Mobil-Check (`MobileCheck`)
Knopf **„prüfen"** → statische Heuristik, ob die App responsive (handytauglich) ist (Viewport, Breakpoints, keine festen Pixelbreiten). Bei niedrigem Score: **„Mobil-tauglich machen"** startet einen Fix.

## Erweitern & absichern

### ➕ Fertige Bausteine
Knöpfe **„🔑 Login & Registrierung"**, **„💳 Zahlungen"**, **„✉️ E-Mail-Versand"**, **„🔔 Benachrichtigungen"**, **„📎 Datei-Upload"**, **„🔎 Suche"** — fügen den jeweiligen Baustein per Klick zur App hinzu (als Folge-Build).

### 💬 In eigenen Worten ändern
Textfeld („Was möchtest du ändern? z.B. „Der Speichern-Button gehört nach oben"") → **„Änderung umsetzen"**. ForgePilot baut die Änderung gegen dasselbe Repo und zeigt den Fortschritt.

### 📥 Echte Daten importieren (`DataImport`)
Entity-Name + CSV/TSV einfügen oder **„📁 CSV-Datei"** hochladen → **„Vorschau"** (erkannte Spalten/Typen) → **„Importieren & einbauen"** (legt ein Datenmodell an und befüllt es). *Excel: vorher als CSV exportieren.*

### 🛡️ Wartung (`Maintenance`)
Knopf **„prüfen"** → Security-Scan + veraltete Abhängigkeiten. Aktionen: **„Sicherheitslücken beheben"** und **„Updates einspielen"**. Läuft auch wöchentlich automatisch (Cron).

### 📸 Snapshots & sicheres Zurück (`Snapshots`)
Bezeichnung eingeben → **„📸 Snapshot"** sichert den aktuellen Stand (als Git-Tag, nicht-destruktiv). Jeder Eintrag hat **„↩ Zurück"** — vor dem Zurückspulen wird der aktuelle Stand automatisch gesichert.

### 🧭 Was als Nächstes? (`NextSteps`)
Knopf **„vorschlagen"** → KI priorisiert sinnvolle nächste Schritte (🔴 hoch / 🟡 mittel / 🟠 niedrig) mit Hinweis, wie man sie umsetzt.

### 🔗 App teilen (`ShareLink`)
URL eintragen → **„Kopieren"**. Validiert, ob die Adresse öffentlich erreichbar ist (Warnung bei `localhost`).

---

[← Seiten-Referenz](03-seiten-referenz.md) · [Weiter: App-Beispiel →](05-beispiel-app-entwicklung.md)
