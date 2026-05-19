import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from './route'
import type { ProjectBrief } from '@/lib/models/project-brief'

// Mock the project-briefs module
vi.mock('@/lib/project-briefs', () => ({
  findProjectBriefById: vi.fn(),
}))

// Mock the pdf-export module
vi.mock('@/lib/project-briefs/pdf-export', () => ({
  generateBriefPdf: vi.fn(),
  briefPdfFilename: vi.fn(),
}))

import { findProjectBriefById } from '@/lib/project-briefs'
import { generateBriefPdf, briefPdfFilename } from '@/lib/project-briefs/pdf-export'

const mockBrief: ProjectBrief = {
  id: 'brief-123',
  title: 'Test Brief',
  status: 'in_review',
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-16T14:30:00Z',
  rawIdea: 'A test idea.',
  problemStatement: 'Test problem.',
  targetAudience: 'Test audience.',
  desiredOutcome: 'Test outcome.',
  constraints: [],
  scope: 'standard',
  researchMode: 'standard',
  privacyMode: 'local',
  requirements: [],
  useCases: [],
  nonGoals: [],
  risks: [],
  researchRunIds: [],
  researchBriefDraft: {
    title: 'Research Brief: Test Brief',
    mode: 'standard',
    privacyMode: 'local',
    preferredExecutor: 'agent',
    researchQuestions: [],
    searchTerms: [],
    preferredSourceTypes: [],
    excludeCriteria: [],
  },
}

describe('PDF Export Route', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/project-briefs/[id]/export/pdf', () => {
    it('should return PDF with correct headers when brief exists', async () => {
      const mockPdfBuffer = Buffer.from('mock-pdf-content')
      vi.mocked(findProjectBriefById).mockReturnValue(mockBrief)
      vi.mocked(generateBriefPdf).mockReturnValue(mockPdfBuffer)
      vi.mocked(briefPdfFilename).mockReturnValue('brief-test-brief.pdf')

      const request = new Request('http://localhost:3000/api/project-briefs/brief-123/export/pdf')
      const response = await GET(request, { params: { id: 'brief-123' } })

      expect(response.status).toBe(200)
      expect(response.headers.get('Content-Type')).toBe('application/pdf')
      expect(response.headers.get('Content-Disposition')).toContain('attachment')
      expect(response.headers.get('Content-Disposition')).toContain('brief-test-brief.pdf')
      expect(response.headers.get('Content-Length')).toBe(mockPdfBuffer.length.toString())
    })

    it('should return 404 when brief not found', async () => {
      vi.mocked(findProjectBriefById).mockReturnValue(undefined)

      const request = new Request('http://localhost:3000/api/project-briefs/nonexistent/export/pdf')
      const response = await GET(request, { params: { id: 'nonexistent' } })

      expect(response.status).toBe(404)
      const data = await response.json() as { error: string }
      expect(data.error).toBe('Project brief not found')
    })

    it('should call generateBriefPdf with correct brief', async () => {
      const mockPdfBuffer = Buffer.from('pdf-content')
      vi.mocked(findProjectBriefById).mockReturnValue(mockBrief)
      vi.mocked(generateBriefPdf).mockReturnValue(mockPdfBuffer)
      vi.mocked(briefPdfFilename).mockReturnValue('test.pdf')

      const request = new Request('http://localhost:3000/api/project-briefs/brief-123/export/pdf')
      await GET(request, { params: { id: 'brief-123' } })

      expect(generateBriefPdf).toHaveBeenCalledWith(mockBrief)
    })

    it('should return response body with PDF buffer', async () => {
      const testContent = 'test-pdf-binary-content'
      const mockPdfBuffer = Buffer.from(testContent)
      vi.mocked(findProjectBriefById).mockReturnValue(mockBrief)
      vi.mocked(generateBriefPdf).mockReturnValue(mockPdfBuffer)
      vi.mocked(briefPdfFilename).mockReturnValue('test.pdf')

      const request = new Request('http://localhost:3000/api/project-briefs/brief-123/export/pdf')
      const response = await GET(request, { params: { id: 'brief-123' } })

      const buffer = await response.arrayBuffer()
      expect(Buffer.from(buffer).toString()).toBe(testContent)
    })
  })
})
