'use client'

/** Minimal Markdown renderer for AI-generated run summaries.
 *  Handles: **bold**, *italic*, `code`, # headings, numbered/bullet lists, blank-line paragraphs.
 *  No external library dependency.
 */
export function MarkdownBlock({ text, className }: { text: string; className?: string }) {
  const lines = text.split('\n')
  const elements: React.ReactNode[] = []
  let key = 0

  const inlineFormat = (raw: string): React.ReactNode => {
    // Split on bold (**text**), italic (*text*), inline code (`text`)
    const parts = raw.split(/(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>
      }
      if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
        return <em key={i} className="italic text-slate-300">{part.slice(1, -1)}</em>
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={i} className="rounded bg-slate-800 px-1 py-0.5 font-mono text-xs text-sky-300">{part.slice(1, -1)}</code>
      }
      return part
    })
  }

  let i = 0
  while (i < lines.length) {
    const line = lines[i]

    // Heading
    const hMatch = /^(#{1,3})\s+(.+)/.exec(line)
    if (hMatch) {
      const level = hMatch[1].length
      const cls = level === 1
        ? 'mt-4 mb-2 text-base font-bold text-white'
        : level === 2
        ? 'mt-3 mb-1 text-sm font-semibold text-slate-200'
        : 'mt-2 mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400'
      elements.push(<p key={key++} className={cls}>{inlineFormat(hMatch[2])}</p>)
      i++
      continue
    }

    // Ordered list item
    const olMatch = /^(\d+)\.\s+(.+)/.exec(line)
    if (olMatch) {
      const items: React.ReactNode[] = []
      while (i < lines.length && /^\d+\.\s+/.test(lines[i])) {
        const m = /^\d+\.\s+(.+)/.exec(lines[i])!
        items.push(<li key={i} className="text-slate-300">{inlineFormat(m[1])}</li>)
        i++
      }
      elements.push(<ol key={key++} className="my-2 ml-4 list-decimal space-y-0.5 text-sm">{items}</ol>)
      continue
    }

    // Unordered list item (-, *, —)
    const ulMatch = /^[-*—]\s+(.+)/.exec(line)
    if (ulMatch) {
      const items: React.ReactNode[] = []
      while (i < lines.length && /^[-*—]\s+/.test(lines[i])) {
        const m = /^[-*—]\s+(.+)/.exec(lines[i])!
        items.push(<li key={i} className="text-slate-300">{inlineFormat(m[1])}</li>)
        i++
      }
      elements.push(<ul key={key++} className="my-2 ml-4 list-disc space-y-0.5 text-sm">{items}</ul>)
      continue
    }

    // Blank line → spacer
    if (line.trim() === '') {
      elements.push(<div key={key++} className="h-2" />)
      i++
      continue
    }

    // Regular paragraph line
    elements.push(
      <p key={key++} className="text-sm leading-relaxed text-slate-300">{inlineFormat(line)}</p>
    )
    i++
  }

  return <div className={className}>{elements}</div>
}
