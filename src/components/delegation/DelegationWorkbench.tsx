'use client'

/**
 * DelegationWorkbench — Evidence-Workbench Tab Navigation
 *
 * Wraps the delegation detail page sections into 6 logical tabs:
 *   Übersicht | Live | Änderungen | Qualität | Wissen | Details
 *
 * Uses a "wrap and reveal" pattern: no existing code is modified.
 * Parent passes activeTab + setActiveTab; child sections are rendered
 * only when their tab is active (display toggle, not unmount).
 *
 * Tabs auto-select based on delegation status:
 *   running   → Live tab
 *   completed → Übersicht tab
 *   failed    → Details tab (to see error logs)
 */

import { useEffect } from 'react'
import type { Delegation } from '@/lib/models/delegation'

export type WorkbenchTab = 'overview' | 'live' | 'changes' | 'quality' | 'knowledge' | 'details'

interface TabConfig {
  id: WorkbenchTab
  label: string
  icon: string
  /** Show a badge when this is true */
  badge?: boolean
  badgeColor?: string
}

function getTabsForDelegation(d: Delegation, hasKnowledge: boolean, hasCritic: boolean): TabConfig[] {
  const isRunning = d.status === 'running'
  const isDone = d.status === 'completed' || d.status === 'failed' || d.status === 'cancelled'
  const hasChanges = !!(
    d.summaryReport?.filesAdded?.length ||
    d.summaryReport?.filesModified?.length ||
    d.summaryReport?.filesDeleted?.length ||
    d.summaryReport?.prUrl
  )

  return [
    {
      id: 'overview',
      label: 'Übersicht',
      icon: '📋',
    },
    {
      id: 'live',
      label: isRunning ? 'Live' : 'Verlauf',
      icon: isRunning ? '🔴' : '📡',
      badge: isRunning,
      badgeColor: 'bg-red-500',
    },
    {
      id: 'changes',
      label: 'Änderungen',
      icon: '🔍',
      badge: hasChanges && isDone,
      badgeColor: 'bg-blue-500',
    },
    {
      id: 'quality',
      label: 'Qualität',
      icon: '🎯',
      badge: hasCritic,
      badgeColor: 'bg-violet-500',
    },
    {
      id: 'knowledge',
      label: 'Wissen',
      icon: '🧠',
      badge: hasKnowledge,
      badgeColor: 'bg-emerald-500',
    },
    {
      id: 'details',
      label: 'Details',
      icon: '🔧',
    },
  ]
}

interface WorkbenchTabsProps {
  delegation: Delegation
  activeTab: WorkbenchTab
  onTabChange: (tab: WorkbenchTab) => void
  hasKnowledge?: boolean
  hasCritic?: boolean
}

export function WorkbenchTabs({
  delegation,
  activeTab,
  onTabChange,
  hasKnowledge = false,
  hasCritic = false,
}: WorkbenchTabsProps) {
  const tabs = getTabsForDelegation(delegation, hasKnowledge, hasCritic)

  return (
    <div className="border-b border-gray-800 bg-gray-900/50 -mx-5 px-5 pb-0 pt-3">
      <div className="flex items-end gap-0.5 overflow-x-auto scrollbar-hide">
        {tabs.map(tab => {
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onTabChange(tab.id)}
              className={`
                relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium whitespace-nowrap rounded-t-lg
                border-b-2 transition-all
                ${isActive
                  ? 'border-violet-500 text-white bg-gray-800/80'
                  : 'border-transparent text-gray-500 hover:text-gray-300 hover:border-gray-600'
                }
              `}
            >
              <span>{tab.icon}</span>
              <span>{tab.label}</span>
              {tab.badge && (
                <span className={`w-1.5 h-1.5 rounded-full ${tab.badgeColor ?? 'bg-gray-500'} animate-pulse`} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** Smart default tab based on delegation status */
export function getDefaultTab(d: Delegation): WorkbenchTab {
  if (d.status === 'running') return 'live'
  if (d.status === 'failed') return 'live'   // see what went wrong
  if (d.status === 'completed') return 'overview'
  return 'overview'
}

/** Wrapper div that shows/hides content based on active tab.
 * Uses CSS display (hidden / contents) so child components stay mounted —
 * critical for live log viewers and WebSocket subscriptions that must keep
 * receiving data even when their tab is not active. */
export function WorkbenchPanel({
  tab,
  activeTab,
  children,
}: {
  tab: WorkbenchTab
  activeTab: WorkbenchTab
  children: React.ReactNode
}) {
  // "contents" makes the div layout-transparent when active (no extra box),
  // "hidden" keeps children mounted but invisible when inactive.
  return (
    <div className={activeTab !== tab ? 'hidden' : 'contents'}>
      {children}
    </div>
  )
}
