import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-950 p-8">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-widest text-slate-500">404</p>
        <h1 className="mt-4 text-3xl font-semibold text-white">Seite nicht gefunden</h1>
        <p className="mt-4 text-sm text-slate-400">
          Diese Seite existiert nicht oder wurde verschoben.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-lg border border-white/10 bg-white/5 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10"
      >
        Zurück zur Startseite
      </Link>
    </div>
  )
}
