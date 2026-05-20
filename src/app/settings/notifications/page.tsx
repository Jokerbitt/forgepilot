'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import type { NotificationPreferences } from '@/lib/models/notification-preferences'
import { NOTIFICATION_TYPE_LABELS, NOTIFICATION_GROUPS } from '@/lib/models/notification-preferences'
import type { NotificationType } from '@/lib/models/notification'

// ─── Toggle component ─────────────────────────────────────────────────────────

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
  label: string
  description?: string
}

function Toggle({ checked, onChange, disabled, label, description }: ToggleProps) {
  return (
    <label className="flex items-start gap-3 cursor-pointer group">
      <div className="relative mt-0.5 shrink-0">
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          disabled={disabled}
          onClick={() => !disabled && onChange(!checked)}
          className={[
            'w-10 h-6 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
            checked && !disabled ? 'bg-blue-600' : 'bg-gray-600',
            disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer',
          ].join(' ')}
        >
          <span
            className={[
              'block w-4 h-4 bg-white rounded-full shadow transition-transform mx-1',
              checked ? 'translate-x-4' : 'translate-x-0',
            ].join(' ')}
          />
        </button>
      </div>
      <div className="flex-1 min-w-0">
        <span className={['text-sm font-medium', disabled ? 'text-gray-500' : 'text-gray-100'].join(' ')}>
          {label}
        </span>
        {description && (
          <p className="text-xs text-gray-500 mt-0.5">{description}</p>
        )}
      </div>
    </label>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationSettingsPage() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/settings/notifications')
      .then(r => r.json())
      .then((data: NotificationPreferences) => setPrefs(data))
      .catch(() => setError('Einstellungen konnten nicht geladen werden.'))
  }, [])

  async function savePrefs(patch: Partial<Omit<NotificationPreferences, 'updatedAt'>>) {
    if (!prefs) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/settings/notifications', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      })
      if (!res.ok) throw new Error('Speichern fehlgeschlagen')
      const updated = (await res.json()) as NotificationPreferences
      setPrefs(updated)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError('Einstellungen konnten nicht gespeichert werden.')
    } finally {
      setSaving(false)
    }
  }

  function handleGlobalToggle(field: 'muteAll' | 'showBadge', value: boolean) {
    if (!prefs) return
    const patch = { [field]: value }
    setPrefs(prev => prev ? { ...prev, ...patch } : prev)
    void savePrefs(patch)
  }

  function handleTypeToggle(type: NotificationType, value: boolean) {
    if (!prefs) return
    const types = { ...prefs.types, [type]: value }
    setPrefs(prev => prev ? { ...prev, types } : prev)
    void savePrefs({ types: { [type]: value } as Record<NotificationType, boolean> })
  }

  const allTypesEnabled = prefs
    ? Object.values(prefs.types).every(Boolean)
    : true

  function handleToggleAll(enable: boolean) {
    if (!prefs) return
    const types = Object.fromEntries(
      (Object.keys(prefs.types) as NotificationType[]).map(k => [k, enable]),
    ) as Record<NotificationType, boolean>
    setPrefs(prev => prev ? { ...prev, types } : prev)
    void savePrefs({ types })
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 px-6 py-4 flex items-center gap-4">
        <Link href="/settings" className="text-gray-400 hover:text-gray-200 text-sm">
          ← Einstellungen
        </Link>
        <h1 className="text-lg font-semibold">Benachrichtigungen</h1>
        {saved && (
          <span className="ml-auto text-xs text-green-400 font-medium">✓ Gespeichert</span>
        )}
        {saving && (
          <span className="ml-auto text-xs text-gray-500">Speichere…</span>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-8">
        {error && (
          <div className="bg-red-900/30 border border-red-700/50 rounded-lg px-4 py-3 text-sm text-red-300">
            {error}
          </div>
        )}

        {!prefs ? (
          <div className="text-gray-500 text-sm py-12 text-center">Lade Einstellungen…</div>
        ) : (
          <>
            {/* Global settings */}
            <section>
              <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4">
                Globale Einstellungen
              </h2>
              <div className="bg-gray-900 border border-gray-800 rounded-xl divide-y divide-gray-800">
                <div className="px-5 py-4">
                  <Toggle
                    checked={!prefs.muteAll}
                    onChange={v => handleGlobalToggle('muteAll', !v)}
                    label="Benachrichtigungen aktiviert"
                    description="Alle Benachrichtigungstypen stumm schalten oder aktivieren"
                  />
                </div>
                <div className="px-5 py-4">
                  <Toggle
                    checked={prefs.showBadge}
                    onChange={v => handleGlobalToggle('showBadge', v)}
                    disabled={prefs.muteAll}
                    label="Ungelesen-Badge auf Glocke"
                    description="Zeigt die Anzahl ungelesener Benachrichtigungen als Badge"
                  />
                </div>
              </div>
            </section>

            {/* Per-type settings */}
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-gray-400 uppercase tracking-wider">
                  Ereignistypen
                </h2>
                <button
                  onClick={() => handleToggleAll(!allTypesEnabled)}
                  disabled={prefs.muteAll}
                  className="text-xs text-blue-400 hover:text-blue-300 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {allTypesEnabled ? 'Alle deaktivieren' : 'Alle aktivieren'}
                </button>
              </div>

              <div className="space-y-4">
                {NOTIFICATION_GROUPS.map(group => (
                  <div
                    key={group.label}
                    className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden"
                  >
                    <div className="px-5 py-2.5 border-b border-gray-800 bg-gray-800/50">
                      <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
                        {group.label}
                      </span>
                    </div>
                    <div className="divide-y divide-gray-800/60">
                      {group.types.map(type => (
                        <div key={type} className="px-5 py-3.5">
                          <Toggle
                            checked={prefs.types[type] ?? true}
                            onChange={v => handleTypeToggle(type, v)}
                            disabled={prefs.muteAll}
                            label={NOTIFICATION_TYPE_LABELS[type]}
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Footer info */}
            <p className="text-xs text-gray-600 text-center pb-4">
              Zuletzt aktualisiert:{' '}
              {new Date(prefs.updatedAt).toLocaleString('de-DE')}
            </p>
          </>
        )}
      </main>
    </div>
  )
}
