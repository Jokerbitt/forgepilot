import { LoginForm } from './LoginForm'

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#07070c] px-6 py-12 text-white">
      <div className="mx-auto flex min-h-[calc(100vh-6rem)] w-full max-w-md items-center">
        <section className="w-full rounded-xl border border-white/[0.08] bg-[#0d0d15] p-6 shadow-2xl shadow-black/30">
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-violet-300">ForgePilot</p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">Workspace Login</h1>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Melde dich an, um Agenten, Delegationen, Settings und lokale Projektsteuerung zu verwalten.
            </p>
          </div>
          <LoginForm />
          <p className="mt-5 text-xs leading-5 text-slate-500">
            Aktiv wenn <code className="rounded bg-slate-950 px-1 py-0.5 text-slate-300">FORGEPILOT_AUTH_ENABLED=true</code> gesetzt ist.
          </p>
        </section>
      </div>
    </main>
  )
}
