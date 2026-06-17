import Link from 'next/link'
import type { ElementType } from 'react'
import {
  Boxes,
  Activity,
  BarChart3,
  BookOpen,
  Bot,
  Bug,
  ClipboardList,
  Database,
  FileText,
  GitBranch,
  HeartPulse,
  Kanban,
  KeyRound,
  Network,
  Radar,
  Search,
  Settings,
  ShieldCheck,
  Wrench,
} from 'lucide-react'

type ToolTone = 'primary' | 'expert' | 'debug'

type ToolLink = {
  href: string
  title: string
  description: string
  when: string
  icon: ElementType
  tone?: ToolTone
}

const dailyTools: ToolLink[] = [
  {
    href: '/building-blocks',
    title: 'Building Blocks',
    description: 'Wiederverwendbare SaaS-Bausteine (Auth, DB, Billing, UI), die Agenten kopieren statt neu zu bauen.',
    when: 'Nutzen, um zu sehen welche Standard-Bausteine fuer neue Apps bereitstehen.',
    icon: Boxes,
    tone: 'primary',
  },
  {
    href: '/knowledge',
    title: 'Wissen',
    description: 'Gespeicherte Learnings, Writebacks und wiederverwendbarer Projektkontext.',
    when: 'Nutzen, wenn du verstehen willst, was ForgePilot aus Runs gelernt hat.',
    icon: BookOpen,
    tone: 'primary',
  },
  {
    href: '/branches',
    title: 'Branches & PRs',
    description: 'Änderungen vor dem Merge prüfen und den GitHub-Fluss kontrollieren.',
    when: 'Nutzen, wenn eine Delegation Code erzeugt oder ein PR bereit ist.',
    icon: GitBranch,
    tone: 'primary',
  },
  {
    href: '/settings',
    title: 'Einstellungen',
    description: 'Provider, lokale Runner, GitHub, Linear, Autonomie und Systemstatus.',
    when: 'Nutzen, wenn etwas nicht verbunden ist oder Autonomie angepasst werden soll.',
    icon: Settings,
    tone: 'primary',
  },
]

const expertTools: ToolLink[] = [
  {
    href: '/agents',
    title: 'Agenten',
    description: 'Rollen, Fähigkeiten und Agenten-Konfigurationen prüfen.',
    when: 'Für Feinschliff an spezialisierten KI-Agenten.',
    icon: Bot,
    tone: 'expert',
  },
  {
    href: '/orchestrations',
    title: 'Orchestrierungen',
    description: 'Mehrstufige Abläufe und Agenten-Zusammenarbeit kontrollieren.',
    when: 'Wenn eine Aufgabe mehrere koordinierte Schritte braucht.',
    icon: Network,
    tone: 'expert',
  },
  {
    href: '/active',
    title: 'Aktive Runs',
    description: 'Laufende Ausführungen und Agentenarbeit im Detail verfolgen.',
    when: 'Wenn Live View nicht genug technische Tiefe zeigt.',
    icon: Activity,
    tone: 'expert',
  },
  {
    href: '/project-briefs',
    title: 'Project Briefs',
    description: 'Briefs direkt prüfen, bearbeiten oder alte Briefs wiederverwenden.',
    when: 'Wenn du den Plan Mode umgehen oder Details nacharbeiten willst.',
    icon: FileText,
    tone: 'expert',
  },
  {
    href: '/work-items',
    title: 'Work Items',
    description: 'Tickets und Arbeitspakete als technische Queue ansehen.',
    when: 'Wenn Linear/GitHub-Sync oder Backlog-Details relevant sind.',
    icon: ClipboardList,
    tone: 'expert',
  },
  {
    href: '/model-router',
    title: 'Model Router',
    description: 'Routing zwischen Cloud, lokalen Modellen und Critic-LLMs prüfen.',
    when: 'Wenn Qualität, Kosten oder Fallbacks nicht passen.',
    icon: Radar,
    tone: 'expert',
  },
  {
    href: '/analytics',
    title: 'Kosten & Qualität',
    description: 'Budgets, Laufzeiten, Scores und Effizienzsignale auswerten.',
    when: 'Für Optimierung nach mehreren echten Runs.',
    icon: BarChart3,
    tone: 'expert',
  },
  {
    href: '/knowledge/research',
    title: 'Research',
    description: 'Recherche- und Quellenfluss für Kontextaufbau starten.',
    when: 'Wenn ein Projekt noch fachliches Vorwissen braucht.',
    icon: Search,
    tone: 'expert',
  },
  {
    href: '/context-packages',
    title: 'Context Packages',
    description: 'Agenten-Kontextpakete ansehen und gezielt vorbereiten.',
    when: 'Für komplexere Features mit mehreren Dateien oder Architekturregeln.',
    icon: Database,
    tone: 'expert',
  },
]

