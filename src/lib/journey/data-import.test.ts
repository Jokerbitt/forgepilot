import { describe, it, expect } from 'vitest'
import { detectDelimiter, parseDelimited, inferColumnType, analyzeDataset, datasetToSeedStep } from './data-import'

describe('detectDelimiter', () => {
  it('detects comma, semicolon and tab', () => {
    expect(detectDelimiter('a,b,c')).toBe(',')
    expect(detectDelimiter('a;b;c')).toBe(';')
    expect(detectDelimiter('a\tb\tc')).toBe('\t')
  })
})

describe('parseDelimited', () => {
  it('parses simple rows', () => {
    expect(parseDelimited('a,b\n1,2')).toEqual([['a', 'b'], ['1', '2']])
  })
  it('handles quoted fields with commas and escaped quotes', () => {
    const rows = parseDelimited('name,note\n"Müller, Hans","sagt ""hallo"""')
    expect(rows[1]).toEqual(['Müller, Hans', 'sagt "hallo"'])
  })
  it('handles newlines inside quotes', () => {
    const rows = parseDelimited('a,b\n"line1\nline2",x')
    expect(rows[1]![0]).toBe('line1\nline2')
  })
  it('ignores blank lines', () => {
    expect(parseDelimited('a,b\n\n1,2\n')).toEqual([['a', 'b'], ['1', '2']])
  })
})

describe('inferColumnType', () => {
  it('detects number, boolean, date and string', () => {
    expect(inferColumnType(['1', '2', '-3.5'])).toBe('number')
    expect(inferColumnType(['true', 'false', 'ja'])).toBe('boolean')
    expect(inferColumnType(['2026-06-20', '2025-01-01'])).toBe('date')
    expect(inferColumnType(['hallo', 'welt'])).toBe('string')
  })
  it('ignores empty values and defaults to string', () => {
    expect(inferColumnType(['', '  '])).toBe('string')
  })
})

describe('analyzeDataset', () => {
  it('extracts typed columns and row count', () => {
    const csv = 'Name;Alter;Aktiv\nAnna;30;true\nBen;25;false'
    const a = analyzeDataset(csv)
    expect(a.delimiter).toBe(';')
    expect(a.headers).toEqual(['Name', 'Alter', 'Aktiv'])
    expect(a.columns.find(c => c.name === 'Alter')?.type).toBe('number')
    expect(a.columns.find(c => c.name === 'Aktiv')?.type).toBe('boolean')
    expect(a.rowCount).toBe(2)
  })
  it('slugs messy header names', () => {
    expect(analyzeDataset('Vor Name,E-Mail!\nA,b').headers).toEqual(['Vor_Name', 'EMail'])
  })
})

describe('datasetToSeedStep', () => {
  it('builds a seed step listing fields and row count', () => {
    const a = analyzeDataset('Name,Alter\nAnna,30')
    const step = datasetToSeedStep(a, 'Kunde')
    expect(step!.title).toContain('Kunde')
    expect(step!.description).toContain('Name: string')
    expect(step!.description).toContain('Alter: number')
    expect(step!.description).toContain('1 importierten Zeilen')
  })
  it('returns null for an empty dataset', () => {
    expect(datasetToSeedStep(analyzeDataset(''), 'X')).toBeNull()
  })
})
