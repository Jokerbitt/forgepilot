export const dynamic = 'force-dynamic'

/**
 * POST /api/reverse/screenshot — multipart FormData { file: image }
 * Returns: ScreenshotHints
 *
 * Reverse-engineering screenshot ingest: a vision model describes an existing
 * app's UI (screens, features, UI elements) so the hints can seed the rebuild.
 * Reuses the proven /api/concept/analyze vision pattern (Anthropic + base64).
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import {
  SCREENSHOT_SYSTEM,
  SCREENSHOT_USER_PROMPT,
  parseScreenshotHints,
  isEmptyHints,
} from '@/lib/reverse/screenshot-ingest'

const MAX_BYTES = 10 * 1024 * 1024

type SupportedMedia = 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'

function mediaTypeFor(file: File): SupportedMedia {
  const t = file.type.toLowerCase()
  if (t === 'image/jpeg' || t === 'image/jpg' || /\.jpe?g$/i.test(file.name)) return 'image/jpeg'
  if (t === 'image/webp' || /\.webp$/i.test(file.name)) return 'image/webp'
  if (t === 'image/gif' || /\.gif$/i.test(file.name)) return 'image/gif'
  return 'image/png'
}

export async function POST(req: NextRequest) {
  const authError = await requireAuth()
  if (authError) return authError

  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return NextResponse.json({ error: 'Multipart-Formular erwartet' }, { status: 400 })
  }

  const file = formData.get('file') as File | null
  if (!file || file.size === 0) return NextResponse.json({ error: 'Kein Screenshot übergeben' }, { status: 400 })
  if (file.size > MAX_BYTES) return NextResponse.json({ error: 'Datei zu groß (max. 10 MB)' }, { status: 400 })
  const isImage = file.type.startsWith('image/') || /\.(png|jpg|jpeg|webp|gif)$/i.test(file.name)
  if (!isImage) return NextResponse.json({ error: 'Bitte ein Bild hochladen (PNG/JPG/WEBP)' }, { status: 400 })

  const base64 = Buffer.from(await file.arrayBuffer()).toString('base64')
  const mediaType = mediaTypeFor(file)

  let raw: string
  try {
    const Anthropic = (await import('@anthropic-ai/sdk')).default
    const { readStoredApiKeys } = await import('@/lib/connectors/config')
    const apiKey = readStoredApiKeys().ANTHROPIC_API_KEY?.trim()
    if (!apiKey) {
      return NextResponse.json({ error: 'Anthropic API Key benötigt für Bild-Analyse (in Settings hinterlegen).' }, { status: 400 })
    }
    const client = new Anthropic({ apiKey })
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 1500,
      system: SCREENSHOT_SYSTEM,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: mediaType, data: base64 } },
          { type: 'text', text: SCREENSHOT_USER_PROMPT },
        ],
      }],
    })
    raw = msg.content.find(b => b.type === 'text')?.text ?? ''
  } catch (err) {
    const m = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `Bild-Analyse fehlgeschlagen: ${m}` }, { status: 502 })
  }

  const hints = parseScreenshotHints(raw)
  if (isEmptyHints(hints)) {
    return NextResponse.json({ error: 'Keine UI-Hinweise aus dem Screenshot erkannt.', raw: raw.slice(0, 300) }, { status: 502 })
  }
  return NextResponse.json(hints)
}
