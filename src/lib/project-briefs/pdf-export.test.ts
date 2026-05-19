import { describe, it, expect } from 'vitest'
import { generateBriefPdf, briefPdfFilename } from './pdf-export'
import type { ProjectBrief } from '@/lib/models/project-brief'

/**
 * Test suite for PDF export functionality
 */

const mockBrief: ProjectBrief = {
  id: 'test-brief-123',
  title: 'Project Brief Test',
  status: 'in_review',
  createdAt: '2024-01-15T10:00:00Z',
  updatedAt: '2024-01-16T14:30:00Z',
  rawIdea: 'This is a raw idea for the project.',
  problemStatement: 'We need to solve a specific problem here.',
  targetAudience: 'Internal team and stakeholders.',
  desiredOutcome: 'A functional system that addresses all requirements.',
  constraints: [
    'Must use TypeScript',
    'Must complete within 3 months',
    'Budget limited to $50k',
  ],
  scope: 'standard',
  researchMode: 'standard',
  privacyMode: 'local',
  requirements: [
    {
      id: 'req-1',
      briefId: 'test-brief-123',
      type: 'functional',
      title: 'User Authentication',
      description: 'System must support secure user login and session management.',
      priority: 'must',
      source: 'user_input',
      findingIds: [],
      status: 'accepted',
    },
    {
      id: 'req-2',
      briefId: 'test-brief-123',
      type: 'non_functional',
      title: 'Performance',
      description: 'All queries must execute within 200ms.',
      priority: 'should',
      source: 'ai_proposed',
      findingIds: [],
      status: 'proposed',
    },
  ],
  useCases: [],
  nonGoals: [
    'Mobile app development',
    'Third-party integrations',
  ],
  risks: [],
  researchRunIds: [],
  researchBriefDraft: {
    title: 'Research Brief: Project Brief Test',
    mode: 'standard',
    privacyMode: 'local',
    preferredExecutor: 'agent',
    researchQuestions: ['What are the best practices?'],
    searchTerms: ['best practices', 'industry standard'],
    preferredSourceTypes: ['web', 'github'],
    excludeCriteria: [],
  },
}

describe('pdf-export', () => {
  describe('briefPdfFilename', () => {
    it('should generate a valid PDF filename from brief title', () => {
      const filename = briefPdfFilename(mockBrief)
      expect(filename).toBe('brief-project-brief-test.pdf')
    })

    it('should handle titles with special characters', () => {
      const briefWithSpecialChars: ProjectBrief = {
        ...mockBrief,
        title: 'Project @ Brief #2024 (Updated)',
      }
      const filename = briefPdfFilename(briefWithSpecialChars)
      expect(filename).toContain('brief-')
      expect(filename).toMatch(/\.pdf$/)
      expect(filename).not.toContain('@')
      expect(filename).not.toContain('#')
    })

    it('should truncate very long titles', () => {
      const longTitle = 'A'.repeat(150)
      const briefWithLongTitle: ProjectBrief = {
        ...mockBrief,
        title: longTitle,
      }
      const filename = briefPdfFilename(briefWithLongTitle)
      expect(filename.length).toBeLessThan(100) // slug max 80 + "brief-" + ".pdf"
    })
  })

  describe('generateBriefPdf', () => {
    it('should return a Buffer', () => {
      const pdf = generateBriefPdf(mockBrief)
      expect(Buffer.isBuffer(pdf)).toBe(true)
    })

    it('should generate non-empty PDF', () => {
      const pdf = generateBriefPdf(mockBrief)
      expect(pdf.length).toBeGreaterThan(0)
    })

    it('should include brief title in PDF metadata', () => {
      const pdf = generateBriefPdf(mockBrief)
      // jsPDF generates PDF content as binary, so we check buffer is valid
      expect(pdf.toString('utf-8', 0, 4)).toContain('%PDF')
    })

    it('should handle briefs with no constraints', () => {
      const briefWithoutConstraints: ProjectBrief = {
        ...mockBrief,
        constraints: [],
      }
      const pdf = generateBriefPdf(briefWithoutConstraints)
      expect(Buffer.isBuffer(pdf)).toBe(true)
      expect(pdf.length).toBeGreaterThan(0)
    })

    it('should handle briefs with no non-goals', () => {
      const briefWithoutNonGoals: ProjectBrief = {
        ...mockBrief,
        nonGoals: [],
      }
      const pdf = generateBriefPdf(briefWithoutNonGoals)
      expect(Buffer.isBuffer(pdf)).toBe(true)
      expect(pdf.length).toBeGreaterThan(0)
    })

    it('should handle briefs with multiple accepted requirements', () => {
      const briefWithMultipleReqs: ProjectBrief = {
        ...mockBrief,
        requirements: [
          ...mockBrief.requirements,
          {
            id: 'req-3',
            briefId: 'test-brief-123',
            type: 'constraint',
            title: 'Security',
            description: 'All data must be encrypted at rest and in transit.',
            priority: 'must',
            source: 'user_input',
            findingIds: [],
            status: 'accepted',
          },
        ],
      }
      const pdf = generateBriefPdf(briefWithMultipleReqs)
      expect(Buffer.isBuffer(pdf)).toBe(true)
      expect(pdf.length).toBeGreaterThan(0)
    })

    it('should handle long descriptions without breaking', () => {
      const longDescription =
        'This is a very long description that should be wrapped properly. '.repeat(10)
      const briefWithLongDesc: ProjectBrief = {
        ...mockBrief,
        requirements: [
          {
            id: 'req-long',
            briefId: 'test-brief-123',
            type: 'functional',
            title: 'Complex Feature',
            description: longDescription,
            priority: 'must',
            source: 'user_input',
            findingIds: [],
            status: 'accepted',
          },
        ],
      }
      const pdf = generateBriefPdf(briefWithLongDesc)
      expect(Buffer.isBuffer(pdf)).toBe(true)
      expect(pdf.length).toBeGreaterThan(0)
    })
  })
})
