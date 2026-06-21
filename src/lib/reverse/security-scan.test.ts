import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { scanSecurityDeep, findingsToStrings } from './security-scan'

let dir: string
beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'fp-sec-')) })
afterEach(() => { rmSync(dir, { recursive: true, force: true }) })

function write(rel: string, content: string) {
  const abs = join(dir, rel)
  mkdirSync(join(abs, '..'), { recursive: true })
  writeFileSync(abs, content)
}

describe('scanSecurityDeep', () => {
  it('flags a hardcoded password connection string (high) with a sample file', () => {
    write('App.Core/Db.cs', 'var cs = "Server=x;Password=secret123;";')
    const findings = scanSecurityDeep(dir)
    const f = findings.find(x => x.category === 'Hardcoded Secret')
    expect(f).toBeTruthy()
    expect(f!.severity).toBe('high')
    expect(f!.sampleFile).toBe('App.Core/Db.cs')
  })

  it('flags BinaryFormatter (.NET unsafe deserialization)', () => {
    write('Ser.cs', 'var bf = new BinaryFormatter();')
    expect(scanSecurityDeep(dir).some(f => f.category === 'Unsafe Deserialization')).toBe(true)
  })

  it('flags weak crypto and disabled TLS', () => {
    write('Crypto.cs', 'using MD5;\nServerCertificateValidationCallback = (a,b,c,d) => true;')
    const cats = scanSecurityDeep(dir).map(f => f.category)
    expect(cats).toContain('Weak Crypto')
    expect(cats).toContain('TLS Disabled')
  })

  it('flags SQL string concatenation', () => {
    write('Q.cs', 'var q = "SELECT * FROM t WHERE id=" + id;')
    expect(scanSecurityDeep(dir).some(f => f.category === 'SQL Injection')).toBe(true)
  })

  it('returns findings sorted high → low', () => {
    write('a.cs', 'http://insecure.example\nServer=x;Password=abc123;')
    const sev = scanSecurityDeep(dir).map(f => f.severity)
    const order = { high: 0, medium: 1, low: 2 }
    for (let i = 1; i < sev.length; i++) expect(order[sev[i]!]).toBeGreaterThanOrEqual(order[sev[i - 1]!])
  })

  it('returns nothing for a clean repo', () => {
    write('clean.ts', 'export const x = 1')
    expect(scanSecurityDeep(dir)).toEqual([])
  })

  it('flags a PHP-style hardcoded password variable (case-insensitive)', () => {
    write('config.php', '<?php $db_pass = "admin123"; ?>')
    expect(scanSecurityDeep(dir).some(f => f.category === 'Hardcoded Secret')).toBe(true)
  })

  it('flags an exposed Stripe key', () => {
    // Synthetic token: assembled at runtime so it matches the rule but is not a
    // real secret in source (avoids tripping secret-scanning push protection).
    const fakeStripeKey = 'sk_live_' + 'x'.repeat(24)
    write('config.php', `<?php $api_key = "${fakeStripeKey}"; ?>`)
    expect(scanSecurityDeep(dir).some(f => f.category === 'Exposed API Key')).toBe(true)
  })

  it('flags raw mysql_query with an interpolated variable (PHP SQLi)', () => {
    write('login.php', "<?php $r = mysql_query(\"SELECT * FROM users WHERE u = '$user'\"); ?>")
    expect(scanSecurityDeep(dir).some(f => f.category === 'SQL Injection')).toBe(true)
  })

  it('flags lowercase md5() weak crypto', () => {
    write('hash.php', '<?php $h = md5($_POST["p"]); ?>')
    expect(scanSecurityDeep(dir).some(f => f.category === 'Weak Crypto')).toBe(true)
  })

  it('de-duplicates multiple rules of the same category', () => {
    write('q.php', "<?php $a = \"SELECT x FROM t WHERE id=\" + $id; $b = mysql_query(\"SELECT * FROM u WHERE x='$y'\"); ?>")
    expect(scanSecurityDeep(dir).filter(f => f.category === 'SQL Injection')).toHaveLength(1)
  })
})

describe('findingsToStrings', () => {
  it('renders severity markers and the sample file', () => {
    const lines = findingsToStrings([{ severity: 'high', category: 'Private Key', message: 'entfernen', sampleFile: 'a.pem' }])
    expect(lines[0]).toContain('🔴')
    expect(lines[0]).toContain('Private Key')
    expect(lines[0]).toContain('a.pem')
  })
})
