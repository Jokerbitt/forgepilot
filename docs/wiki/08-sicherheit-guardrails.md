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
| **critical** | Leitrechner, SCADA, PLC/SPS, Modbus/OPC-UA/Profibus, Not-Aus/Interlock, Medizin, Luftfahrt, **PLC-Programmierumgebungen** (Codesys/TIA/Step 7/Simatic, Structured Text, Ladder Logic) | **Autonomer Nachbau gesperrt** |

Bei **critical** liefert `POST /api/reverse/rebuild` **HTTP 409** und baut nichts — bis ein Mensch ausdrücklich bestätigt (`acknowledgeCritical: true`, in der UI die rote Checkbox). Der Guardrail ist **fail-safe**: Im Zweifel stuft er eher kritisch ein. Erkannt werden Signale case-insensitiv im Code **und** im App-Namen. → siehe [RE-Beispiel 2](06-beispiel-reverse-engineering.md).

## Risk-Classes & Freigaben
`src/lib/nba-engine/approval-policy.ts`

Jede Delegation hat eine **Risk-Class A/B/C** (siehe [Glossar](07-konzepte-glossar.md)). Der Freigabe-Modus in `/settings` steuert, was automatisch laufen darf:

- **manual** → alles braucht deine Freigabe.
- **balanced** (Standard) → nur A automatisch; B/C brauchen Freigabe.
- **autopilot** → A/B unter einer Score-Schwelle automatisch; **Risk-C niemals** automatisch.

Sobald etwas auf deine Freigabe wartet, erscheint in der Seitenleiste das **amber Banner „X awaiting approval"**.

### Risk-C-Freigabe (Auth, Zahlungen, Schema)
`src/lib/delegations/risk-c-approval.ts` · ADR-004

Risk-C startet **nie** automatisch. Es gibt aber jetzt einen **bewussten menschlichen Freigabe-Pfad**: In der Detailansicht einer Risk-C-Delegation erscheint ein rotes **Risk-C-Freigabe-Panel**. Eine Freigabe gelingt nur, wenn **alle** drei Bedingungen erfüllt sind:

1. **Autorisierter Freigeber** — der eingetragene Name steht auf der Allowlist `FORGEPILOT_RISK_C_APPROVERS` (komma-separiert). Ist die Liste leer/ungesetzt, kann **niemand** Risk-C freigeben (fail-closed).
2. **Mensch** — automatische Akteure (`autonomous-mode`, Autopilot, Cron …) sind ausgeschlossen.
3. **Begründung** — eine getippte Begründung ist Pflicht und wird im Audit-Eintrag (`approvedBy.reason`) gespeichert.

Erst danach darf der Lauf starten — der zentrale Ausführungs-Check verlangt weiterhin unabhängig einen menschlichen `approvedBy`-Eintrag.

Jede Freigabe wird jetzt **mit Audit-Spur** festgehalten: `approvedBy` speichert **wer** (Person oder `autonomous-mode`), **wann** und optional **warum** — eine Delegation lässt sich nicht mehr spurlos freischalten. `src/lib/models/delegation.ts`

## Runner-Sicherheit (unbeaufsichtigter Betrieb)
Damit ein Lauf auch **ohne Aufsicht** sicher ist, sitzen drei Netze direkt vor und um die Agenten-Ausführung:

- **Policy-Gate vor dem Start** (`src/lib/policy/gate.ts`): Vor jedem Agenten-Start prüft die Deny-first-Policy den Auftrag (Risk-C, Secret-/destruktive Tools, fehlendes Budget, öffentlicher Privacy-Modus). **Scharf** (Standard in der Produktion, `FORGEPILOT_POLICY_ENFORCE=1`): ein „deny" stoppt den Start hart (HTTP 403). Mit `FORGEPILOT_POLICY_ENFORCE=0` läuft er als Report-Only (protokolliert nur).
- **Risk-C wird nie automatisch ausgeführt** (`src/lib/delegation-execution.ts`): Eine Risk-C-Aufgabe läuft ausschließlich mit einer **menschlichen** Freigabe (`approvedBy`). Kein Autopilot-, Auto-Chain-, Cron- oder Retry-Pfad kann Risk-C selbst freigeben — der zentrale Ausführungs-Check blockt jeden Risk-C-Lauf ohne menschliche Freigabe (403). Dies bleibt die zentrale Bremse. **Hinweis (ADR-004 E2-C):** Eine freigegebene Risk-C-Aufgabe darf bewusst über den mächtigeren `--dangerously`-CLI-Runner laufen (früher gesperrt). Der Schutz liegt dann bei deiner menschlichen Einzelfreigabe plus Policy-Gate, Secret-Scrub und Budget-Stopp; der Lauf wird als Risk-C-auf-dangerous-Runner protokolliert.
- **Budget-Stopp mitten im Lauf** (`src/lib/budget/guard.ts`): Die Live-Kosten werden **während** des Laufs überwacht. Überschreiten sie das Budget (inkl. Toleranz-Einstellung), wird der Agent **sofort beendet** und die Delegation als *budget-pausiert* markiert — fortsetzbar mit höherem Budget. Früher wurde das Budget erst **nach** dem Lauf geprüft.
- **Secrets bleiben beim Server** (`src/lib/delegations/runner-env.ts`): Der gespawnte Agent erbt **nicht** mehr die Server-Geheimnisse (CRON_/AUTH_/AUDIT-Secret, DATABASE_URL, Provider-Keys). Default-Deny: alles, was wie ein Credential aussieht, wird herausgefiltert; nur die wenigen wirklich nötigen Zugänge (eigener Auth-Token, `GH_TOKEN` für `gh pr create`) werden gezielt wieder hineingegeben.

> Hinweis: Der Policy-Gate steht bewusst auf **Report-Only**, bis die protokollierten Verdikte aus echten Läufen geprüft sind — danach wird `FORGEPILOT_POLICY_ENFORCE=1` aktiviert. Details in `docs/adr/ADR-003-runner-autonomy-security.md`.

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
