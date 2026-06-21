// 'use client' settings page: theme, AI-mode, notifications, and masked API keys.
// Destination: src/app/settings/page.tsx (or a component under src/components/)

'use client';

import { useCallback, useEffect, useState } from 'react';

import type {
  AiMode,
  Settings,
  SettingsPatch,
  Theme,
} from '@/lib/settings/settings-schema';

const THEME_OPTIONS: ReadonlyArray<{ value: Theme; label: string }> = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

const AI_MODE_OPTIONS: ReadonlyArray<{
  value: AiMode;
  label: string;
  description: string;
}> = [
  {
    value: 'auto',
    label: 'Auto',
    description: 'Pick the best engine automatically based on the task.',
  },
  {
    value: 'local',
    label: 'Local',
    description: 'Run models on-device. Private, no data leaves the machine.',
  },
  {
    value: 'cloud',
    label: 'Cloud',
    description: 'Use a hosted provider for maximum capability.',
  },
];

type Status = 'idle' | 'loading' | 'saving' | 'error';

export default function SettingsPage(): React.JSX.Element {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [status, setStatus] = useState<Status>('loading');
  const [newKeyProvider, setNewKeyProvider] = useState('');
  const [newKeyValue, setNewKeyValue] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const res = await fetch('/api/settings');
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as Settings;
        if (!cancelled) {
          setSettings(data);
          setStatus('idle');
        }
      } catch {
        if (!cancelled) setStatus('error');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const patch = useCallback(async (changes: SettingsPatch) => {
    setStatus('saving');
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(changes),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as Settings;
      setSettings(data);
      setStatus('idle');
    } catch {
      setStatus('error');
    }
  }, []);

  if (status === 'loading' || settings === null) {
    return (
      <main className="min-h-screen bg-neutral-950 p-8 text-neutral-400">
        Loading settings…
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-neutral-950 px-6 py-10 text-neutral-100">
      <div className="mx-auto flex max-w-2xl flex-col gap-10">
        <header className="flex items-baseline justify-between">
          <h1 className="text-2xl font-semibold">Settings</h1>
          <span className="text-sm text-neutral-500" aria-live="polite">
            {status === 'saving' && 'Saving…'}
            {status === 'error' && (
              <span className="text-red-400">Something went wrong</span>
            )}
          </span>
        </header>

        {/* Theme */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-400">
            Theme
          </h2>
          <div className="flex gap-2">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => void patch({ theme: opt.value })}
                className={`rounded-lg border px-4 py-2 text-sm transition ${
                  settings.theme === opt.value
                    ? 'border-indigo-500 bg-indigo-500/15 text-indigo-200'
                    : 'border-neutral-800 bg-neutral-900 text-neutral-300 hover:border-neutral-700'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </section>

        {/* AI mode */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-400">
            AI mode
          </h2>
          <div className="grid gap-2">
            {AI_MODE_OPTIONS.map((opt) => {
              const active = settings.aiMode === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => void patch({ aiMode: opt.value })}
                  className={`flex flex-col items-start rounded-lg border px-4 py-3 text-left transition ${
                    active
                      ? 'border-indigo-500 bg-indigo-500/15'
                      : 'border-neutral-800 bg-neutral-900 hover:border-neutral-700'
                  }`}
                >
                  <span className="text-sm font-medium text-neutral-100">
                    {opt.label}
                  </span>
                  <span className="text-xs text-neutral-400">
                    {opt.description}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Notifications */}
        <section className="flex items-center justify-between">
          <div className="flex flex-col">
            <h2 className="text-sm font-medium text-neutral-100">
              Notifications
            </h2>
            <p className="text-xs text-neutral-400">
              Receive alerts for important events.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.notificationsEnabled}
            onClick={() =>
              void patch({
                notificationsEnabled: !settings.notificationsEnabled,
              })
            }
            className={`relative h-6 w-11 rounded-full transition ${
              settings.notificationsEnabled
                ? 'bg-indigo-500'
                : 'bg-neutral-700'
            }`}
          >
            <span
              className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition ${
                settings.notificationsEnabled ? 'left-[22px]' : 'left-0.5'
              }`}
            />
          </button>
        </section>

        {/* API keys */}
        <section className="flex flex-col gap-3">
          <h2 className="text-sm font-medium uppercase tracking-wide text-neutral-400">
            API keys
          </h2>
          <p className="text-xs text-neutral-400">
            Keys are stored server-side and shown masked. Enter a value to
            replace an existing key.
          </p>

          <ul className="flex flex-col gap-2">
            {Object.entries(settings.apiKeys).map(([provider, masked]) => (
              <li
                key={provider}
                className="flex items-center justify-between rounded-lg border border-neutral-800 bg-neutral-900 px-4 py-2"
              >
                <span className="text-sm text-neutral-200">{provider}</span>
                <code className="text-xs text-neutral-500">
                  {masked || '—'}
                </code>
              </li>
            ))}
            {Object.keys(settings.apiKeys).length === 0 && (
              <li className="text-xs text-neutral-500">No keys configured.</li>
            )}
          </ul>

          <form
            className="flex flex-col gap-2 sm:flex-row"
            onSubmit={(e) => {
              e.preventDefault();
              const provider = newKeyProvider.trim();
              if (provider.length === 0 || newKeyValue.length === 0) return;
              void patch({
                apiKeys: { ...settings.apiKeys, [provider]: newKeyValue },
              });
              setNewKeyProvider('');
              setNewKeyValue('');
            }}
          >
            <input
              type="text"
              value={newKeyProvider}
              onChange={(e) => setNewKeyProvider(e.target.value)}
              placeholder="Provider (e.g. openai)"
              className="flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-indigo-500 focus:outline-none"
            />
            <input
              type="password"
              value={newKeyValue}
              onChange={(e) => setNewKeyValue(e.target.value)}
              placeholder="sk-…"
              autoComplete="off"
              className="flex-1 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-indigo-500 focus:outline-none"
            />
            <button
              type="submit"
              className="rounded-lg bg-indigo-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-400"
            >
              Save key
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
