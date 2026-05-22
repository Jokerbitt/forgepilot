export default function SetupPage() {
  return (
    <main className="min-h-screen bg-[#07070c] px-6 py-12 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-lg items-center">
        <section className="w-full rounded-xl border border-white/[0.08] bg-[#0d0d15] p-8 shadow-2xl shadow-black/30">
          {/* Header */}
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-300">
              ForgePilot
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
              ForgePilot Setup
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Konfiguriere dein sicheres lokales Passwort, um ForgePilot zu starten.
            </p>
          </div>

          {/* Step 1: env vars */}
          <div className="mb-6">
            <h2 className="mb-3 text-sm font-semibold text-slate-200">
              1. Erstelle eine{' '}
              <code className="rounded bg-slate-950 px-1 py-0.5 text-violet-300">.env.local</code>{' '}
              Datei im Projektordner
            </h2>
            <pre className="overflow-x-auto rounded-lg border border-white/[0.06] bg-[#07070c] p-4 text-xs leading-6 text-slate-300">
              <code>{`FORGEPILOT_ADMIN_EMAIL=admin@forgepilot.local
FORGEPILOT_ADMIN_PASSWORD=dein-sicheres-passwort
NEXTAUTH_SECRET=<output von: openssl rand -base64 32>`}</code>
            </pre>
          </div>

          {/* Step 2: generate secret */}
          <div className="mb-6">
            <h2 className="mb-3 text-sm font-semibold text-slate-200">
              2. Generiere einen sicheren{' '}
              <code className="rounded bg-slate-950 px-1 py-0.5 text-violet-300">NEXTAUTH_SECRET</code>
            </h2>
            <pre className="overflow-x-auto rounded-lg border border-white/[0.06] bg-[#07070c] p-4 text-xs leading-6 text-slate-300">
              <code>openssl rand -base64 32</code>
            </pre>
            <p className="mt-2 text-xs text-slate-500">
              Den Output kopieren und als{' '}
              <code className="rounded bg-slate-950 px-1 py-0.5 text-slate-400">NEXTAUTH_SECRET</code>{' '}
              eintragen.
            </p>
          </div>

          {/* Step 3: restart */}
          <div className="mb-8">
            <h2 className="mb-3 text-sm font-semibold text-slate-200">
              3. Optional: feste URL fuer lokale Nutzung setzen
            </h2>
            <pre className="overflow-x-auto rounded-lg border border-white/[0.06] bg-[#07070c] p-4 text-xs leading-6 text-slate-300">
              <code>NEXTAUTH_URL=http://localhost:3000</code>
            </pre>
            <p className="mt-2 text-xs text-slate-500">
              Passe den Port an, wenn ForgePilot z.B. auf{' '}
              <code className="rounded bg-slate-950 px-1 py-0.5 text-slate-400">3026</code>{' '}
              laeuft.
            </p>
          </div>

          {/* Step 4: restart */}
          <div className="mb-8">
            <h2 className="mb-3 text-sm font-semibold text-slate-200">
              4. Entwicklungsserver neu starten und Readiness pruefen
            </h2>
            <pre className="overflow-x-auto rounded-lg border border-white/[0.06] bg-[#07070c] p-4 text-xs leading-6 text-slate-300">
              <code>{`npm run dev
curl http://localhost:3000/api/auth/readiness`}</code>
            </pre>
          </div>

          {/* Divider */}
          <div className="mb-6 border-t border-white/[0.06]" />

          {/* Docs link */}
          <div className="mb-4 text-sm text-slate-400">
            Weitere Informationen findest du in der{' '}
            <a
              href="https://github.com/Jokerbitt/forgepilot#readme"
              target="_blank"
              rel="noopener noreferrer"
              className="text-violet-400 underline underline-offset-2 hover:text-violet-300"
            >
              Dokumentation
            </a>
            .
          </div>

          {/* Footer: explicit local-only bypass hint */}
          <p className="text-xs leading-5 text-slate-600">
            Unsicherer Dev-Bypass nur fuer isolierte lokale Tests, in Production ignoriert:{' '}
            <code className="rounded bg-slate-950 px-1 py-0.5 text-slate-400">
              FORGEPILOT_AUTH_DISABLED=true
            </code>
          </p>
        </section>
      </div>
    </main>
  )
}
