# 8 · Sicherheit & Guardrails

[← Konzepte & Glossar](07-konzepte-glossar.md) · [Wiki-Index](README.md)

---

ForgePilot kann viel automatisch tun — deshalb sind mehrere Sicherheitsnetze fest eingebaut. Sie lassen sich nicht „aus Versehen" umgehen.

## Der Critical-Guardrail (Reverse Engineering)
`src/lib/reverse/criticality.ts`

Beim Analysieren prüft ForgePilot, ob eine App nach **sicherheits-/missionskritischer Steuerungssoftware** aussieht, und stuft sie ein:

| Stufe | Bedeutung | Folge |
|---|---|---|
| **normal** | unkritisch | Nachbau möglich |
| **sensitive** | z.B. Zahlungen, Echtzeit, Banking | Nachbau möglich, „mit besonderer Sorgfalt" |
| **critical** | Leitrechner, SCADA, PLC/SPS, Modbus/OPC-UA/Profibus, Not-Aus/Interlock, Medizin, Luftfahrt | **Autonomer Nachbau gesperrt** |

Bei **critical** liefert `POST /api/reverse/rebuild` **HTTP 409** und baut nichts — bis ein Mensch ausdrücklich bestätigt (`acknowledgeCritical: true`, in der UI die rote Checkbox). Der Guardrail ist **fail-safe**: Im Zweifel stuft er eher kritisch ein. Erkannt werden Signale case-insensitiv im Code **und** im App-Namen. → siehe [RE-Beispiel 2](06-beispiel-reverse-engineering.md).

## Risk-Classes & Freigaben
`src/lib/nba-engine/approval-policy.ts`

Jede Delegation hat eine **Risk-Class A/B/C** (siehe [Glossar](07-konzepte-glossar.md)). Der Freigabe-Modus in `/settings` steuert, was automatisch laufen darf:

- **manual** → alles braucht deine Freigabe.
- **balanced** (Standard) → nur A automatisch; B/C brauchen Freigabe.
- **autopilot** → A/B unter einer Score-Schwelle automatisch; **Risk-C niemals** automatisch.

Sobald etwas auf deine Freigabe wartet, erscheint in der Seitenleiste das **amber Banner „X awaiting approval"**.

## Build- & Test-Gate
`src/lib/delegations/phase-gate.ts`

Zwischen Phasen muss der Build **und** die Tests grün sein, sonst stoppt die Kette — kein Bauen auf kaputtem Fundament. Ein Test-Timeout gilt als Infrastruktur-Signal (kein Code-Fehler) und blockiert nicht. → [Glossar → Build-Gate & Test-Gate](07-konzepte-glossar.md).

## Security-Scanner
`src/lib/reverse/security-scan.ts`

Findet heuristisch typische Schwachstellen und meldet sie mit Schweregrad + Beispieldatei (nie der Geheimwert selbst):

- **Hardcoded Secrets** (Passwörter, API-Keys, Tokens im Klartext)
- **Exposed Provider-Tokens** (Stripe `sk_live_…`, GitHub `ghp_…`, Slack, GitLab)
- **SQL-Injection** (string-konkatenierte Queries, rohe `mysql_query(...$var)`)
- **Schwache Krypto** (MD5/SHA1/DES/RC4, auch lowercase `md5(`)
- **Unsichere Deserialisierung** (.NET `BinaryFormatter`), **deaktiviertes TLS**, **Klartext-HTTP**

Die Funde fließen in den Analyse-Report **und** als „Sicherheitslücken fixen"-Schritt in den Nachbau-Plan. In der Journey gibt es zusätzlich **🛡️ Wartung** (on-demand + wöchentlicher Cron).

## Secrets bleiben lokal
- API-Keys werden in `config/api-keys.json` gespeichert und landen **nie** in Git.
- Beim Wissens-Index werden Credential-/Secret-Dateien übersprungen; sensible Memory Cards werden lokal gehalten bzw. PII/Secrets redigiert.
- Das GitHub-Repo nutzt **Push Protection**: ein Push mit einem realistischen Secret im Code wird abgelehnt (auch echte Beispiel-Keys in Tests) — Test-Fixtures müssen synthetisch sein.

## Sichere Datei-Aufnahme (ZIP-Upload)
`src/lib/reverse/ingest.ts`
Hochgeladene ZIPs werden mit **Path-Traversal-Schutz**, **Zip-Bomb-Schutz** und Größen-/Datei-Limits in einen isolierten Workspace entpackt — Dateien werden geschrieben, **nie ausgeführt**.

## Goldene Regeln
- **Leitrechner/SCADA/PLC/Safety:** nie ungeprüft produktiv — der Guardrail erzwingt menschliche Bestätigung.
- **Risk-C** (Auth, Zahlungen, Schema): immer menschliche Freigabe + ADR.
- **Nachbau ≠ Klon:** „Logik 1:1" muss per Paritäts-Test belegt werden.

---

[← Konzepte & Glossar](07-konzepte-glossar.md) · [Wiki-Index](README.md)
