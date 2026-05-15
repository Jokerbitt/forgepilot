export const NBA_CONFIG = {
  // Harte Filter
  ignoreStatuses: ['done', 'cancelled', 'duplicate', 'archived'],
  
  // Time-Decay (Verrottende Backlogs)
  penalizeOldBacklogs: true,
  backlogPenaltyAgeDays: 90,   // Ab wann gilt es als verstaubt?
  backlogPenaltyScore: 20,     // Wie viele Punkte Abzug? (wird abgezogen, also positiv angeben)

  // Triage
  showTriageJoker: true,       // Soll gelegentlich ein altes Backlog-Ticket auftauchen?

  // UI Anzeige
  maxRecommendations: 5        // Wie viele Karten zeigt das Dashboard?
}
