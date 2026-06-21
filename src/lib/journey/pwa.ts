/**
 * Journey Companion — Phase 4.4: Mobile / PWA.
 *
 * Turns a generated web app into an installable Progressive Web App so it can
 * live on a phone's home screen and start offline — a reach jump beyond the
 * browser. Two parts:
 *  - checkPwa(): read-only heuristic ("ist die App schon fürs Handy bereit?")
 *  - buildManifest()/buildServiceWorker()/pwaPlanStep(): deterministic content
 *    handed to the existing plan executor so an agent writes the files (no
 *    parallel file-writing logic in a route).
 *
 * The builders are pure (string in/out); checkPwa reads the target repo
 * read-only, like responsive-check.
 */
import fs from 'fs'
import path from 'path'

export interface PwaReport {
  score: number
  hasManifest: boolean
  hasServiceWorker: boolean
  /** Installable as a phone app = manifest + service worker both present. */
  installable: boolean
  findings: string[]
  summary: string
}

export interface ManifestInput {
  name: string
  shortName?: string
  themeColor?: string
  backgroundColor?: string
}

const MANIFEST_CANDIDATES = [
  'public/manifest.json',
  'public/manifest.webmanifest',
  'app/manifest.ts',
  'app/manifest.json',
  'src/app/manifest.ts',
  'src/app/manifest.json',
]
const SW_CANDIDATES = ['public/sw.js', 'public/service-worker.js', 'public/serviceworker.js']

function anyExists(repoPath: string, candidates: string[]): boolean {
  return candidates.some(rel => fs.existsSync(path.join(repoPath, rel)))
}

/** Read-only check: is the app already installable as a phone app? */
export function checkPwa(repoPath: string): PwaReport {
  if (!fs.existsSync(repoPath)) {
    return {
      score: 0,
      hasManifest: false,
      hasServiceWorker: false,
      installable: false,
      findings: ['Ziel-Ordner nicht gefunden.'],
      summary: 'Ordner nicht gefunden — bitte den Pfad prüfen.',
    }
  }

  const hasManifest = anyExists(repoPath, MANIFEST_CANDIDATES)
  const hasServiceWorker = anyExists(repoPath, SW_CANDIDATES)
  const installable = hasManifest && hasServiceWorker
  const score = (hasManifest ? 50 : 0) + (hasServiceWorker ? 50 : 0)

  const findings: string[] = []
  if (!hasManifest) findings.push('Kein App-Manifest — ohne das kann die App nicht zum Home-Bildschirm hinzugefügt werden.')
  if (!hasServiceWorker) findings.push('Kein Service-Worker — ohne den startet die App nicht offline.')

  let summary: string
  if (installable) {
    summary = '✅ Schon als App fürs Handy installierbar (Manifest + Service-Worker vorhanden).'
  } else if (score === 0) {
    summary = '❌ Noch keine Handy-App — Manifest und Service-Worker fehlen. Ein Klick richtet beides ein.'
  } else {
    summary = `⚠️ Teilweise vorbereitet (${score}/100) — ${hasManifest ? 'der Service-Worker' : 'das Manifest'} fehlt noch.`
  }

  return { score, hasManifest, hasServiceWorker, installable, findings, summary }
}

/** Build a valid web app manifest (deterministic). */
export function buildManifest(input: ManifestInput): string {
  const name = input.name.trim() || 'Meine App'
  const manifest = {
    name,
    short_name: (input.shortName?.trim() || name).slice(0, 12),
    start_url: '/',
    display: 'standalone',
    background_color: input.backgroundColor || '#ffffff',
    theme_color: input.themeColor || '#4f46e5',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
  }
  return JSON.stringify(manifest, null, 2)
}

/** Build a minimal offline-capable service worker (deterministic). */
export function buildServiceWorker(): string {
  return `// Auto-generated minimal service worker (ForgePilot PWA).
const CACHE = 'app-v1'

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add('/')))
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  event.respondWith(
    fetch(event.request)
      .then((res) => {
        const copy = res.clone()
        caches.open(CACHE).then((cache) => cache.put(event.request, copy))
        return res
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('/'))),
  )
})
`
}

/**
 * Build the executor step for "make this an installable PWA". The exact file
 * contents are embedded so the agent writes them deterministically.
 */
export function pwaPlanStep(appName: string): { title: string; description: string } {
  const name = appName.trim() || 'Die App'
  const manifest = buildManifest({ name })
  const sw = buildServiceWorker()
  return {
    title: 'Als App fürs Handy einrichten (PWA)',
    description: [
      `Mache „${name}" zu einer installierbaren Progressive Web App (PWA), damit sie sich auf dem Handy zum Home-Bildschirm hinzufügen lässt und offline startet. Bestehendes Verhalten erhalten; Build muss grün bleiben und Tests bestehen.`,
      '',
      '1) Lege die Manifest-Datei `public/manifest.webmanifest` mit genau diesem Inhalt an:',
      '```json',
      manifest,
      '```',
      '2) Lege den Service-Worker `public/sw.js` mit genau diesem Inhalt an:',
      '```js',
      sw,
      '```',
      '3) Verlinke das Manifest und registriere den Service-Worker: bei Next.js App Router `export const metadata = { manifest: "/manifest.webmanifest" }` (bzw. ergänzen) im Root-Layout und ein kleines Client-Snippet `if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js")`; sonst `<link rel="manifest" href="/manifest.webmanifest">` plus `<meta name="theme-color" content="#4f46e5">` im <head>.',
      '4) Lege einfarbige Platzhalter-Icons `public/icons/icon-192.png` und `public/icons/icon-512.png` passend zu den Manifest-Einträgen an.',
    ].join('\n'),
  }
}
