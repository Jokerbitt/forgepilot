# 6 · Praxis-Beispiel: Reverse Engineering (Schritt für Schritt)

[← App-Beispiel](05-beispiel-app-entwicklung.md) · [Weiter: Konzepte & Glossar →](07-konzepte-glossar.md)

---

Reverse Engineering nimmt eine **bestehende Alt-Anwendung**, analysiert sie und plant einen **modernen, plattformunabhängigen Nachbau** — inklusive Datenbank-Wechsel, Sicherheits-Fixes und UI-Modernisierung.

Die Beispiele unten sind **echt**: Es sind die Ergebnisse, die ForgePilot bei einem realen Test gegen vorbereitete Projekte geliefert hat (Stand 2026-06-21).

---

## Beispiel 1 — Eine Legacy-C#-Desktop-App modernisieren

**Ausgangslage:** eine alte **C# WinForms**-Kundenverwaltung mit **Microsoft SQL Server**, Windows-only, mit hartkodiertem Connection-String.

### Schritt 1 — Analysieren

Öffne **`/reverse`**. Trage den Pfad ein:

> `/Users/you/dev/legacy-crm-winforms`

Klick **„Pfad analysieren"** (alternativ **„📦 ZIP hochladen"**, max. 50 MB).

> Intern: `POST /api/reverse/analyze` → `analyzeForReverse(pfad)` läuft read-only über den Code.

### Schritt 2 — Den Analyse-Report lesen

ForgePilot liefert (echte Ausgabe):

| Feld | Ergebnis |
|---|---|
| **Sprachen** | C# |
| **Frameworks** | .NET, WinForms |
| **Plattform** | **windows** — „WinForms (System.Windows.Forms) — Windows-only; .NET Framework (net4x) — praktisch Windows-only" |
| **Datenbank** | Microsoft SQL Server |
| **Sicherheit** | 🔴 Hardcoded Secret · 🔴 SQL Injection |
| **Tech-Schuld** | „Windows + MSSQL — für plattformunabhängigen Betrieb: MSSQL → PostgreSQL und UI-Schicht portieren" |
| **Kritikalität** | NORMAL |
| **Modernisierung** | WinForms → Next.js + React · MSSQL → PostgreSQL (Prisma) · .NET Framework → .NET 8 |

Über **„📄 Report (.md)"** lädst du den vollständigen Report als Markdown herunter (zum Archivieren/Teilen).

### Schritt 3 — Nachbau konfigurieren

Im Bereich **„Nachbau konfigurieren"**:

- **Ziel-Stack (optional):** z.B. `Next.js + PostgreSQL` (sonst leitet ForgePilot ihn aus der Analyse ab).
- **Datenbank migrieren nach:** `PostgreSQL`.
- **Checkboxen** (alle anhakbar):
  - ☑ **Logik 1:1 beibehalten** — erzeugt Paritäts-Tests gegen das Original.
  - ☑ **Plattformunabhängig** — entfernt Windows-Bindung.
  - ☑ **Sicherheitslücken fixen** — behebt die gefundenen Funde (Secret, SQL-Injection).
  - ☑ **Bugs beheben** · ☑ **UI modernisieren**.
- Optional **Ziel-Repo** angeben (sonst wird automatisch eines angelegt).

### Schritt 4 — Nachbau starten

Klick **„Nachbau planen & starten"**.

> Intern: `POST /api/reverse/rebuild` → re-analysiert serverseitig (vertraut nie dem Client) → `reportToRebuildSteps()` erzeugt geordnete Schritte → `suggestionsToPlan()` → derselbe Plan-Executor wie bei der App-Entwicklung (mit Build-Gate + Test-Gate pro Phase).

Typische Nachbau-Schritte:

