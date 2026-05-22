import type { AgentLog, Delegation } from '@/lib/models/delegation'

export function formatLogsAsText(delegation: Delegation): string {
  const header = [
    `Delegation: ${delegation.title}`,
    `ID: ${delegation.id}`,
    `Status: ${delegation.status}`,
    `Erstellt: ${new Date(delegation.createdAt).toLocaleString('de-DE')}`,
    `Ziel: ${delegation.contract.goal}`,
    '',
    '─'.repeat(60),
    '',
  ].join('\n')

  const logs = delegation.logs ?? []
  if (logs.length === 0) return header + '(Keine Logs vorhanden)\n'

  const body = logs.map(formatLogLine).join('\n')
  return header + body + '\n'
}

function formatLogLine(log: AgentLog): string {
  const ts = new Date(log.timestamp).toLocaleTimeString('de-DE', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
  const prefix = log.type === 'error' ? '[ERROR]' : log.type === 'success' ? '[OK]   ' : '[INFO] '
  return `${ts} ${prefix} ${log.message}`
}

export function downloadLogsAsText(delegation: Delegation): void {
  const content = formatLogsAsText(delegation)
  const blob = new Blob([content], { type: 'text/plain; charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `delegation-${delegation.id.slice(0, 8)}-logs.txt`
  a.click()
  URL.revokeObjectURL(url)
}
