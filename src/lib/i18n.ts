'use client'

import { useEffect, useState } from 'react'

export type Locale = 'de' | 'en'

const STORAGE_KEY = 'forgepilot.locale'

export const DEFAULT_LOCALE: Locale = 'de'

type NavKey =
  | 'commandCenter'
  | 'briefing'
  | 'plan'
  | 'execute'
  | 'knowledge'
  | 'delegationLessons'
  | 'system'
  | 'inbox'
  | 'notifications'
  | 'projectBriefs'
  | 'workItems'
  | 'agentBoard'
  | 'activeRuns'
  | 'agentRuns'
  | 'agentControl'
  | 'orchestrations'
  | 'agentMonitor'
  | 'pmAgent'
  | 'researchPlatform'
  | 'contextPackages'
  | 'planningAudit'
  | 'governanceHub'
  | 'costAnalytics'
  | 'ideaToProduction'
  | 'liveView'
  | 'e2ePilot'
  | 'activityDigest'
  | 'settings'

type UiKey =
  | 'workspace'
  | 'more'
  | 'new'
  | 'logout'
  | 'quickSearch'
  | 'search'
  | 'agentsRunning'
  | 'agentRunning'
  | 'copied'
  | 'copyLink'
  | 'downloadLogs'
  | 'orchestrate'
  | 'execute'
  | 'decomposing'
  | 'status'
  | 'risk'
  | 'costs'
  | 'noPr'
  | 'open'
  | 'closed'
  | 'merged'
  | 'critic'
  | 'revision'
  | 'rejected'
  | 'pending'
  | 'retries'
  | 'attempts'
  | 'created'
  | 'updated'
  | 'continuedFrom'
  | 'continueWith'
  | 'executionLog'
  | 'showLogs'
  | 'hide'
  | 'agentRunningLogs'
  | 'contract'
  | 'route'
  | 'branch'
  | 'privacy'
  | 'model'
  | 'output'
  | 'budget'
  | 'actual'
  | 'result'
  | 'note'
  | 'allowedTools'
  | 'back'
  | 'pullRequest'
  | 'openPrOnGithub'
  | 'ciLoading'
  | 'ciGreen'
  | 'ciFailed'
  | 'ciRunning'
  | 'ciUnknown'
  | 'moreItems'
  | 'learnedKnowledge'
  | 'allKnowledgeCards'
  | 'contextAtExecution'
  | 'cards'
  | 'tokens'
  | 'simulationMode'
  | 'realExecutionHint'
  | 'acceptanceCriteriaNote'
  | 'awaitingApproval'
  | 'approve'
  | 'viewAll'
  | 'dismiss'

type Dictionary = {
  nav: Record<NavKey, { label: string; short: string }>
  ui: Record<UiKey, string>
}

