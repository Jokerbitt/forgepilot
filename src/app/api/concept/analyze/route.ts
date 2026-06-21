export const dynamic = 'force-dynamic'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth/require-auth'
import { spawnSync } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { generateText, stripJsonCodeFence } from '@/lib/ai/text-generation'

// ─── File text extraction ─────────────────────────────────────────────────────

function extractTextFromPdf(buffer: Buffer): string {
  const tmp = path.join(os.tmpdir(), `fp-concept-${Date.now()}.pdf`)
  try {
    fs.writeFileSync(tmp, buffer)
    // Try pdftotext (poppler-utils) first
    const result = spawnSync('pdftotext', [tmp, '-'], { timeout: 15_000, maxBuffer: 4 * 1024 * 1024 })
    if (result.status === 0 && result.stdout) return result.stdout.toString().trim()
    // Fallback: strings command (crude but works)
    const strings = spawnSync('strings', [tmp], { timeout: 5_000, maxBuffer: 2 * 1024 * 1024 })
    if (strings.status === 0 && strings.stdout) return strings.stdout.toString().trim().slice(0, 8000)
    return '[PDF-Inhalt konnte nicht extrahiert werden — pdftotext nicht installiert]'
  } finally {
    try { fs.unlinkSync(tmp) } catch { /* ignore */ }
  }
}

async function extractText(
  buffer: Buffer,
  filename: string,
  mimeType: string,
): Promise<{ text: string; isImage: boolean; base64?: string }> {
  const name = filename.toLowerCase()

  if (mimeType.startsWith('image/') || name.match(/\.(png|jpg|jpeg|webp|gif)$/)) {
    return { text: '', isImage: true, base64: buffer.toString('base64') }
  }

  if (mimeType === 'application/pdf' || name.endsWith('.pdf')) {
    return { text: extractTextFromPdf(buffer), isImage: false }
  }

  // Plain text / markdown / code
  return { text: buffer.toString('utf-8').slice(0, 12000), isImage: false }
}

// ─── Analysis prompt ──────────────────────────────────────────────────────────

const ANALYSIS_SYSTEM = `You are a senior product manager and software architect at a top-tier startup.
Your job: analyze a concept document and produce a structured project plan with milestones and tasks.

Output ONLY valid JSON — no markdown fences, no explanation. The JSON schema:
{
  "projectName": "string",
  "summary": "2-3 sentence summary of the core idea",
  "appType": "webapp|mobile|desktop|api|cli|other",
  "stack": { "frontend": "string|null", "backend": "string|null", "database": "string|null" },
  "mvpScope": "What the MVP should include (1 paragraph)",
  "milestones": [
    {
      "id": "m1",
      "title": "string",
      "description": "string",
      "estimatedDays": number,
      "tasks": [
        { "id": "t1", "title": "string", "type": "feature|bugfix|docs|test|infra", "estimatedHours": number }
      ]
    }
  ],
  "risks": ["string"],
  "recommendations": ["string"],
  "nextStep": "The single most important thing to do first"
}

Rules:
- 3-5 milestones, each with 3-6 tasks
- Be concrete and actionable, not generic
- Stack recommendations should match the project type
- Risks must be specific to THIS project
- nextStep must be a specific, executable action`

// ─── Route handler ────────────────────────────────────────────────────────────

export interface ConceptAnalysis {
  projectName: string
  summary: string
  appType: string
  stack: { frontend: string | null; backend: string | null; database: string | null }
  mvpScope: string
  milestones: Array<{
    id: string
    title: string
    description: string
    estimatedDays: number
    tasks: Array<{ id: string; title: string; type: string; estimatedHours: number }>
  }>
  risks: string[]
  recommendations: string[]
  nextStep: string
  // Meta
  sourceFile: string
  analyzedAt: string
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
  const textInput = formData.get('text') as string | null

  let extractedText = ''
  let sourceFile = 'text-input'
  let isImage = false
  let imageBase64: string | undefined
  let imageMime: string | undefined

  if (file && file.size > 0) {
    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: 'Datei zu groß (max. 10 MB)' }, { status: 400 })
    }
    const buffer = Buffer.from(await file.arrayBuffer())
    const extracted = await extractText(buffer, file.name, file.type)
    extractedText = extracted.text
    isImage = extracted.isImage
    imageBase64 = extracted.base64
    imageMime = file.type
    sourceFile = file.name
  } else if (textInput?.trim()) {
    extractedText = textInput.trim().slice(0, 12000)
    sourceFile = 'text-input'
  } else {
    return NextResponse.json({ error: 'Keine Datei oder Text übergeben' }, { status: 400 })
  }

  // Build the prompt
  let userPrompt: string
  if (isImage && imageBase64) {
    userPrompt = `Analyze this concept image/screenshot and produce a structured project plan.`
  } else {
    userPrompt = `Analyze this concept document and produce a structured project plan:\n\n---\n${extractedText}\n---`
  }

  let raw: string
  try {
    // For images: use Anthropic directly with vision
    if (isImage && imageBase64) {
      const Anthropic = (await import('@anthropic-ai/sdk')).default
      const { readStoredApiKeys } = await import('@/lib/connectors/config')
      const keys = readStoredApiKeys()
      const apiKey = keys.ANTHROPIC_API_KEY?.trim()
      if (!apiKey) return NextResponse.json({ error: 'Anthropic API Key benötigt für Bild-Analyse' }, { status: 400 })
      const client = new Anthropic({ apiKey })
      const msg = await client.messages.create({
        model: 'claude-sonnet-4-5',
        max_tokens: 2000,
        system: ANALYSIS_SYSTEM,
        messages: [{
          role: 'user',
          content: [
            { type: 'image', source: { type: 'base64', media_type: (imageMime ?? 'image/png') as 'image/png', data: imageBase64 } },
            { type: 'text', text: userPrompt },
          ],
        }],
      })
      raw = msg.content.find(b => b.type === 'text')?.text ?? ''
    } else {
      const result = await generateText({
        system: ANALYSIS_SYSTEM,
        prompt: userPrompt,
        maxTokens: 2000,
        purpose: 'fast',
      })
      raw = result.text
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: `KI-Analyse fehlgeschlagen: ${msg}` }, { status: 502 })
  }

  let analysis: ConceptAnalysis
  try {
    const parsed = JSON.parse(stripJsonCodeFence(raw)) as ConceptAnalysis
    analysis = {
      ...parsed,
      sourceFile,
      analyzedAt: new Date().toISOString(),
    }
  } catch {
    return NextResponse.json({ error: 'KI-Antwort konnte nicht geparst werden', raw: raw.slice(0, 500) }, { status: 502 })
  }

  return NextResponse.json(analysis)
}
