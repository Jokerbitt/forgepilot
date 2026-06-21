Führe einen vollständigen Review eines ForgePilot Delegation Plans durch.

Lese den aktuellen Plan aus `config/delegation-plans.json` (neusten draft).

Prüfe jeden Phase auf:
1. **Größe**: Sind die estimatedTurns realistisch? (30-40 = klein, 60-80 = mittel, 80+ = zu groß → splitten)
2. **Unabhängigkeit**: Kann jede Phase isoliert getestet werden? (Tests müssen am Ende der Phase grün sein)
3. **Reihenfolge**: Stimmen die dependsOn Abhängigkeiten? Gibt es Phasen die parallel laufen könnten?
4. **Risk Class**: Ist A/B/C korrekt vergeben?
5. **Definition of Done**: Sind die DoD Items messbar und verifizierbar?

Zeige die Analyse als Tabelle:
| Phase | Turns | Risk | Parallelisierbar | Probleme |
|---|---|---|---|---|

Empfehle konkrete Änderungen wenn Probleme gefunden.
