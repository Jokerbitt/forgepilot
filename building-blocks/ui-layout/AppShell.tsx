// AppShell.tsx — Responsive app shell (sidebar + top bar + content).
// Destination: src/components/layout/AppShell.tsx
'use client';

import * as React from 'react';
import { LayoutDashboard, Settings, Menu, X, type LucideIcon } from 'lucide-react';
import { cn } from './cn';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

export interface AppShellProps {
  /** Application title shown in the top bar. */
  title?: string;
  /** Sidebar navigation items. Falls back to a sensible default. */
  navItems?: NavItem[];
  /** Slot for a user menu / avatar rendered on the right of the top bar. */
  userMenu?: React.ReactNode;
  children: React.ReactNode;
}

const defaultNavItems: NavItem[] = [
  { label: 'Dashboard', href: '/', icon: LayoutDashboard },
  { label: 'Settings', href: '/settings', icon: Settings },
];

export function AppShell({
  title = 'App',
  navItems = defaultNavItems,
  userMenu,
  children,
}: AppShellProps): React.JSX.Element {
  const [mobileOpen, setMobileOpen] = React.useState(false);

  const sidebar = (
    <nav className="flex h-full flex-col gap-1 p-4">
      <div className="mb-4 px-2 text-lg font-semibold text-zinc-100">{title}</div>
      {navItems.map((item) => {
        const Icon = item.icon;
        return (
          <a
            key={item.href}
            href={item.href}
            onClick={() => setMobileOpen(false)}
            className={cn(
              'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium',
              'text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100',
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {item.label}
          </a>
        );
      })}
    </nav>
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      {/* Fixed sidebar — desktop */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-zinc-800 bg-zinc-900 md:block">
        {sidebar}
      </aside>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <div className="fixed inset-0 z-40 md:hidden">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <aside className="absolute inset-y-0 left-0 w-64 border-r border-zinc-800 bg-zinc-900">
            {sidebar}
          </aside>
        </div>
      ) : null}

      {/* Main column */}
      <div className="md:pl-64">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-zinc-800 bg-zinc-950/80 px-4 backdrop-blur">
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100 md:hidden"
            aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <span className="text-sm font-semibold text-zinc-200">{title}</span>
          <div className="ml-auto flex items-center">{userMenu}</div>
        </header>

        <main className="p-6">{children}</main>
      </div>
    </div>
  );
}
