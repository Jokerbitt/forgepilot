import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, readFileSync, existsSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import JSZip from 'jszip'
import { extractZipToWorkspace, isUnsafeEntry, DEFAULT_INGEST_LIMITS } from './ingest'

let ws: string
function makeWorkspace() {
  ws = mkdtempSync(join(tmpdir(), 'fp-ingest-test-'))
  return ws
}

afterEach(() => { if (ws && existsSync(ws)) rmSync(ws, { recursive: true, force: true }) })

async function zipOf(files: Record<string, string>): Promise<Buffer> {
  const zip = new JSZip()
  for (const [name, content] of Object.entries(files)) zip.file(name, content)
  return zip.generateAsync({ type: 'nodebuffer' })
}

describe('isUnsafeEntry', () => {
  it('rejects traversal, absolute and null-byte paths', () => {
    expect(isUnsafeEntry('../escape.txt')).toBe(true)
    expect(isUnsafeEntry('/etc/passwd')).toBe(true)
    expect(isUnsafeEntry('a/../../b')).toBe(true)
    expect(isUnsafeEntry('bad\0name')).toBe(true)
  })
  it('accepts normal nested paths', () => {
    expect(isUnsafeEntry('src/app/page.tsx')).toBe(false)
    expect(isUnsafeEntry('App.Core/Db.cs')).toBe(false)
  })
})

describe('extractZipToWorkspace', () => {
  it('extracts files into the workspace', async () => {
    const buf = await zipOf({ 'src/a.cs': 'class A {}', 'README.md': '# hi' })
    const res = await extractZipToWorkspace(buf, DEFAULT_INGEST_LIMITS, makeWorkspace)
    expect(res.fileCount).toBe(2)
    expect(readFileSync(join(res.workspacePath, 'src/a.cs'), 'utf8')).toBe('class A {}')
  })

  // Note: JSZip normalizes away "../" when building an archive via its API, so a
  // traversal entry can't be constructed here. The guard itself is covered by the
  // isUnsafeEntry unit tests above plus the in-loop dest-under-workspace check
  // (defense in depth against a hand-crafted malicious archive).
  it('keeps all extracted files inside the workspace', async () => {
    const buf = await zipOf({ 'a/b/c.cs': 'x', 'd.txt': 'y' })
    const res = await extractZipToWorkspace(buf, DEFAULT_INGEST_LIMITS, makeWorkspace)
    expect(res.workspacePath).toBe(ws)
    expect(existsSync(join(ws, 'a/b/c.cs'))).toBe(true)
  })

  it('enforces the max-entries limit', async () => {
    const files: Record<string, string> = {}
    for (let i = 0; i < 5; i++) files[`f${i}.txt`] = 'x'
    const buf = await zipOf(files)
    await expect(extractZipToWorkspace(buf, { maxEntries: 2, maxTotalBytes: 1e9 }, makeWorkspace)).rejects.toThrow(/Zu viele/)
  })

  it('enforces the max-total-bytes limit (zip-bomb guard)', async () => {
    const buf = await zipOf({ 'big.txt': 'x'.repeat(2000) })
    await expect(extractZipToWorkspace(buf, { maxEntries: 100, maxTotalBytes: 1000 }, makeWorkspace)).rejects.toThrow(/zu groß|Bombe/)
  })

  it('rejects an empty zip', async () => {
    const buf = await zipOf({})
    await expect(extractZipToWorkspace(buf, DEFAULT_INGEST_LIMITS, makeWorkspace)).rejects.toThrow(/keine Dateien/)
  })

  it('rejects a non-zip buffer', async () => {
    await expect(extractZipToWorkspace(Buffer.from('not a zip'), DEFAULT_INGEST_LIMITS, makeWorkspace)).rejects.toThrow(/Ungültiges/)
  })
})