const debugTools: ToolLink[] = [
  {
    href: '/monitor',
    title: 'Agent Monitor',
    description: 'Technische Zustände, Runs und Health-Signale prüfen.',
    when: 'Bei unerwartetem Verhalten oder langsamen Runs.',
    icon: HeartPulse,
    tone: 'debug',
  },
  {
    href: '/agent-runs',
    title: 'Agent Run Logs',
    description: 'Historische Agentenläufe und technische Laufdetails öffnen.',
    when: 'Zur Fehlersuche nach abgebrochenen Runs.',
    icon: Bug,
    tone: 'debug',
  },
  {
    href: '/governance',
    title: 'Governance',
    description: 'Sicherheits-, Privacy- und Audit-Leitplanken überprüfen.',
    when: 'Vor produktiver Freigabe oder externem Zugriff.',
    icon: ShieldCheck,
    tone: 'debug',
  },
  {
    href: '/settings/providers',
    title: 'Provider Setup',
    description: 'AI-, GitHub-, Linear- und lokale Provider genauer konfigurieren.',
    when: 'Wenn Einstellungen eine Verbindung als fehlerhaft melden.',
    icon: KeyRound,
    tone: 'debug',
  },
  {
    href: '/dev/health',
    title: 'Dev Health',
    description: 'Entwicklungs-Healthchecks und technische Diagnose anzeigen.',
    when: 'Nur für lokale Entwicklung und Fehleranalyse.',
    icon: Wrench,
    tone: 'debug',
  },
  {
    href: '/board',
    title: 'Agent Board',
    description: 'Alternative Kanban-Sicht auf Agentenarbeit und Work Items.',
    when: 'Wenn du ein technisches Board statt Projektansicht brauchst.',
    icon: Kanban,
    tone: 'debug',
  },
]

const toneClass: Record<ToolTone, string> = {
  primary: 'border-violet-500/25 bg-violet-500/[0.06] hover:border-violet-400/45',
  expert: 'border-white/[0.08] bg-white/[0.035] hover:border-sky-400/30',
  debug: 'border-amber-500/15 bg-amber-500/[0.035] hover:border-amber-400/30',
}

function ToolCard({ tool }: { tool: ToolLink }) {
  const Icon = tool.icon
  return (
    <Link
      href={tool.href}
      className={`group rounded-lg border p-4 transition-colors ${toneClass[tool.tone ?? 'primary']}`}
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-white/[0.08] bg-black/20 text-slate-200">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-slate-100">{tool.title}</h3>
            <span className="text-slate-600 transition-colors group-hover:text-slate-300">→</span>
          </div>
          <p className="mt-1 text-sm leading-5 text-slate-400">{tool.description}</p>
          <p className="mt-3 text-xs leading-5 text-slate-600">{tool.when}</p>
        </div>
      </div>
    </Link>
  )
}

export default function ToolsPage() {
  return (
    <main className="min-h-screen bg-[#05060a] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-8">
        <header className="space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-violet-500/20 bg-violet-500/10 px-3 py-1 text-xs font-semibold text-violet-200">
            <Wrench className="h-3.5 w-3.5" />
            Werkzeug-Hub
          </div>
          <div className="max-w-3xl">
            <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl">Alles Nützliche, ohne Overload.</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Die Haupt-App bleibt auf Planen, Ausführen und Beobachten fokussiert. Spezialseiten bleiben erreichbar,
              aber gebündelt nach Alltag, Expertenmodus und System/Debug.
            </p>
          </div>
        </header>

        <section className="space-y-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">Alltag</h2>
            <p className="mt-1 text-sm text-slate-500">Diese Werkzeuge bringen im normalen Workflow den größten Nutzen.</p>
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            {dailyTools.map(tool => <ToolCard key={tool.href} tool={tool} />)}
          </div>
        </section>

        <details className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-4" open>
          <summary className="cursor-pointer list-none">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">Expertenmodus</h2>
                <p className="mt-1 text-sm text-slate-500">Für gezielte Steuerung, wenn du weißt, warum du tiefer rein willst.</p>
              </div>
              <span className="rounded-full bg-sky-500/10 px-2.5 py-1 text-xs font-semibold text-sky-300">
                {expertTools.length} Werkzeuge
              </span>
            </div>
          </summary>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {expertTools.map(tool => <ToolCard key={tool.href} tool={tool} />)}
          </div>
        </details>

        <details className="rounded-xl border border-amber-500/15 bg-amber-500/[0.025] p-4">
          <summary className="cursor-pointer list-none">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-100">System / Debug</h2>
                <p className="mt-1 text-sm text-slate-500">Eingeklappt, weil diese Seiten nur bei Problemen oder Freigaben gebraucht werden.</p>
              </div>
              <span className="rounded-full bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-300">
                selten nutzen
              </span>
            </div>
          </summary>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {debugTools.map(tool => <ToolCard key={tool.href} tool={tool} />)}
          </div>
        </details>
      </div>
    </main>
  )
}
