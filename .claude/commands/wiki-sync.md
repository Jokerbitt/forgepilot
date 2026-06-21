Halte das ForgePilot-Bedienungs-Wiki (`docs/wiki/`) mit den gerade gemachten Änderungen synchron. Ziel: Es darf **keine** nutzersichtbare Änderung geben, die nicht im Wiki steht.

Führe das nach jeder bedeutenden Änderung aus — spätestens vor dem Commit/PR (idealerweise als Teil von `/ship`).

## Vorgehen

1. **Änderungen ermitteln.** Sieh dir an, was sich geändert hat:
   - `git diff --stat` (uncommitted) bzw. `git diff main... --stat` (ganzer Branch).
   - Lies bei Bedarf die Diffs der geänderten Dateien, um die *nutzersichtbare* Wirkung zu verstehen (neue Seite? neuer Button? neues Verhalten? neue Sicherheitsregel?).

2. **Betroffene Wiki-Seiten bestimmen** (Mapping unten). Eine Änderung kann mehrere Seiten betreffen.

3. **Wiki aktualisieren.** Trage die Änderung präzise dort ein — echte Labels/Pfade, keine Erfindungen. Wenn etwas neu ist, ergänze einen Abschnitt; wenn sich Verhalten ändert, korrigiere den bestehenden Text. Verifiziere Labels am Quellcode (z.B. `grep` nach dem Button-Text), statt zu raten.

4. **CHANGELOG ergänzen.** Immer einen Eintrag oben in `docs/wiki/CHANGELOG.md` hinzufügen (Format unten). Datum aus dem System-Kontext, nicht raten.

5. **Index prüfen.** Ist eine neue Wiki-Seite entstanden, in `docs/wiki/README.md` (Inhalts-Tabelle) verlinken.

6. **Querverweise.** Wenn ein Begriff neu ist, im Glossar (`07-konzepte-glossar.md`) ergänzen und von den Nutzungs-Seiten dorthin verlinken.

## Mapping: Code-Bereich → Wiki-Seite

| Geändert wurde … | Aktualisiere |
|---|---|
| Eine UI-Seite `src/app/**/page.tsx` (neu/geändert) | `03-seiten-referenz.md` (+ `README.md` wenn neue Seite) |
| Navigation `src/components/shared/AppNav.tsx` | `02-erste-schritte.md` (Navigation), `03-seiten-referenz.md` |
| Journey: `src/lib/journey/**`, `src/components/journey/**`, `src/app/api/journey/**` | `04-gefuehrte-journey.md` (+ `05-…` wenn es den App-Ablauf berührt) |
| Studio/Suggestions/Build-Flow: `src/lib/studio/**`, `src/lib/suggestions/**`, `/api/suggestions/**` | `05-beispiel-app-entwicklung.md`, `03-seiten-referenz.md` |
| Reverse: `src/lib/reverse/**`, `src/app/reverse/**`, `/api/reverse/**` | `06-beispiel-reverse-engineering.md`, `08-sicherheit-guardrails.md` |
| Kern-Logik: delegation, plan, chaining, phase-gate, nba-engine, building-blocks, model-router, cost-routing, knowledge, agents | `07-konzepte-glossar.md` |
| Sicherheit: `criticality.ts`, `security-scan.ts`, `approval-policy.ts`, `phase-gate.ts`, Auth | `08-sicherheit-guardrails.md` |
| Settings/Setup/Provider/Keys | `02-erste-schritte.md`, `03-seiten-referenz.md` (Settings) |
| Grundlegende Architektur/Idee | `01-ueberblick.md` |
| **Jede** nutzersichtbare Änderung | **immer** `CHANGELOG.md` |

Wenn unklar ist, wohin etwas gehört: an `docs/wiki/README.md` (Inhaltsverzeichnis) orientieren.

## CHANGELOG-Eintrag (Format)

Oben unter dem passenden Datum (neuestes Datum zuerst) einfügen:

```
## JJJJ-MM-TT

- **<Was sich geändert hat>** — <Kurz für Nutzer:innen, in Klartext>. → [<wiki-seite>](<datei>.md) · Commit `<sha>` / PR #<nr>
```

## Qualitäts-Checkliste (nichts vergessen)

- [ ] Jede geänderte UI-Seite/Funktion ist in der Seiten-Referenz bzw. Journey beschrieben.
- [ ] Button-/Feld-Labels stimmen mit dem Code überein (verifiziert, nicht geraten).
- [ ] Neue Begriffe stehen im Glossar; neue Sicherheitsregeln in „Sicherheit & Guardrails".
- [ ] Neue Seiten sind im `README.md`-Index verlinkt.
- [ ] Ein CHANGELOG-Eintrag mit Datum + Commit/PR ist gesetzt.
- [ ] Keine erfundenen Beispiel-Daten — echte Werte oder klar als Beispiel markiert.

Berichte am Ende kurz: welche Wiki-Seiten aktualisiert wurden und der CHANGELOG-Eintrag.
