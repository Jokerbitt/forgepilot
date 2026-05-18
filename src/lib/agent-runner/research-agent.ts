import type { ResearchDocument, ResearchCitation, ResearchSection, SourceCredibility } from '@/lib/models/research'

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string
}

interface AnthropicResponse {
  id: string
  content: Array<{ type: 'text'; text: string }>
  usage: { input_tokens: number; output_tokens: number }
}

export interface ResearchAgentOptions {
  apiKey: string
  model?: string
  fetcher?: typeof fetch
}

const RESEARCH_SYSTEM_PROMPT = `You are an expert research analyst and knowledge synthesizer. Your task is to conduct thorough, well-sourced research on a given topic.

You produce structured research documents with:
- A concise abstract (2-3 sentences)
- 3-6 key findings (bullet points)
- 3-5 thematic sections with analysis
- Citations from credible sources

Source credibility classification:
- "academic": peer-reviewed journals, university research (DOI, PubMed, arXiv, JSTOR)
- "government": .gov, .edu, official statistics, WHO, UN agencies
- "reputable": established news orgs (Reuters, BBC, FT), major industry analysts (Gartner, McKinsey)
- "general": Wikipedia, general web content, blogs
- "unknown": unverifiable sources

IMPORTANT: You must return ONLY valid JSON matching the exact schema below. No markdown code blocks, no extra text.

Schema:
{
  "abstract": "string",
  "keyFindings": ["string", ...],
  "sections": [
    {
      "heading": "string",
      "content": "string (200-400 words)",
      "citations": ["cit-1", "cit-2"]
    }
  ],
  "citations": [
    {
      "id": "cit-1",
      "title": "string",
      "url": "string",
      "author": "string or null",
      "publishedAt": "YYYY-MM-DD or null",
      "credibility": "academic|government|reputable|general|unknown",
      "excerpt": "string (1-2 sentences from the source)"
    }
  ],
  "tags": ["string", ...]
}`

function buildResearchPrompt(topic: string, question?: string): string {
  const focus = question
    ? `Research question: ${question}`
    : `Provide comprehensive, evidence-based research on this topic.`

  return `Topic: ${topic}

${focus}

Research this topic thoroughly. Find and cite credible, verifiable sources — prioritize:
1. Academic/peer-reviewed research (highest priority)
2. Government or institutional data
3. Reputable journalism and industry analysis
4. General reference material only as supplement

Produce a well-structured research document following the JSON schema in your system prompt. Ensure all citations have real, working URLs.`
}

function parseResearchResponse(raw: string): Partial<ResearchDocument> | null {
  // Strip possible markdown fences
  const cleaned = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim()
  try {
    const parsed = JSON.parse(cleaned) as {
      abstract?: string
      keyFindings?: string[]
      sections?: Array<{ heading: string; content: string; citations: string[] }>
      citations?: Array<{
        id: string
        title: string
        url: string
        author?: string | null
        publishedAt?: string | null
        credibility: SourceCredibility
        excerpt: string
      }>
      tags?: string[]
    }

    const citations: ResearchCitation[] = (parsed.citations ?? []).map(c => ({
      id: c.id,
      title: c.title,
      url: c.url,
      author: c.author ?? undefined,
      publishedAt: c.publishedAt ?? undefined,
      credibility: c.credibility ?? 'unknown',
      excerpt: c.excerpt,
    }))

    const sections: ResearchSection[] = (parsed.sections ?? []).map(s => ({
      heading: s.heading,
      content: s.content,
      citations: s.citations ?? [],
    }))

    return {
      abstract: parsed.abstract,
      keyFindings: parsed.keyFindings ?? [],
      sections,
      citations,
      tags: parsed.tags ?? [],
    }
  } catch {
    return null
  }
}

export async function runResearchAgent(
  doc: ResearchDocument,
  options: ResearchAgentOptions,
): Promise<Partial<ResearchDocument> & { tokenUsage?: { promptTokens: number; completionTokens: number } }> {
  const model = options.model ?? 'claude-opus-4-7'
  const fetcher = options.fetcher ?? fetch

  const messages: AnthropicMessage[] = [
    { role: 'user', content: buildResearchPrompt(doc.topic, doc.question) },
  ]

  const res = await fetcher('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': options.apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: RESEARCH_SYSTEM_PROMPT,
      messages,
    }),
  })

  if (!res.ok) {
    const err = await res.text().catch(() => '')
    throw new Error(`Anthropic API ${res.status}: ${err.slice(0, 300)}`)
  }

  const data = await res.json() as AnthropicResponse
  const rawText = data.content.find(c => c.type === 'text')?.text ?? ''
  const parsed = parseResearchResponse(rawText)

  if (!parsed) {
    throw new Error('Could not parse research response as JSON')
  }

  return {
    ...parsed,
    tokenUsage: {
      promptTokens: data.usage.input_tokens,
      completionTokens: data.usage.output_tokens,
    },
  }
}
