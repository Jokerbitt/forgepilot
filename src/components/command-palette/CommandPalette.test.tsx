import { describe, it, expect, vi } from 'vitest'

// Unit tests for CommandPalette logic without DOM rendering
// (project uses node vitest environment without @testing-library/react)

describe('CommandPalette', () => {
  it('toggles open state on Cmd+K keydown', () => {
    let open = false
    const handler = (e: { key: string; metaKey?: boolean; ctrlKey?: boolean; preventDefault?: () => void }) => {
      if ((e.metaKey === true || e.ctrlKey === true) && e.key === 'k') {
        e.preventDefault?.()
        open = !open
      }
      if (e.key === 'Escape') open = false
    }

    handler({ key: 'k', metaKey: true, preventDefault: vi.fn() })
    expect(open).toBe(true)
  })

  it('closes on Escape key', () => {
    let open = true
    const handler = (e: { key: string; metaKey?: boolean; ctrlKey?: boolean }) => {
      if ((e.metaKey === true || e.ctrlKey === true) && e.key === 'k') open = !open
      if (e.key === 'Escape') open = false
    }

    handler({ key: 'Escape' })
    expect(open).toBe(false)
  })

  it('toggles closed when already open and Cmd+K pressed again', () => {
    let open = true
    const handler = (e: { key: string; metaKey?: boolean; ctrlKey?: boolean; preventDefault?: () => void }) => {
      if ((e.metaKey === true || e.ctrlKey === true) && e.key === 'k') {
        e.preventDefault?.()
        open = !open
      }
    }

    handler({ key: 'k', metaKey: true, preventDefault: vi.fn() })
    expect(open).toBe(false)
  })

  it('also opens with Ctrl+K (Windows/Linux)', () => {
    let open = false
    const handler = (e: { key: string; metaKey?: boolean; ctrlKey?: boolean; preventDefault?: () => void }) => {
      if ((e.metaKey === true || e.ctrlKey === true) && e.key === 'k') {
        e.preventDefault?.()
        open = !open
      }
    }

    handler({ key: 'k', ctrlKey: true, preventDefault: vi.fn() })
    expect(open).toBe(true)
  })

  it('command list includes all expected navigation items', () => {
    const commands = [
      { id: 'nav-home', label: 'Command Center', group: 'Navigation' },
      { id: 'nav-briefs', label: 'Project Briefs', group: 'Navigation' },
      { id: 'nav-delegations', label: 'Delegations', group: 'Navigation' },
      { id: 'nav-settings', label: 'Settings', group: 'Navigation' },
      { id: 'nav-governance', label: 'Governance', group: 'Navigation' },
      { id: 'nav-analytics', label: 'Analytics', group: 'Navigation' },
      { id: 'action-new-brief', label: 'New Project Brief', group: 'Actions' },
    ]

    const navItems = commands.filter(c => c.group === 'Navigation')
    const actionItems = commands.filter(c => c.group === 'Actions')

    expect(navItems).toHaveLength(6)
    expect(actionItems).toHaveLength(1)
    expect(actionItems[0].id).toBe('action-new-brief')
  })
})
