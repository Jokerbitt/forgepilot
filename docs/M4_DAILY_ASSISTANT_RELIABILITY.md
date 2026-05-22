# M4 - Daily Assistant Reliability

## Ziel

ForgePilot soll sich im Alltag wie ein verlaesslicher Entwicklungsassistent anfuehlen:
eine klare naechste Aktion, nachvollziehbare Risiken, sichere Provider-Konfiguration und
keine unkontrollierte Agenten-Automation.

## Tagesroutine

1. Command Center oeffnen.
2. Daily Assistant Readiness pruefen.
3. Den ersten roten Check erledigen, bevor neue Features gestartet werden.
4. Daily Report an Grok, Claude oder Codex geben, wenn externe Kritik gebraucht wird.
5. Nur P0/P1-Aufgaben aus dem Daily Report umsetzen.
6. Nach jedem echten Loop Evidence mit PR, Critic Review und Writeback sichern.

## Produktivregeln

- `FORGEPILOT_AUTH_DISABLED=true` ist nur fuer lokale Tests erlaubt.
- Produktiv oder im Netzwerk nur mit Login, `NEXTAUTH_SECRET`, `NEXTAUTH_URL` und starkem Admin-Passwort starten.
- Secrets bleiben in `.env.local`, Keychain, Vault oder der lokalen Settings-API. Sie werden nie in Reports, Prompts oder PRs kopiert.
- Ollama/LM Studio sind fuer Zusammenfassung, Triage und Low-Risk-Planung erste Wahl.
- Cloud-Modelle sind fuer Security, Architektur, komplexe Implementierung und Final Review reserviert.

## Readiness-Checks

Der Daily Report bewertet diese Punkte:

- Auth aktiv
- Persistenz stabil
- Critic-Router bereit
- Execute-Beweise vorhanden
- Fehlerhafte Delegationen triagiert
- Offene Entscheidungen reduziert

Der Score ist kein Marketing-Wert. Er ist ein Betriebsindikator: was verhindert heute, dass ForgePilot
nuetzlich und ruhig arbeitet?

## Failed Delegation Triage

Fehlerhafte Delegationen werden nicht ignoriert und nicht blind neu gestartet.

Jede fehlerhafte Delegation bekommt eine Entscheidung:

- Retry, wenn Ursache transient ist.
- Escalate, wenn Provider/Auth/GitHub/Linear fehlt.
- Follow-up-Task, wenn ein kleiner Codefix noetig ist.
- Archive, wenn der Auftrag veraltet oder doppelt ist.

## Handoff fuer Kritiker-LLMs

Grok, Claude, Codex oder lokale Modelle bekommen nur den Daily Report oder das sichere Handoff-Paket.
Die Aufgabe lautet:

```text
Review this ForgePilot Daily Report. Return Executive Verdict, Top 5 risks,
next 3 concrete tasks, and what not to build yet. Do not ask for secrets or broad write access.
Focus on reliability, auth/provider readiness, failed delegation triage and the next useful loop.
```

## Do Not Build In M4

- Kein Billing.
- Keine Multi-Tenancy.
- Kein Ausbau der Agent Control Plane.
- Keine neuen Provider ohne konkreten Nutzen.
- Keine grosse Governance Engine.
- Keine neue SaaS-Landing-Page, solange der Daily Assistant nicht stabil hilft.
