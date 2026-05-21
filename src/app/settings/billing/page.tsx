'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Banknote, CheckCircle2, CircleAlert, CreditCard, ShieldCheck } from 'lucide-react'
import { Badge, Panel, StatusDot, buttonClassName, cx } from '@/components/ui/primitives'
import type { BillingPlan, BillingStatus } from '@/lib/billing/status'

const readinessText = {
  ready: 'Bereit',
  partial: 'Teilweise konfiguriert',
  missing: 'Nicht konfiguriert',
} satisfies Record<BillingStatus['readiness'], string>

export default function BillingSettingsPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/billing/status')
      .then(res => res.json())
      .then((data: BillingStatus) => setStatus(data))
      .finally(() => setLoading(false))
  }, [])

  return (
    <main className="min-h-screen bg-[#07070c] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-white/[0.06] pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-cyan-300">Billing readiness</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-3xl">Abrechnung & Plaene</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
              Sicherer Stripe-Stub fuer Pricing, Webhook-Grenze und spaetere Subscription-State-Integration.
            </p>
          </div>
          <Link href="/saas-readiness" className={buttonClassName('secondary')}>
            SaaS Readiness
            <ArrowRight className="h-4 w-4" />
          </Link>
        </header>

        {loading || !status ? (
          <Panel className="p-5 text-sm text-slate-400">Billing Status wird geladen...</Panel>
        ) : (
          <>
            <section className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
              <Panel className="p-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <StatusDot tone={status.readiness === 'ready' ? 'success' : status.readiness === 'partial' ? 'warning' : 'danger'} />
                      <p className="text-sm font-semibold text-slate-300">{readinessText[status.readiness]}</p>
                    </div>
                    <p className="mt-3 text-3xl font-semibold text-white">Stripe {status.mode}</p>
                    <p className="mt-1 text-xs text-slate-500">Secrets werden nur als Boolean-Status angezeigt.</p>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04] text-cyan-300">
                    <CreditCard className="h-5 w-5" />
                  </div>
                </div>
                <div className="mt-5 grid gap-2">
                  <ConfigRow label="Secret Key" ok={status.stripe.secretKeyConfigured} />
                  <ConfigRow label="Webhook Secret" ok={status.stripe.webhookSecretConfigured} />
                  <ConfigRow label="Price IDs" ok={status.stripe.priceIdsConfigured} />
                  <ConfigRow label="Customer Portal" ok={status.stripe.customerPortalConfigured} />
                </div>
              </Panel>

              <Panel className="p-5">
                <div className="mb-4 flex items-center gap-2">
                  <CircleAlert className="h-4 w-4 text-amber-300" />
                  <h2 className="text-sm font-semibold text-white">Naechste Schritte</h2>
                </div>
                <div className="grid gap-2">
                  {(status.blockers.length > 0 ? status.blockers : status.nextActions.slice(0, 3)).map(item => (
                    <div key={item} className="rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2 text-sm text-slate-300">
                      {item}
                    </div>
                  ))}
                </div>
              </Panel>
            </section>

            <section className="grid gap-4 md:grid-cols-3">
              {status.plans.map(plan => (
                <PlanCard key={plan.id} plan={plan} />
              ))}
            </section>

            <Panel className="p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-violet-300" />
                <h2 className="text-sm font-semibold text-white">Sicherheitsmodell</h2>
              </div>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-400">
                Der Webhook ist absichtlich ein Stub: ohne `STRIPE_WEBHOOK_SECRET` schlaegt er geschlossen fehl.
                Echte Subscription-Zustaende werden erst gespeichert, wenn Tenant-Persistenz und Audit-Logs finalisiert sind.
              </p>
            </Panel>
          </>
        )}
      </div>
    </main>
  )
}

function ConfigRow({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-2">
      <span className="text-sm text-slate-400">{label}</span>
      <Badge tone={ok ? 'success' : 'neutral'}>{ok ? 'gesetzt' : 'fehlt'}</Badge>
    </div>
  )
}

function PlanCard({ plan }: { plan: BillingPlan }) {
  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">{plan.name}</h2>
          <p className="mt-1 text-xs leading-5 text-slate-500">{plan.audience}</p>
        </div>
        <Badge tone={plan.launchPhase === 'now' ? 'success' : plan.launchPhase === 'next' ? 'info' : 'neutral'}>
          {plan.launchPhase}
        </Badge>
      </div>
      <p className="mt-5 text-3xl font-semibold tracking-tight text-white">
        {plan.monthlyPriceUsd == null ? 'BYOK' : `$${plan.monthlyPriceUsd}`}
        <span className="ml-1 text-sm font-normal text-slate-500">/mo</span>
      </p>
      <div className="mt-5 space-y-2">
        {plan.included.map(item => (
          <div key={item} className="flex gap-2 text-sm text-slate-300">
            <CheckCircle2 className={cx('mt-0.5 h-4 w-4 shrink-0', plan.launchPhase === 'now' ? 'text-emerald-400' : 'text-slate-600')} />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </Panel>
  )
}