export const dictionaries: Record<Locale, Dictionary> = {
  de: {
    nav: {
      commandCenter: { label: 'Command Center', short: 'Command' },
      briefing: { label: 'Briefing', short: 'Briefing' },
      plan: { label: 'Projekte', short: 'Projekte' },
      execute: { label: 'Ausführen', short: 'Ausführen' },
      knowledge: { label: 'Wissen', short: 'Wissen' },
      delegationLessons: { label: 'Lernkarten', short: 'Lessons' },
      system: { label: 'Branches', short: 'Branches' },
      inbox: { label: 'Eingang', short: 'Eingang' },
      notifications: { label: 'Benachrichtigungen', short: 'Infos' },
      projectBriefs: { label: 'Projekt-Briefs', short: 'Briefs' },
      workItems: { label: 'Aufgaben', short: 'Tasks' },
      agentBoard: { label: 'Agent Board', short: 'Board' },
      activeRuns: { label: 'Aktive Runs', short: 'Aktiv' },
      agentRuns: { label: 'Agent Runs', short: 'Runs' },
      agentControl: { label: 'Agent Control', short: 'Agents' },
      orchestrations: { label: 'Orchestrierungen', short: 'Orch.' },
      agentMonitor: { label: 'Agent Monitor', short: 'Monitor' },
      pmAgent: { label: 'PM Agent', short: 'PM Agent' },
      researchPlatform: { label: 'Research Platform', short: 'Research' },
      contextPackages: { label: 'Context Packages', short: 'Context' },
      planningAudit: { label: 'Planning Audit', short: 'Planning' },
      governanceHub: { label: 'Governance Hub', short: 'Gov' },
      costAnalytics: { label: 'Kostenanalyse', short: 'Analyse' },
      ideaToProduction: { label: 'Plan Mode', short: 'Plan' },
      liveView: { label: 'Live View', short: 'Live' },
      e2ePilot: { label: 'E2E Pilot', short: 'Pilot' },
      activityDigest: { label: 'Aktivitäts-Digest', short: 'Digest' },
      settings: { label: 'Einstellungen', short: 'Settings' },
    },
    ui: {
      workspace: 'Workspace',
      more: 'Werkzeuge',
      new: 'Neu',
      logout: 'Abmelden',
      quickSearch: 'Quick Search',
      search: 'Suche',
      agentsRunning: 'Agenten laufen',
      agentRunning: 'Agent läuft',
      copied: 'Kopiert',
      copyLink: 'Link kopieren',
      downloadLogs: 'Logs herunterladen',
      orchestrate: 'Orchestrieren',
      execute: 'Ausführen',
      decomposing: 'Zerlege…',
      status: 'Status',
      risk: 'Risiko',
      costs: 'Kosten',
      noPr: 'Kein PR',
      open: 'Offen',
      closed: 'Geschlossen',
      merged: 'Zusammengeführt',
      critic: 'Critic',
      revision: 'Revision',
      rejected: 'Abgelehnt',
      pending: 'Ausstehend',
      retries: 'Wiederholungen',
      attempts: 'Versuche',
      created: 'Erstellt',
      updated: 'Aktualisiert',
      continuedFrom: 'Fortgesetzt von',
      continueWith: 'Weiter mit',
      executionLog: 'Ausführungslog',
      showLogs: 'Logs anzeigen',
      hide: 'Einklappen',
      agentRunningLogs: 'Agent läuft — Logs anzeigen, um Details zu sehen.',
      contract: 'Auftrag',
      route: 'Route',
      branch: 'Branch',
      privacy: 'Datenschutz',
      model: 'Modell',
      output: 'Ausgabe',
      budget: 'Budget',
      actual: 'Tatsächlich',
      result: 'Ergebnis',
      note: 'Notiz',
      allowedTools: 'Erlaubte Tools',
      back: 'Zurück',
      pullRequest: 'Pull Request',
      openPrOnGithub: 'auf GitHub öffnen',
      ciLoading: 'CI-Status wird geladen…',
      ciGreen: 'CI grün',
      ciFailed: 'CI fehlgeschlagen',
      ciRunning: 'CI läuft',
      ciUnknown: 'CI unbekannt',
      moreItems: 'weitere',
      learnedKnowledge: 'Gelerntes Wissen',
      allKnowledgeCards: 'Alle Wissenskarten',
      contextAtExecution: 'Kontext bei Ausführung',
      cards: 'Karten',
      tokens: 'Tokens',
      simulationMode: 'Simulations-Modus',
      realExecutionHint: 'Für echte Ausführung Claude CLI oder einen lokalen Agenten konfigurieren.',
      acceptanceCriteriaNote: 'Klare Abnahmekriterien pro Task → weniger Agenten-Abweichung',
      awaitingApproval: 'warten auf Freigabe',
      approve: 'Freigeben',
      viewAll: 'Alle anzeigen',
      dismiss: 'Ausblenden',
    },
  },
  en: {
    nav: {
      commandCenter: { label: 'Command Center', short: 'Command' },
      briefing: { label: 'Briefing', short: 'Briefing' },
      plan: { label: 'Projects', short: 'Projects' },
      execute: { label: 'Execute', short: 'Execute' },
      knowledge: { label: 'Knowledge', short: 'Knowledge' },
      delegationLessons: { label: 'Delegation Lessons', short: 'Lessons' },
      system: { label: 'System', short: 'System' },
      inbox: { label: 'Inbox', short: 'Inbox' },
      notifications: { label: 'Notifications', short: 'Notifs' },
      projectBriefs: { label: 'Project Briefs', short: 'Briefs' },
      workItems: { label: 'Work Items', short: 'Items' },
      agentBoard: { label: 'Agent Board', short: 'Board' },
      activeRuns: { label: 'Active Runs', short: 'Active' },
      agentRuns: { label: 'Agent Runs', short: 'Runs' },
      agentControl: { label: 'Agent Control', short: 'Agents' },
      orchestrations: { label: 'Orchestrations', short: 'Orch.' },
      agentMonitor: { label: 'Agent Monitor', short: 'Monitor' },
      pmAgent: { label: 'PM Agent', short: 'PM Agent' },
      researchPlatform: { label: 'Research Platform', short: 'Research' },
      contextPackages: { label: 'Context Packages', short: 'Context' },
      planningAudit: { label: 'Planning Audit', short: 'Planning' },
      governanceHub: { label: 'Governance Hub', short: 'Gov' },
      costAnalytics: { label: 'Cost Analytics', short: 'Analytics' },
      ideaToProduction: { label: 'Plan Mode', short: 'Plan' },
      liveView: { label: 'Live View', short: 'Live' },
      e2ePilot: { label: 'E2E Pilot', short: 'Pilot' },
      activityDigest: { label: 'Activity Digest', short: 'Digest' },
      settings: { label: 'Settings', short: 'Settings' },
    },
    ui: {
      workspace: 'Workspace',
      more: 'More',
      new: 'New',
      logout: 'Sign out',
      quickSearch: 'Quick Search',
      search: 'Search',
      agentsRunning: 'Agents running',
      agentRunning: 'Agent running',
      copied: 'Copied',
      copyLink: 'Copy link',
      downloadLogs: 'Download logs',
      orchestrate: 'Orchestrate',
      execute: 'Execute',
      decomposing: 'Decomposing…',
      status: 'Status',
      risk: 'Risk',
      costs: 'Costs',
      noPr: 'No PR',
      open: 'Open',
      closed: 'Closed',
      merged: 'Merged',
      critic: 'Critic',
      revision: 'Revision',
      rejected: 'Rejected',
      pending: 'Pending',
      retries: 'Retries',
      attempts: 'Attempts',
      created: 'Created',
      updated: 'Updated',
      continuedFrom: 'Continued from',
      continueWith: 'Continue with',
      executionLog: 'Execution log',
      showLogs: 'Show logs',
      hide: 'Collapse',
      agentRunningLogs: 'Agent is running — show logs for details.',
      contract: 'Contract',
      route: 'Route',
      branch: 'Branch',
      privacy: 'Privacy',
      model: 'Model',
      output: 'Output',
      budget: 'Budget',
      actual: 'Actual',
      result: 'Result',
      note: 'Note',
      allowedTools: 'Allowed tools',
      back: 'Back',
      pullRequest: 'Pull Request',
      openPrOnGithub: 'open on GitHub',
      ciLoading: 'Loading CI status…',
      ciGreen: 'CI green',
      ciFailed: 'CI failed',
      ciRunning: 'CI running',
      ciUnknown: 'CI unknown',
      moreItems: 'more',
      learnedKnowledge: 'Learned knowledge',
      allKnowledgeCards: 'All knowledge cards',
      contextAtExecution: 'Context at execution',
      cards: 'cards',
      tokens: 'tokens',
      simulationMode: 'Simulation mode',
      realExecutionHint: 'Configure Claude CLI or a local agent for real execution.',
      acceptanceCriteriaNote: 'Clear acceptance criteria per task → less agentic drift',
      awaitingApproval: 'awaiting approval',
      approve: 'Approve',
      viewAll: 'View all',
      dismiss: 'Dismiss',
    },
  },
}

function readLocale(): Locale {
  if (typeof window === 'undefined') return DEFAULT_LOCALE
  const stored = window.localStorage.getItem(STORAGE_KEY)
  return stored === 'en' || stored === 'de' ? stored : DEFAULT_LOCALE
}

export function setLocale(locale: Locale) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, locale)
  window.dispatchEvent(new CustomEvent('forgepilot:locale-change', { detail: locale }))
}

export function useI18n() {
  const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE)

  useEffect(() => {
    setLocaleState(readLocale())
    const onChange = () => setLocaleState(readLocale())
    window.addEventListener('forgepilot:locale-change', onChange)
    window.addEventListener('storage', onChange)
    return () => {
      window.removeEventListener('forgepilot:locale-change', onChange)
      window.removeEventListener('storage', onChange)
    }
  }, [])

  const changeLocale = (nextLocale: Locale) => {
    setLocale(nextLocale)
    setLocaleState(nextLocale)
  }

  return {
    locale,
    setLocale: changeLocale,
    nav: dictionaries[locale].nav,
    ui: dictionaries[locale].ui,
  }
}
