'use client'
import { Command } from 'cmdk'
import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'

interface CommandItem {
  id: string
  label: string
  description?: string
  shortcut?: string
  action: () => void
  group: string
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  const navigate = useCallback((path: string) => {
    router.push(path)
    setOpen(false)
  }, [router])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen(prev => !prev)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [])

  const commands: CommandItem[] = [
    // Navigation
    { id: 'nav-home', label: 'Command Center', description: 'Go to home', action: () => navigate('/'), group: 'Navigation' },
    { id: 'nav-briefs', label: 'Project Briefs', description: 'Manage briefs', action: () => navigate('/project-briefs'), group: 'Navigation' },
    { id: 'nav-delegations', label: 'Delegations', description: 'Delegation queue', action: () => navigate('/delegations'), group: 'Navigation' },
    { id: 'nav-settings', label: 'Settings', description: 'App settings', action: () => navigate('/settings'), group: 'Navigation' },
    { id: 'nav-governance', label: 'Governance', description: 'DSGVO & audit', action: () => navigate('/governance'), group: 'Navigation' },
    { id: 'nav-analytics', label: 'Analytics', description: 'Performance metrics', action: () => navigate('/analytics'), group: 'Navigation' },
    // Actions
    { id: 'action-new-brief', label: 'New Project Brief', description: 'Create a project brief', shortcut: 'N', action: () => navigate('/project-briefs/new'), group: 'Actions' },
  ]

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-24 bg-black/60 backdrop-blur-sm"
      onClick={() => setOpen(false)}
    >
      <div
        className="w-full max-w-xl bg-gray-900 border border-gray-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <Command className="[&_[cmdk-input-wrapper]]:border-b [&_[cmdk-input-wrapper]]:border-gray-700">
          <Command.Input
            placeholder="Search commands, pages, delegations…"
            className="w-full px-4 py-3 bg-transparent text-white placeholder-gray-500 outline-none text-sm"
            autoFocus
          />
          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-gray-500">
              No results found.
            </Command.Empty>
            {['Navigation', 'Actions'].map(group => {
              const items = commands.filter(c => c.group === group)
              return (
                <Command.Group key={group} heading={group} className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:text-gray-500 [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider">
                  {items.map(item => (
                    <Command.Item
                      key={item.id}
                      value={item.label + ' ' + (item.description ?? '')}
                      onSelect={item.action}
                      className="flex items-center justify-between px-3 py-2 rounded-lg cursor-pointer text-sm text-gray-300 data-[selected=true]:bg-gray-800 data-[selected=true]:text-white"
                    >
                      <div>
                        <span>{item.label}</span>
                        {item.description && (
                          <span className="ml-2 text-gray-500 text-xs">{item.description}</span>
                        )}
                      </div>
                      {item.shortcut && (
                        <kbd className="text-xs bg-gray-800 px-1.5 py-0.5 rounded border border-gray-700 text-gray-400">
                          {item.shortcut}
                        </kbd>
                      )}
                    </Command.Item>
                  ))}
                </Command.Group>
              )
            })}
          </Command.List>
          <div className="border-t border-gray-700 px-4 py-2 flex items-center gap-4 text-xs text-gray-600">
            <span><kbd className="bg-gray-800 px-1 rounded">↑↓</kbd> Navigate</span>
            <span><kbd className="bg-gray-800 px-1 rounded">↵</kbd> Select</span>
            <span><kbd className="bg-gray-800 px-1 rounded">Esc</kbd> Close</span>
          </div>
        </Command>
      </div>
    </div>
  )
}
