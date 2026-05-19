import fs from 'fs'
import path from 'path'
import type { ResearchDocument } from '@/lib/models/research'

const RESEARCH_FILE = path.join(process.cwd(), 'config', 'research-documents.json')

export function readResearchDocuments(): ResearchDocument[] {
  try {
    return JSON.parse(fs.readFileSync(RESEARCH_FILE, 'utf-8')) as ResearchDocument[]
  } catch {
    return []
  }
}

export function writeResearchDocuments(docs: ResearchDocument[]) {
  const dir = path.dirname(RESEARCH_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  const tmp = RESEARCH_FILE + '.tmp'
  fs.writeFileSync(tmp, JSON.stringify(docs, null, 2), 'utf-8')
  fs.renameSync(tmp, RESEARCH_FILE)
}

export function upsertResearchDocument(doc: ResearchDocument) {
  const docs = readResearchDocuments()
  const idx = docs.findIndex(d => d.id === doc.id)
  if (idx >= 0) {
    docs[idx] = doc
  } else {
    docs.unshift(doc)
  }
  writeResearchDocuments(docs)
}

export function getResearchDocument(id: string): ResearchDocument | undefined {
  return readResearchDocuments().find(d => d.id === id)
}
