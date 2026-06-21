Zeige den aktuellen Status aller laufenden Delegation Chains.

1. Lese `config/delegations.json`
2. Finde alle Delegationen mit `chainNextId` oder `chainPosition`
3. Gruppiere nach Plan (via `tags: ['plan:...']`)
4. Zeige pro Chain:
   - Plan-Name und Gesamt-Phasen
   - Jede Phase: Status (pending/approved/running/completed/failed) + Position
   - Aktuelle Phase (running) mit Fortschritt
   - Nächste Phase

Format:
```
Chain: Plan "Todo App mit CRUD API" (4 Phasen)
  Phase 1/4: ✅ Datenmodell     [completed]
  Phase 2/4: 🔄 API Routes      [running — seit 12 min]
  Phase 3/4: ⏳ UI Components   [pending]  
  Phase 4/4: ⏳ Tests + E2E     [pending]
  
Parallel laufend: Phase 2 + Phase 3 (keine Abhängigkeiten)
```

Falls keine aktiven Chains: zeige die letzten 3 abgeschlossenen.
