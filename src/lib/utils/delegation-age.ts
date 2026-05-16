/**
 * Human-readable age string for a delegation waiting in pending/approved state.
 * Returns { text, colorClass } for display in the Zeit column.
 */
export function formatAge(createdAt: string): { text: string; colorClass: string } {
  const ageMs = Date.now() - new Date(createdAt).getTime()
  const ageMin = Math.floor(ageMs / 60000)
  const ageH   = Math.floor(ageMin / 60)
  const ageD   = Math.floor(ageH / 24)
  if (ageD >= 1)    return { text: `${ageD}d alt`,  colorClass: 'text-red-400' }
  if (ageH >= 4)    return { text: `${ageH}h alt`,  colorClass: 'text-yellow-500' }
  if (ageMin >= 30) return { text: `${ageMin}m alt`, colorClass: 'text-yellow-600/70' }
  return { text: `${ageMin}m alt`, colorClass: 'text-gray-600' }
}

/**
 * Returns true if createdAt is today (local date).
 */
export function isCreatedToday(createdAt: string): boolean {
  const d = new Date(createdAt)
  const now = new Date()
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth()    === now.getMonth() &&
    d.getDate()     === now.getDate()
  )
}
