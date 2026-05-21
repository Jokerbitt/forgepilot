# ADR-001: Linear als Single Source of Truth für Issues

**Date:** 2026-05-15  
**Status:** Accepted  
**Risk Class:** C  

## Context
ForgePilot benötigt eine zentrale Quelle für alle Issues, Tasks und Sprint-Daten.
Mehrere Optionen standen zur Wahl: GitHub Issues, Notion, eigene JSON-Datenbank, Linear.

## Decision
Linear ist das SSOT für alle Issues. Alle anderen Systeme (GitHub, ForgePilot-Dashboard, NAS-Docs)
spiegeln Linear wider, schreiben aber nie direkt zurück ohne explizite Sync-Logik.

## Consequences
**Positive:**
- Eindeutiger Status für jedes Issue (kein Duplikat-Chaos)
- Linear MCP ermöglicht direkten API-Zugriff von Claude Code
- Sprint-Planung, Prioritäten und Abhängigkeiten zentral verwaltbar

**Negative / Trade-offs:**
- Abhängigkeit von Linear-API-Key für automatisierte Workflows
- Offline-Betrieb limitiert (kein lokales Linear)

## Alternatives Considered
- GitHub Issues: Zu eng mit Code-Workflow verknüpft, kein Sprint-Management
- Notion: Kein API für Issue-Tracking-Workflows geeignet
- JSON-Store lokal: Kein Multi-Agent-Koordinations-Support
