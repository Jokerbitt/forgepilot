# ForgePilot Production Assistant Roadmap

Ziel: ForgePilot soll sich wie ein taeglicher Entwicklungs-Assistent anfuehlen: Idee rein, Plan entsteht, sichere Delegationen laufen autonom, der Nutzer sieht jederzeit was passiert, und nur gepruefte Aenderungen gelangen Richtung Main.

## M4 - Production Assistant Control Center

**Ziel:** Ein ruhiges Cockpit zeigt Status, Blocker, naechste sichere Aktion, Runner und PR-Gate.

**Arbeitspakete**
- Live View auf einen primaeren naechsten Schritt ausrichten.
- Delivery Gate, Repair Queue, Runner Readiness und PR-Status sichtbar zusammenfassen.
- Expertentools hinter System-/Debug-Kontext halten, nicht im Alltagsfluss.
- Queue Hygiene so anzeigen, dass nur relevante Arbeit sichtbar bleibt.

**Akzeptanzkriterien**
- Der Nutzer sieht sofort, ob ForgePilot autonom weiterarbeiten darf.
- Blockierte Repairs und PR-Gates sind eindeutig markiert.
- Es gibt genau eine empfohlene naechste Aktion.
- Tests fuer Roadmap- und Queue-Logik sind gruen.

## M5 - Reliable Runner + Fallback Layer

**Ziel:** Echte Slices reproduzierbar von Plan bis PR ausfuehren, inklusive Claude/Codex/Ollama-Fallback.

**Arbeitspakete**
- Runner-Fehler klassifizieren: Auth, Rate Limit, Tooling, Validation, Git.
- Claude CLI, Codex CLI und lokale Runner als priorisierte Fallback-Kette abbilden.
- Fehlgeschlagene, wiederaufnehmbare Repairs automatisch erneut starten.
- Evidence Harness fuer echte App-Slices weiter ausbauen.

**Akzeptanzkriterien**
- Ein kleiner Slice erzeugt Code, Tests und PR.
- Auth-/Providerfehler stoppen nicht den gesamten Assistant, sondern wechseln kontrolliert den Runner.
- Logs zeigen, welcher Runner warum gewaehlt wurde.
- Fehlgeschlagene Runs erzeugen konkrete Reparatur-Delegationen.

## M6 - Live Agent Timeline

**Ziel:** Agentenarbeit wird als verstaendlicher Verlauf sichtbar: Ziel, Dateien, Tests, Fehler, PR.

**Arbeitspakete**
- Delegation Detail status-first gestalten.
- Agentenaktivitaeten chronologisch gruppieren: Planung, Ausfuehrung, Tests, PR, Critic, Writeback.
- Fehler in menschlicher Sprache erklaeren und Retry/Eskalation anbieten.
- Laufende und abgeschlossene Runs in Live View nachvollziehbar machen.

**Akzeptanzkriterien**
- Nutzer versteht ohne Logs, was gerade passiert.
- Statusabhaengige Ansicht zeigt nur die relevanten Informationen.
- PR, Tests, Critic Score und naechste Aktion sind sofort sichtbar.

## M7 - Zero-Key Runner Mode

**Ziel:** Claude Max/Claude Code und Codex CLI als bevorzugte Runner ohne API-Key nutzen; API-Keys bleiben optional.

**Arbeitspakete**
- Readiness-Checks fuer lokale OAuth-/CLI-Sessions haerten.
- Settings vereinfacht anzeigen: verbunden, fehlt, fehlerhaft, testen.
- Fallback-Reihenfolge konfigurierbar machen.
- API-Key-Provider hinter Expertenmodus halten.

**Akzeptanzkriterien**
- Testlauf funktioniert ohne API-Key, wenn Claude/Codex CLI eingeloggt ist.
- Nutzer sieht, welcher Runner bereit ist.
- Fehlende Auth wird klar und nicht technisch erklaert.

## M8 - Autonomy Gates + PR Control

**Ziel:** Autonom starten, PRs erstellen und nur sichere Aenderungen mit Gates abschliessen.

**Arbeitspakete**
- Risk-Class-Gates fuer Start, PR und Merge durchsetzen.
- Diff, Tests, Quality Check und Critic Score vor Merge bewerten.
- Auto-Merge nur fuer kleine, sichere Aenderungen erlauben.
- Branch-/PR-Uebersicht mit Review- und Merge-Entscheidung anbieten.

**Akzeptanzkriterien**
- Keine Risk-C-Aenderung wird ohne Freigabe gestartet oder gemerged.
- PRs enthalten nachvollziehbare Zusammenfassung und Evidence.
- Merge bleibt blockiert, wenn Tests, Critic oder Quality Gate scheitern.

## M9 - First Real App Builder Flow

**Ziel:** Aus einer Idee automatisch eine kleine echte App in Slices bauen.

**Arbeitspakete**
- Plan Mode fuer App-Typ, Plattform, Datenhaltung, MVP-Schnitt und erste Slices.
- Beginner Mode entscheidet sinnvolle Defaults automatisch.
- Expert Mode erlaubt Stack, Datenbank und Deployment selbst zu waehlen.
- Todo-Planner-Webapp als erster End-to-End-Testlauf.

**Akzeptanzkriterien**
- Idee -> Plan -> Delegationen -> Code -> PR funktioniert fuer eine kleine App.
- Nutzer muss nur an klaren Entscheidungspunkten eingreifen.
- Live View zeigt Fortschritt und naechsten Slice.

## M10 - Postgres Primary + Migration Health

**Ziel:** PostgreSQL ist Primaerspeicher, JSON bleibt nur Fallback mit klarer Migrations- und Backup-Gesundheit.

**Arbeitspakete**
- Delegationen, Runs, Quality Checks, Reports und Auditdaten in Postgres fuehren.
- JSON-Fallback sichtbar, aber nicht als Produktionsstandard.
- Migration Health im Daily Assistant bewerten.
- Backup-, Restore- und Rollback-Anleitung dokumentieren.

**Akzeptanzkriterien**
- Storage Mode ist fuer den Nutzer sichtbar.
- Backfill und Migration Health sind pruefbar.
- Produktivbetrieb hat Backup-/Restore-Pfad.

## M11 - Self-Optimizing Assistant

**Ziel:** ForgePilot lernt aus Runs, verbessert Agentenregeln und empfiehlt den naechsten kleinsten Schritt.

**Arbeitspakete**
- Knowledge Writeback auf brauchbare Erkenntnisse filtern.
- Agentenprofile nach Erfolgsrate, Kosten, Geschwindigkeit und Qualitaet bewerten.
- Kritiker-LLMs ueber Auto-Router einsetzen.
- Daily Report erzeugt konkrete Arbeitspakete fuer Codex, Claude, Grok und lokale Runner.

**Akzeptanzkriterien**
- Erfolgreiche Patterns werden wiederverwendet.
- Schlechte Runs erzeugen Reparatur- oder Prompt-Verbesserungen.
- Daily Assistant priorisiert Reparatur, naechsten Slice und Optimierung.

## Aktuelle Prioritaet

Der naechste sinnvolle Meilenstein ist **M4 - Production Assistant Control Center**. Ohne ein klares Kontrollzentrum fuehlt sich Autonomie unsicher und ueberladen an. Danach folgen Runner-Zuverlaessigkeit und PR-Gates, bevor groessere App-Generierung skaliert wird.
