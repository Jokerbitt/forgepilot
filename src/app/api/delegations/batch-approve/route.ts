export const dynamic = 'force-dynamic'
/**
 * POST /api/delegations/batch-approve
 *
 * Alias for /api/delegations/bulk-approve, kept for UI compatibility.
 * The delegation list page calls this route for the bulk-select approve action.
 */
export { POST } from '@/app/api/delegations/bulk-approve/route'