1. Architektur & Datenmodell rekonstruieren
2. Datenbank nach PostgreSQL migrieren
3. Module portieren (UI → Web)
4. Sicherheitslücken beheben
5. UI modernisieren
6. **Paritäts-Test** gegen das Original (wenn „Logik 1:1")
7. App validieren (Build grün, Tests grün)

Danach verfolgst du den Nachbau wie jeden Build in **`/delegations`** und prüfst ihn über die [geführte Journey](04-gefuehrte-journey.md).

> **Wichtige Ehrlichkeit:** Ein Nachbau ist eine **Annäherung**, kein 1:1-Klon. „Logik 1:1" wird per **Paritäts-Test** gegen das Original belegt — nicht versprochen.

---

## Beispiel 2 — Der Critical-Guardrail in Aktion (Leitrechner / SCADA)

**Ausgangslage:** ein Projekt mit **SCADA/PLC-Leitrechner**-Bezug (Modbus, OPC-UA, Not-Aus). Genau hier greift die Sicherheitssperre.

### Schritt 1 — Analysieren

In **`/reverse`** den Pfad eintragen → **„Pfad analysieren"**. Der Report meldet (echte Ausgabe):

> **Kritikalität: CRITICAL** → Gründe: „Hinweise auf Leit-/Steuerungssoftware (SCADA/PLC/Leitrechner); Industrielle Feldbus-/Automatisierungsprotokolle erkannt; Sicherheitsfunktionen (Safety/Not-Aus/Interlock) erkannt; Echtzeit-/deterministische Anforderungen".

Auf der Seite erscheint ein **rotes Banner**:

> ⛔ *„Kritische Steuerungssoftware erkannt (…). Kein autonomer Nachbau ohne ausdrückliche Bestätigung — nur Analyse/Teilmodernisierung unter menschlicher Verifikation."*

### Schritt 2 — Nachbau ist gesperrt

Wenn du **„Nachbau planen & starten"** ohne Bestätigung versuchst, antwortet die App mit **HTTP 409** und baut **nichts** (echte Antwort):

```json
{
  "error": "Kritische Steuerungssoftware erkannt — autonomer Nachbau gesperrt.",
  "criticality": { "level": "critical", "reasons": ["Hinweise auf Leit-/Steuerungssoftware (SCADA/PLC/Leitrechner)", "…"] },
  "requiresAcknowledgement": true
}
```

### Schritt 3 — Nur mit ausdrücklicher Bestätigung

Erst wenn du die Checkbox aktivierst —

> ☑ *„Ich verstehe: Dies ist kritische Steuerungssoftware. Der Nachbau ist eine Annäherung und darf nicht ungeprüft produktiv eingesetzt werden. Ich übernehme die Verifikation."*

— wird der Knopf frei und der Nachbau läuft unter deiner Verantwortung (`acknowledgeCritical: true`).

> **Warum das so ist:** Leitrechner/SCADA/PLC steuern physische Anlagen — ein ungeprüfter automatischer Nachbau wäre gefährlich. Der Guardrail ist bewusst **fail-safe**: Im Zweifel stuft er eher als kritisch ein. Details: [Sicherheit & Guardrails](08-sicherheit-guardrails.md).

---

## Was ForgePilot beim Analysieren erkennt

| Kategorie | Beispiele |
|---|---|
| **Sprachen** | C#/.NET, TypeScript/JS, Python, Java, Go, PHP, Ruby, Swift, C/C++ |
| **Frameworks** | .NET/WinForms/WPF/MAUI/Avalonia, Next.js/React/Express, Flask/Django/FastAPI, Spring, Laravel/Symfony, Rails, Electron/Tauri |
| **Datenbanken** | MS SQL Server, PostgreSQL, MySQL, MongoDB, SQLite |
| **Plattform** | Windows-gebunden vs. cross-platform (mit Begründung) |
| **Sicherheit** | Hardcoded Secrets, Provider-Tokens (Stripe/GitHub/…), SQL-Injection, schwache Krypto (md5/sha1), unsichere Deserialisierung, deaktiviertes TLS |
| **Kritikalität** | normal / sensitive / critical (Leitrechner, SCADA, PLC, Medizin, Luftfahrt, Zahlung) |

> Hinweis: Die Sprach-/Sicherheits-Erkennung wird laufend erweitert (z.B. wurden PHP-Security-Muster und Python-Frameworks am 2026-06-21 ergänzt). Den jeweils aktuellen Stand zeigt der [CHANGELOG](CHANGELOG.md).

---

[← App-Beispiel](05-beispiel-app-entwicklung.md) · [Weiter: Konzepte & Glossar →](07-konzepte-glossar.md)
