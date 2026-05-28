import Link from 'next/link'
import { ArrowRight, Bot, FolderOpen, Radio, Settings, Sparkles } from 'lucide-react'
import { ConnectorHealthBar } from '@/components/command-center/ConnectorHealthBar'
import { DailyAssistantPanel } from '@/components/command-center/DailyAssistantPanel'
import { ApiKeysBanner } from '@/components/shared/ApiKeysBanner'
import { NoAIProviderBanner } from '@/components/shared/NoAIProviderBanner'
import { OnboardingBanner as OnboardingWizardBanner } from '@/components/onboarding/OnboardingBanner'
import { buttonClassName } from '@/components/ui/primitives'
import { AgentWorkbenchSummary } from '@/components/workbench/AgentWorkbenchSummary'

const assistantSteps = [
  {
    title: 'Idee beschreiben',
    body: 'Du erklärst kurz, was du bauen oder verbessern willst.',
  },
  {
    title: 'Plan bestätigen',
    body: 'ForgePilot empfiehlt App-Typ, Datenbank, MVP-Schnitt und erste Arbeitspakete.',
  },
  {
    title: 'Agenten arbeiten lassen',
    body: 'Du siehst live, was passiert, und entscheidest über Review, PR und Merge.',
  },
]

const quickLinks = [
  {
    href: '/projects',
    title: 'Projekte',
    body: 'Alle Ideen, Pläne und Delegationen pro Produkt.',
    icon: FolderOpen,
  },
  {
    href: '/live',
    title: 'Live View',
    body: 'Was Agenten gerade tun, was fertig ist und was blockiert.',
    icon: Radio,
  },
  {
    href: '/settings',
    title: 'Settings',
    body: 'Provider, lokale Modelle, GitHub, Linear und Betriebsbereitschaft.',
    icon: Settings,
  },
]

export default function Home() {
  return (
    <main className="min-h-screen text-white">
      <ConnectorHealthBar />
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5 shadow-sm shadow-black/20 sm:p-7">
            <p className="page-eyebrow">Command Center</p>
            <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Was soll ForgePilot heute für dich erledigen?
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
              Ein Hauptweg: Idee eingeben, Plan prüfen, sichere Delegationen starten und live verfolgen.
              Expertenwerkzeuge bleiben verfügbar, aber der Alltag beginnt hier.
            </p>

            <form action="/idea" className="mt-6 space-y-3">
              <label htmlFor="prompt" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Neue Idee oder nächster Wunsch
              </label>
              <textarea
                id="prompt"
                name="prompt"
                rows={5}
                placeholder="z.B. Baue eine kleine ToDo Planner WebApp mit Projekten, Prioritäten, Tagesansicht und lokaler Speicherung..."
                className="w-full resize-none rounded-xl border border-white/[0.08] bg-black/30 px-4 py-3 text-sm leading-6 text-white outline-none transition-colors placeholder:text-slate-600 focus:border-violet-400/60"
              />
              <div className="flex flex-col gap-3 sm:flex-row">
                <button type="submit" className={buttonClassName('primary', 'min-h-11 flex-1')}>
                  Plan Mode starten
                  <ArrowRight className="h-4 w-4" />
                </button>
                <Link href="/live" className={buttonClassName('secondary', 'min-h-11 flex-1')}>
                  Live View öffnen
                </Link>
              </div>
            </form>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              {assistantSteps.map((step, index) => (
                <div key={step.title} className="rounded-xl border border-white/[0.08] bg-black/20 p-4">
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-violet-500/15 text-xs font-bold text-violet-200">
                    {index + 1}
                  </span>
                  <p className="mt-3 text-sm font-semibold text-white">{step.title}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{step.body}</p>
                </div>
              ))}
            </div>
          </div>

          <aside className="space-y-5">
            <DailyAssistantPanel />
            <AgentWorkbenchSummary compact />
          </aside>
        </section>

        <section className="mt-5 grid gap-3 md:grid-cols-3">
          {quickLinks.map(item => {
            const Icon = item.icon
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 transition-colors hover:border-violet-400/30 hover:bg-violet-500/[0.045]"
              >
                <div className="flex items-center gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg border border-white/[0.08] bg-black/25 text-violet-200">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-white group-hover:text-violet-100">{item.title}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{item.body}</p>
                  </div>
                </div>
              </Link>
            )
          })}
        </section>

        <section className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <span className="grid h-9 w-9 place-items-center rounded-lg border border-emerald-500/20 bg-emerald-500/[0.08] text-emerald-200">
                <Bot className="h-4 w-4" />
              </span>
              <div>
                <p className="text-sm font-semibold text-white">Zielbild: täglicher Entwicklungs-Assistent</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  ForgePilot soll dir morgens sagen, was sinnvoll ist, sichere Aufgaben vorbereiten,
                  Agentenarbeit nachvollziehbar machen und Ergebnisse kritisch prüfen.
                </p>
              </div>
            </div>
            <Link href="/idea" className={buttonClassName('secondary', 'min-h-10 shrink-0')}>
              <Sparkles className="h-4 w-4" />
              Neue Idee planen
            </Link>
          </div>
        </section>

        <section className="mt-5 space-y-3" aria-label="Setup-Hinweise">
          <NoAIProviderBanner />
          <ApiKeysBanner />
          <OnboardingWizardBanner />
        </section>
      </div>
    </main>
  )
}
