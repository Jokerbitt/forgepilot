import { getAuditLog, getAuditStats, AuditEntry } from '@/lib/audit'

function actionBadge(action: string): string {
  if (action.includes('completed')) return 'bg-green-900/50 text-green-400'
  if (action.includes('failed')) return 'bg-red-900/50 text-red-400'
  if (action.includes('approved')) return 'bg-blue-900/50 text-blue-400'
  if (action.includes('created')) return 'bg-purple-900/50 text-purple-400'
  if (action.includes('deleted')) return 'bg-red-900/50 text-red-400'
  return 'bg-gray-800 text-gray-400'
}

export default function AuditPage() {
  const entries = getAuditLog(100)
  const stats = getAuditStats()

  return (
    <div className="min-h-screen bg-gray-950 p-6">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-white mb-2">Audit Log</h1>
        <p className="text-gray-400 text-sm mb-6">All significant system actions</p>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-white">{stats.total}</div>
            <div className="text-xs text-gray-500 mt-1">Total Events</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-blue-400">{stats.last24h}</div>
            <div className="text-xs text-gray-500 mt-1">Last 24h</div>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
            <div className="text-2xl font-bold text-purple-400">{Object.keys(stats.byAction).length}</div>
            <div className="text-xs text-gray-500 mt-1">Event Types</div>
          </div>
        </div>

        {/* Log table */}
        <div className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden">
          {entries.length === 0 ? (
            <div className="py-12 text-center text-gray-500 text-sm">No audit events yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800">
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Action</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Entity</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Actor</th>
                  <th className="text-left px-4 py-3 text-gray-500 font-medium">Time</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry: AuditEntry) => (
                  <tr key={entry.id} className="border-b border-gray-800/50 hover:bg-gray-800/30">
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs font-mono ${actionBadge(entry.action)}`}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-300">
                      {entry.entityTitle ?? entry.entityId.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-gray-400">{entry.actor}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
