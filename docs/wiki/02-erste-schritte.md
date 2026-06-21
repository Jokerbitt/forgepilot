# 2 · Erste Schritte

[← Überblick](01-ueberblick.md) · [Weiter: Seiten-Referenz →](03-seiten-referenz.md)

---

## Voraussetzungen

- **Node.js** (Version siehe `package.json`) und **npm**.
- Das Repository lokal: `~/dev/forgepilot`.
- Optional, aber empfohlen: **Ollama** (kostenlose lokale KI) oder ein **Anthropic API-Key** (Cloud).
- Optional: gemountetes **NAS** als Wissens-Quelle (`FORGEPILOT_DOCS_DIR`).

## Dev-Server starten

```bash
npm install      # nur beim ersten Mal
npm run dev      # startet die App
```

Dann im Browser **http://localhost:3000** öffnen.

> Nützliche Prüfbefehle: `npm run type-check` (Typen), `npm run test:run` (Tests), `npm run lint` (Stil), `npm run build` (Produktion). `build` und `type-check` **nicht** parallel laufen lassen.

## Erste Einrichtung in `/settings`

Öffne **`/settings`** (in der Seitenleiste unter „Workspace"). Du brauchst **mindestens einen** KI-Weg:

### Variante A — Cloud (Anthropic)
1. Feld **„Anthropic API Key"** ausfüllen.
2. **„API Keys speichern"** klicken (Status-Pille wird grün = „Gesetzt").

### Variante B — Lokal & kostenlos (Ollama)
1. Ollama starten (Standard-Adresse `http://localhost:11434`).
2. Feld **„Ollama Base URL"** = `http://localhost:11434` → **„Lokale KI URLs speichern"**.
3. Bei **„LLM-Modus"** `ollama` (oder `auto`) wählen → **„LLM-Modus speichern"**.

### Weitere nützliche Keys (optional)
- **GitHub Token** — für Work-Items und das automatische Erstellen von Pull Requests (Scope: `repo`).
- **Linear API Key / Team ID** — wenn du Tickets aus Linear ziehen willst.
- Weitere Provider (Groq, OpenAI, Gemini, Mistral, DeepSeek, OpenRouter, xAI) — je nach Bedarf.

> **Sicherheit:** Keys werden lokal in `config/api-keys.json` gespeichert und landen **nie** in Git. Ein Export-Backup enthält Secrets nur im „Vollständiges Backup".

## Die Navigation verstehen

Die linke Seitenleiste ist in drei Ebenen gegliedert:

| Ebene | Inhalt | Beispiele |
|---|---|---|
| **Workspace** (oben, prominent) | Der tägliche Arbeitsablauf | Command Center `/` · Idea Studio `/studio` · Briefing `/morning` · Idea→Production `/idea` · Execute `/delegations` · Settings |
| **Tools** (sekundär) | Kontext-Werkzeuge | Live `/live` · Plan `/projects` · Plan Mode `/delegations/plan` · Suggestions `/suggestions` · Concept `/concept` · Deploy `/deploy` · Reverse `/reverse` |
| **Werkzeuge** (eingeklappt) | Selten Gebrauchtes | Tools-Hub `/tools` · Skills `/skills` |

Weitere praktische Bedien-Elemente:
- **⌘K** (Command-Palette) — schnelle Suche/Navigation über alle Seiten und Delegationen.
- **Sprache** — Umschalter `DE / EN` unten in der Seitenleiste.
- **Theme** — Hell/Dunkel-Umschalter.
- **Glocke** — Benachrichtigungen; **amber Banner** „X awaiting approval" erscheint, sobald etwas deine Freigabe braucht.

## Der schnellste Weg zur ersten App

1. **`/studio`** öffnen → Idee in eigenen Worten beschreiben → **„Weiter →"**.
2. Blueprint erstellen lassen, optional verfeinern, Funktionen auswählen.
3. **„🚀 App autonom bauen"** → ForgePilot legt ein Repo an und baut los.
4. **„Fortschritt ansehen →"** führt zu **`/delegations`**, wo du den Build live verfolgst.

Den kompletten Ablauf mit echten Klicks zeigt das [Praxis-Beispiel App-Entwicklung](05-beispiel-app-entwicklung.md).

---

[← Überblick](01-ueberblick.md) · [Weiter: Seiten-Referenz →](03-seiten-referenz.md)
