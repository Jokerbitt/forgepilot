# 3 · Seiten-Referenz

[← Erste Schritte](02-erste-schritte.md) · [Weiter: Geführte Journey →](04-gefuehrte-journey.md)

---

Jede Seite mit Zweck, was angezeigt wird und wie du sie bedienst. Gegliedert nach den Navigations-Ebenen aus der Seitenleiste. Alle Button-Beschriftungen sind die echten deutschen Labels aus der App.

## 🟣 Workspace (täglicher Ablauf)

### `/` — Command Center
**Zweck:** Startseite & Tagessteuerung. Schneller Einstieg für neue Ideen + Status-Überblick.
**Du siehst:** ganz oben eine **Connector-Health-Leiste** (grüne/rote Punkte je Verbindung), ein großes **Ideen-Eingabefeld**, eine 3-Schritte-Erklärung („Idee beschreiben → Plan bestätigen → Agenten arbeiten lassen"), rechts Panels für Autopilot-Status und Daily Assistant, unten Aktivitäts-Statistik und Schnell-Links.
**So bedienst du es:** Idee ins Textfeld (z.B. „Baue eine kleine ToDo-Planner-WebApp") → **„Plan Mode starten"**. Über die Schnell-Links springst du zu Plan Mode, Projekten, Live-View, Vorschau oder Settings.

### `/studio` — Idea Studio
**Zweck:** Geführter 4-Schritt-Assistent (Idee → Konzept → Bauen → Fertig) — der empfohlene Einstieg für Nicht-Techniker.
**Ablauf in 4 Schritten:**
1. **Idee** — in eigenen Worten beschreiben → **„Weiter →"**.
2. **Konzept** — Ziel und App-Name anpassen; **„Blueprint erstellen"**; danach erscheinen **Empfehlungen** (grün) und **Zu beachten** (orange). Optional im Feedback-Feld anpassen → **„Konzept anpassen ↻"** oder **„🔍 Kritiker drüberschauen lassen"** (ein zweites KI-Modell prüft kritisch). Dann **„Funktionen vorschlagen →"** und unerwünschte Funktionen per Checkbox abwählen.
3. **Bauen** — Zusammenfassung prüfen → **„🚀 App autonom bauen"**.
4. **Fertig** — Bestätigung + **„Fortschritt ansehen →"** (führt zu `/delegations`).

### `/morning` — Briefing
**Zweck:** Tages-Briefing / „Daily Assistant" — was heute relevant ist, was Aufmerksamkeit braucht, empfohlene nächste Schritte.

### `/idea` — Idea → Production (Plan Mode)
**Zweck:** Macht den Weg Idee → Brief → Work-Items → Orchestrierung sichtbar und editierbar, bevor gestartet wird.
**Du siehst:** Auswahl **Arbeitsweise** („Automatisch" / „Experte"). Im Experten-Modus klappst du **Produktform** (Webapp/Desktop/Mobile/Cross-Platform) und **Datenhaltung** (PostgreSQL/SQLite/JSON/Supabase/keine) auf. Großes Ideen-Textfeld (Start mit ⌘+Enter), Beispiel-Buttons, und eine Liste zuletzt eingereichter Ideen.
**So bedienst du es:** Idee eingeben → **„Plan erstellen"**. Es läuft sichtbar: Idee analysieren → Brief → Work-Items → Orchestrieren. Am Ende Empfehlungen + Links („Projekt öffnen", „Brief ansehen", „Live verfolgen").

### `/delegations` — Execute (Delegation Center)
**Zweck:** Die Warteschlange aller Aufträge — freigeben, starten, überwachen, wiederholen. → ausführlich auch im [Konzept-Glossar](07-konzepte-glossar.md).
**Du siehst:** Status-Zusammenfassung, Buttons **„+ Neue Delegation"**, **„✔ Alle freigeben"**, **„Export"** (CSV/JSON), Kosten-Übersicht, Filter (Status, Freigabe, „Heute", „Nur aktive", Gruppierung, Suche), und die Liste der Delegationen.
**Pro Eintrag:** Status-Badge, Titel, Alter, Budget und je nach Status **„✔ Freigeben"**, **„▶ Start"**, **„■ Stopp"** oder **„↺ Retry"**.
**So bedienst du es:** nach Status filtern → bei `pending` **„✔ Freigeben"** → **„▶ Start"**. Laufende zeigen einen Timer; fehlgeschlagene bieten **„↺ Retry"**.

### `/delegations/[id]` — Delegation-Detail
**Zweck:** Das Kontroll-Center eines einzelnen Auftrags.
**Du siehst:** Kontext (Titel, Ziel, **Risk-Class**, Freigabe-Status), Phasen-Anzeige, betroffene Dateien, Metriken (Status/Kosten/PR), und je nach Status Live-Logs, Preflight-Checks, Quality-Check, PR-Verwaltung, Knowledge-Writeback (Memory Cards). Zusatz-Aktionen: **„⚙ Orchestrieren"** (in Sub-Tasks zerlegen), **„⧉ Klonen"**, **„⬇ Logs"**, **„🔗 Link"**.
**So bedienst du es:** `pending` → **„✔ Freigeben"**; `approved` → Preflight prüfen, **„▶ Starten"**; `running` → Live-Logs, ggf. **„■ Abbrechen"**; `completed` → Preview öffnen, Quality-Check, PR ansehen/mergen.

### `/settings` — Engine-Einstellungen
**Zweck:** Zentrale Konfiguration. Abschnitte: Betriebsbereitschaft, Claude-CLI-Auth, KI-Anbieter-Status, **API-Keys**, **Lokale KI** (Ollama/LM Studio), **LLM-Modus**, Critic-Routing, Monitoring (Sentry), **Wissen & NAS-Indexer**, Anzeige-Limits, **Freigabe & Autopilot** (manual/balanced/autopilot), Backup/Export.
**So bedienst du es:** Keys eintragen → **„API Keys speichern"**; lokale KI → **„Lokale KI URLs speichern"**; Freigabe-Modus wählen. Jeder Speichern-Button wirkt sofort; Status-Pillen zeigen den Erfolg.

## 🔧 Tools (sekundär, immer sichtbar)

### `/live` — Live-View
Echtzeit-Übersicht laufender Agenten (KPIs, Run-Karten, Live-Logs via SSE-Stream).

### `/projects` — Plan / Projekte
Projekt-/Brief-zentrierte Sicht: Projekte, Meilensteine, zugehörige Arbeitspakete.

### `/delegations/plan` — Plan Mode
Plan zuerst sehen und anpassen, bevor er als Delegations-Kette ausgeführt wird (Phasen, Abhängigkeiten, Schätzungen).

### `/suggestions` — Suggestions
**Zweck:** Vorschläge generieren und bauen — Kernseite für Ablauf **A** (neue App) und „bestehende App verbessern".
- **Modus „Neue Idee":** Ziel + optional Kontext + optional Ziel-Repo → **„Vorschläge generieren"**, oder mit einer der 6 **Vorlagen** starten (CRM, Buchungstool, Online-Shop, Blog/CMS, Aufgaben-Board, Bestandsverwaltung).
- **Modus „Bestehende App verbessern":** Repo-Pfad + optional Fokus → **„App analysieren & Vorschläge"**.
- **Danach:** Vorschläge per Checkbox auswählen, optional eigenen Schritt unter „Sonstiges" ergänzen, optional **„💶 Was kostet das?"**, dann **„Planen & bauen (N)"**. Nach dem Build erscheinen Build-Fortschritt, Qualitäts-Report, Kosten-Rückblick und die [geführte Journey](04-gefuehrte-journey.md).

### `/concept` — Concept Analyzer
**Zweck:** PDF, Text oder Bild hochladen → KI plant Meilensteine, Tasks und Schätzungen.
**So bedienst du es:** Datei in die Dropzone ziehen (PDF/TXT/MD/PNG/JPG/WEBP, max. 10 MB) **oder** Text einfügen → **„Jetzt analysieren"**. Ergebnis: Projektname, Meilensteine, Tasks, geschätzte Dauer, empfohlener Stack, MVP-Schnitt, Risiken/Empfehlungen → **„In Plan Mode öffnen →"**.

### `/deploy` — App live schalten
**Zweck:** Gebaute App mit einem Klick deployen.
**So bedienst du es:** Repo-Pfad eingeben → Provider wählen: **„Lokal starten"** (kein Account), **„Vercel (öffentlich)"** (Login nötig, optional „Production-Deploy") oder **„Docker"** (Docker muss laufen) → **„Live schalten"**. Ergebnis: **„✅ Live!"** mit einer URL zum Öffnen.

### `/reverse` — Reverse Engineering
**Zweck:** Bestehende App analysieren und plattformunabhängig nachbauen. → ausführlich im [RE-Beispiel](06-beispiel-reverse-engineering.md).
**So bedienst du es:** Repo-Pfad → **„Pfad analysieren"** oder **„📦 ZIP hochladen"** (max. 50 MB). Der Report zeigt Sprachen, Frameworks, Plattform, Datenbank, Sicherheitslücken, Tech-Schuld, Modernisierungs-Vorschläge — als **„📄 Report (.md)"** herunterladbar. Dann Nachbau konfigurieren (Ziel-Stack, DB-Migration, Checkboxen „Logik 1:1", „Plattformunabhängig", „Sicherheitslücken fixen", „Bugs beheben", „UI modernisieren") → **„Nachbau planen & starten"**.
**Wichtig:** Bei **kritischer** Software (Leitrechner/SCADA/PLC) erscheint ein rotes Banner und der Start ist gesperrt, bis du die Bestätigungs-Checkbox setzt → [Sicherheit & Guardrails](08-sicherheit-guardrails.md).

## 🛠 Weitere Seiten (über `/tools`-Hub erreichbar)

| Seite | Zweck |
|---|---|
| `/knowledge` · `/knowledge-cards` | Wissensspeicher: Memory Cards + Quellen, Volltext-Suche |
| `/knowledge/research` | KI-gestützte Recherche-Plattform (Credibility-Badges, Citations) |
| `/governance` | Governance-Hub: Deny-first-Policy-Regeln, Verdikte |
| `/model-router` | Provider-Übersicht + Routing-Regeln (lokal/Cloud) |
| `/analytics` | Kosten-Analytics: Token-KPIs, eingesparte Cloud-Kosten |
| `/agents` · `/agents/skills` · `/agents/scope` | Agent-Control-Plane: Profile, Skills, Performance, Orchestrierung |
| `/orchestrations` | Multi-Agent-Runs: Zerlegung großer Aufgaben in Sub-Tasks |
| `/board` | Multi-Agent-Kanban (Pending/Approved/Running/Done) |
| `/work-items` | Arbeitspakete aus Linear + GitHub + lokal, mit „→ Delegation" |
| `/inbox` · `/notifications` · `/digest` | Attention-Engine, Benachrichtigungen, 24-h-Digest |
| `/pm-agent` | PM-Agent-Dashboard (Brief → Meilensteine → Work-Items) |
| `/audit` | Audit-Log (Trace-Events) |
| `/pilot` | End-to-End-Pipeline-Trigger (5-Schritt-Pipeline) |
| `/agent-runs` · `/agent-runs/[id]` | Run-Historie + Trace pro Lauf |
| `/onboarding` · `/setup` | Geführte Ersteinrichtung |

> Hinweis: ForgePilot ist umfangreich (~60 Seiten). Für den Alltag genügen die **Workspace-** und **Tools-**Seiten oben; die restlichen sind Spezial-/Power-User-Ansichten.

---

[← Erste Schritte](02-erste-schritte.md) · [Weiter: Geführte Journey →](04-gefuehrte-journey.md)
