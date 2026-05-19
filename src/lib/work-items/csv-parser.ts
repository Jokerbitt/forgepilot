export interface ParsedWorkItem {
  title: string
  type: 'task' | 'bug' | 'feature' | 'chore'
  priority: 'low' | 'medium' | 'high' | 'critical'
  description?: string
}

const VALID_TYPES = ['task', 'bug', 'feature', 'chore'] as const
const VALID_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const

type ValidType = (typeof VALID_TYPES)[number]
type ValidPriority = (typeof VALID_PRIORITIES)[number]

function isValidType(value: string): value is ValidType {
  return (VALID_TYPES as readonly string[]).includes(value)
}

function isValidPriority(value: string): value is ValidPriority {
  return (VALID_PRIORITIES as readonly string[]).includes(value)
}

function splitCSVLine(line: string): string[] {
  const fields: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      fields.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }
  fields.push(current.trim())
  return fields
}

/**
 * Parse CSV-formatted work items with validation and defaults.
 * Expects headers: title (required), type, priority, description.
 * @param input - CSV input string with headers on first line
 * @returns Array of parsed and validated work items
 */
export function parseCSV(input: string): ParsedWorkItem[] {
  const lines = input.split(/\r?\n/).filter(line => line.trim().length > 0)
  if (lines.length < 2) return []

  const headers = splitCSVLine(lines[0]).map(h => h.toLowerCase())
  const titleIdx = headers.indexOf('title')
  const typeIdx = headers.indexOf('type')
  const priorityIdx = headers.indexOf('priority')
  const descriptionIdx = headers.indexOf('description')

  if (titleIdx === -1) return []

  const items: ParsedWorkItem[] = []

  for (let i = 1; i < lines.length; i++) {
    const fields = splitCSVLine(lines[i])
    const title = titleIdx < fields.length ? fields[titleIdx] : ''
    if (!title) continue

    const rawType = typeIdx !== -1 && typeIdx < fields.length ? fields[typeIdx].toLowerCase() : ''
    const rawPriority = priorityIdx !== -1 && priorityIdx < fields.length ? fields[priorityIdx].toLowerCase() : ''
    const description =
      descriptionIdx !== -1 && descriptionIdx < fields.length && fields[descriptionIdx]
        ? fields[descriptionIdx]
        : undefined

    const type: ValidType = isValidType(rawType) ? rawType : 'task'
    const priority: ValidPriority = isValidPriority(rawPriority) ? rawPriority : 'medium'

    items.push({ title, type, priority, description })
  }

  return items
}
