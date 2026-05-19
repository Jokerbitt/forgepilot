/**
 * Project Brief → PDF Export
 *
 * Generates a well-formatted PDF document from a ProjectBrief using jsPDF.
 * Optimized for dark theme (white background, dark text).
 */

import type { ProjectBrief } from '@/lib/models/project-brief'
import { jsPDF } from 'jspdf'

const STATUS_LABELS: Record<ProjectBrief['status'], string> = {
  draft: 'Entwurf',
  in_review: 'In Review',
  accepted: 'Freigegeben',
  archived: 'Archiviert',
}

const PRIORITY_LABELS = {
  must: 'Must Have',
  should: 'Should Have',
  could: 'Could Have',
  wont: "Won't Have",
}

/**
 * Generate a filename slug for the brief.
 */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
}

/**
 * Generate a filename for the PDF download.
 * @param brief - The ProjectBrief to generate filename for
 * @returns Filename slug suitable for download
 */
export function briefPdfFilename(brief: ProjectBrief): string {
  return `brief-${slugify(brief.title)}.pdf`
}

/**
 * Convert a ProjectBrief to a PDF Buffer.
 * @param brief - The ProjectBrief to convert
 * @returns Buffer ready for HTTP response as application/pdf
 */
export function generateBriefPdf(brief: ProjectBrief): Buffer {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  })

  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 15
  const contentWidth = pageWidth - 2 * margin

  let yPosition = margin

  // Helper to add text with wrapping
  const addText = (
    text: string,
    fontSize: number = 11,
    options: { isBold?: boolean; color?: [number, number, number]; maxWidth?: number } = {}
  ) => {
    const { isBold = false, color = [0, 0, 0], maxWidth = contentWidth } = options

    doc.setFontSize(fontSize)
    doc.setTextColor(color[0], color[1], color[2])
    doc.setFont('helvetica', isBold ? 'bold' : 'normal')

    const lines = doc.splitTextToSize(text, maxWidth)
    const lineHeight = fontSize * 0.35

    for (const line of lines) {
      if (yPosition + lineHeight > pageHeight - margin) {
        doc.addPage()
        yPosition = margin
      }
      doc.text(line, margin, yPosition)
      yPosition += lineHeight
    }
  }

  const addHeading = (text: string, level: number = 1) => {
    yPosition += level === 1 ? 8 : 5
    const size = level === 1 ? 16 : 13
    addText(text, size, { isBold: true, color: [0, 0, 0] })
    yPosition += level === 1 ? 6 : 4
  }

  const addSpacing = (mm: number = 3) => {
    yPosition += mm
  }

  // ── Page 1: Title & Core Details ──────────────────────────────────────────

  // Title
  addHeading(brief.title, 1)

  // Meta info
  doc.setFontSize(9)
  doc.setTextColor(80, 80, 80)
  addText(`Status: ${STATUS_LABELS[brief.status]} | Scope: ${brief.scope}`, 9, { color: [80, 80, 80] })
  addText(`Created: ${new Date(brief.createdAt).toLocaleDateString('de-DE')} | Updated: ${new Date(brief.updatedAt).toLocaleDateString('de-DE')}`, 9, { color: [80, 80, 80] })

  addSpacing()

  // Raw Idea
  addHeading('Idee / Ausgangslage', 2)
  addText(brief.rawIdea, 11)

  addSpacing()

  // Problem Statement
  addHeading('Problemstellung', 2)
  addText(brief.problemStatement, 11)

  addSpacing()

  // Target Audience
  addHeading('Zielgruppe', 2)
  addText(brief.targetAudience, 11)

  addSpacing()

  // Desired Outcome
  addHeading('Gewünschtes Ergebnis', 2)
  addText(brief.desiredOutcome, 11)

  addSpacing()

  // Constraints (if any)
  if (brief.constraints.length > 0) {
    addHeading('Randbedingungen', 2)
    for (const constraint of brief.constraints) {
      addText(`• ${constraint}`, 10)
    }
    addSpacing()
  }

  // ── Page 2 (if needed): Requirements & Summary ──────────────────────────────

  const acceptedReqs = brief.requirements.filter(r => r.status === 'accepted')

  if (acceptedReqs.length > 0) {
    addHeading('Anforderungen', 2)
    for (const req of acceptedReqs) {
      const priority = PRIORITY_LABELS[req.priority] ?? req.priority
      doc.setFontSize(10)
      doc.setTextColor(0, 0, 0)
      doc.setFont('helvetica', 'bold')

      if (yPosition + 10 > pageHeight - margin) {
        doc.addPage()
        yPosition = margin
      }

      doc.text(`${req.title}`, margin, yPosition)
      yPosition += 5

      doc.setFontSize(9)
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(80, 80, 80)
      addText(`${req.type.toUpperCase()} | ${priority}`, 9, { color: [80, 80, 80] })

      doc.setFontSize(10)
      doc.setTextColor(0, 0, 0)
      const descLines = doc.splitTextToSize(req.description, contentWidth)
      for (const line of descLines) {
        if (yPosition + 4 > pageHeight - margin) {
          doc.addPage()
          yPosition = margin
        }
        doc.text(line, margin, yPosition)
        yPosition += 4
      }
      addSpacing(3)
    }
  }

  // Non-Goals (if any)
  if (brief.nonGoals.length > 0) {
    addHeading('Non-Goals', 2)
    for (const goal of brief.nonGoals) {
      addText(`• ${goal}`, 10)
    }
    addSpacing()
  }

  // Footer on last page
  doc.setFontSize(8)
  doc.setTextColor(150, 150, 150)
  doc.text(
    `ForgePilot · Brief ID: ${brief.id}`,
    pageWidth / 2,
    pageHeight - 10,
    { align: 'center' }
  )

  // Return PDF as Buffer
  return Buffer.from(doc.output('arraybuffer'))
}
