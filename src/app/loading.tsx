/**
 * Global Loading State — M96
 * Shown during page transitions in Next.js App Router.
 */

export default function GlobalLoading() {
  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="flex gap-1.5">
          {[0, 1, 2].map(d => (
            <span
              key={d}
              className="h-2 w-2 rounded-full bg-violet-500 animate-bounce"
              style={{ animationDelay: `${d * 150}ms` }}
            />
          ))}
        </div>
        <p className="text-xs text-slate-600">ForgePilot lädt…</p>
      </div>
    </div>
  )
}
