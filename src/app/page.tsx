import Link from 'next/link'
import { ArrowRight, BookOpen, CheckCircle2, FileText, ListChecks, Settings, Sparkles } from 'lucide-react'
import { ConnectorHealthBar } from '@/components/command-center/ConnectorHealthBar'
import { ApiKeysBanner } from '@/components/shared/ApiKeysBanner'
import { NoAIProviderBanner } from '@/components/shared/NoAIProviderBanner'
import { OnboardingBanner as OnboardingWizardBanner } from '@/components/onboarding/OnboardingBanner'
import { buttonClassName, cx } from '@/components/ui/primitives'

const mainFlow = [
  {
    title: 'Idee beschreiben',
    body: 'Du schreibst in normaler Sprache, was du bauen oder verbessern willst.',
    href: '/idea',
    icon: Sparkles,
  },
  {
    title: 'Plan Mode',
    body: 'ForgePilot strukturiert Nutzen, Zielgruppe, MVP-Schnitt, Risiken und nächste Schritte.',
    href: '/idea',
    icon: FileText,
  },
  {
    title: 'Ausführung',
    body: 'Aus dem Plan entstehen klare Delegationen mit Scope, Review und PR.',
    href: '/delegations',
    icon: ListChecks,
  },
  {
    title: 'Wissen sichern',
    body: 'Gute Ergebnisse werden als wiederverwendbares Projektwissen gespeichert.',
    href: '/knowledge',
    icon: BookOpen,
  },
]

const recommendationCards = [
  {
    title: 'Starte mit einer klaren Idee',
    body: 'Beschreibe Problem, Ziel und wer davon profitiert. ForgePilot macht daraus einen verwertbaren Plan.',
    tone: 'primary',
  },
  {
    title: 'Erst planen, dann delegieren',
    body: 'Agenten sollen erst arbeiten, wenn Nutzen, Scope und Abnahmekriterien eindeutig sind.',
    tone: 'neutral',
  },
  {
    title: 'Nur das Nötige anzeigen',
    body: 'Details wie Agent Board, Governance und Analytics bleiben unter “More”, bis du sie brauchst.',
    tone: 'neutral',
  },
] as const

export default function Home() {
  return (
    <main className="min-h-screen text-white">
      <ConnectorHealthBar />
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <section className="rounded-2xl border border-white/[0.08] bg-white/[0.035] p-5 shadow-sm shadow-black/20 sm:p-7">
          <div className="grid gap-7 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
            <div>
              <p className="page-eyebrow">Command Center</p>
              <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                Beschreibe deine Idee. ForgePilot macht daraus einen Plan.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-slate-400">
                Fokus auf einen einfachen Ablauf: Idee verstehen, Nutzen klären, MVP schneiden,
                nächste Schritte empfehlen und erst dann KI-Agenten ausführen lassen.
              </p>

              <form action="/idea" className="mt-6 space-y-3">
                <label htmlFor="prompt" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Was möchtest du bauen oder verbessern?
                </label>
                <textarea
                  id="prompt"
                  name="prompt"
                  rows={5}
                  placeholder="z.B. Ich möchte eine App entwickeln, die lokale KI-Agenten für Softwareentwicklung koordiniert und mir jeden Tag klare Empfehlungen gibt..."
                  className="w-full resize-none rounded-xl border border-white/[0.08] bg-black/30 px-4 py-3 text-sm leading-6 text-white outline-none transition-colors placeholder:text-slate-600 focus:border-violet-400/60"
                />
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button type="submit" className={buttonClassName('primary', 'min-h-11 flex-1')}>
                    In Plan Mode starten
                    <ArrowRight className="h-4 w-4" />
                  </button>
                  <Link href="/delegations" className={buttonClassName('secondary', 'min-h-11 flex-1')}>
                    Laufende Ausführung ansehen
                  </Link>
                </div>
              </form>
            </div>

            <aside className="rounded-xl border border-violet-500/20 bg-violet-500/[0.055] p-4">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-violet-200" />
                <p className="text-sm font-semibold text-white">Nächste Empfehlung</p>
              </div>
              <p className="mt-3 text-lg font-semibold leading-7 text-white">
                Erst Plan Mode nutzen, dann Agenten beauftragen.
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                So bleibt der rote Faden erhalten: ForgePilot entscheidet nicht blind, sondern erklärt,
                was sinnvoll ist, welchen Nutzen es bringt und was zu früh wäre.
              </p>
              <Link href="/idea" className={buttonClassName('primary', 'mt-5 min-h-10 w-full')}>
                Plan Mode öffnen
              </Link>
            </aside>
          </div>
        </section>

        <section className="mt-5 grid gap-3 md:grid-cols-4">
          {mainFlow.map((step, index) => {
            const Icon = step.icon
            return (
              <Link
                key={step.title}
                href={step.href}
                className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 transition-colors hover:border-violet-400/30 hover:bg-violet-500/[0.045]"
              >
                <div className="flex items-center justify-between gap-3">
                  <span className="grid h-9 w-9 place-items-center rounded-lg border border-white/[0.08] bg-black/25 text-violet-200">
                    <Icon className="h-4 w-4" />
                  </span>
                  <span className="text-xs font-semibold text-slate-600">{index + 1}</span>
                </div>
                <p className="mt-4 text-sm font-semibold text-white">{step.title}</p>
                <p className="mt-2 text-xs leading-5 text-slate-500">{step.body}</p>
              </Link>
            )
          })}
        </section>

        <section className="mt-5 grid gap-3 lg:grid-cols-3">
          {recommendationCards.map(card => (
            <div
              key={card.title}
              className={cx(
                'rounded-xl border p-4',
                card.tone === 'primary'
                  ? 'border-emerald-500/25 bg-emerald-500/[0.045]'
                  : 'border-white/[0.08] bg-white/[0.025]'
              )}
            >
              <p className="text-sm font-semibold text-white">{card.title}</p>
              <p className="mt-2 text-xs leading-5 text-slate-500">{card.body}</p>
            </div>
          ))}
        </section>

        <section className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.025] p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold text-white">Werkzeuge bleiben verfügbar</p>
              <p className="mt-1 text-xs leading-5 text-slate-500">
                Agent Board, Analytics, Governance, Monitor und technische Details liegen unter “More”.
                Der Alltag startet hier bewusst einfacher.
              </p>
            </div>
            <Link href="/settings" className={buttonClassName('secondary', 'min-h-10 shrink-0')}>
              <Settings className="h-4 w-4" />
              Settings prüfen
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
