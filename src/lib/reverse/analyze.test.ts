import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { analyzeForReverse, walkFiles, countLanguages, detectStack, findModules } from './analyze'

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'fp-reverse-')) })
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

function write(rel: string, content = '') {
  const abs = join(dir, rel)
  mkdirSync(join(abs, '..'), { recursive: true })
  writeFileSync(abs, content)
}

describe('walkFiles', () => {
  it('lists files and skips ignored build dirs', () => {
    write('src/a.cs')
    write('node_modules/dep/index.js')
    write('bin/out.dll')
    const { files } = walkFiles(dir)
    expect(files).toContain('src/a.cs')
    expect(files.some(f => f.includes('node_modules'))).toBe(false)
    expect(files.some(f => f.startsWith('bin/'))).toBe(false)
  })
})

describe('countLanguages', () => {
  it('counts by extension, most common first', () => {
    const langs = countLanguages(['a.cs', 'b.cs', 'c.ts', 'd.unknown'])
    expect(langs[0]).toEqual({ name: 'C#', fileCount: 2 })
    expect(langs.find(l => l.name === 'TypeScript')?.fileCount).toBe(1)
  })
})

describe('findModules', () => {
  it('extracts .csproj names as modules', () => {
    expect(findModules(['App.Core/App.Core.csproj', 'App.UI/App.UI.csproj'])).toEqual(['App.Core', 'App.UI'])
  })
})

describe('analyzeForReverse — C# WinForms + MSSQL (Svens Fall)', () => {
  beforeEach(() => {
    write('Leitrechner.sln', 'solution')
    write('App.Core/App.Core.csproj', '<Project><TargetFramework>net48</TargetFramework></Project>')
    write('App.UI/App.UI.csproj', '<Project></Project>')
    write('App.UI/MainForm.cs', 'using System.Windows.Forms;\nclass MainForm : Form {}')
    write('App.Core/Db.cs', 'using System.Data.SqlClient;\nvar pwd = "Server=x;Password=secret123;";')
  })

  it('detects C#, Windows binding, MSSQL, modules and a security hint', () => {
    const r = analyzeForReverse(dir)
    expect(r.appName).toBe('Leitrechner')
    expect(r.languages.some(l => l.name === 'C#')).toBe(true)
    expect(r.platform).toBe('windows')
    expect(r.databaseEngines).toContain('Microsoft SQL Server')
    expect(r.modules).toEqual(expect.arrayContaining(['App.Core', 'App.UI']))
    expect(r.security.length).toBeGreaterThan(0)
    expect(r.techDebt.some(d => d.includes('PostgreSQL'))).toBe(true)
    expect(r.summary).toContain('Leitrechner')
    expect(r.summary).toMatch(/1:1/)
  })

  it('detectStack flags WinForms framework + windows reasons', () => {
    const { files } = walkFiles(dir)
    const d = detectStack(dir, files)
    expect(d.frameworks).toContain('WinForms')
    expect(d.platformReasons.length).toBeGreaterThan(0)
  })
})

describe('analyzeForReverse — cross-platform Node app', () => {
  it('detects cross-platform for a Next.js repo', () => {
    write('package.json', JSON.stringify({ name: 'web-app', dependencies: { next: '14' } }))
    write('src/page.tsx', 'export default function P(){return null}')
    const r = analyzeForReverse(dir)
    expect(r.platform).toBe('cross-platform')
    expect(r.appName).toBe('web-app')
  })
})

describe('analyzeForReverse — missing path', () => {
  it('returns a safe report', () => {
    const r = analyzeForReverse(join(dir, 'nope'))
    expect(r.languages).toEqual([])
    expect(r.summary).toMatch(/nicht gefunden/)
  })
})
