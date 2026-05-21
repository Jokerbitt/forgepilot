/**
 * Observability primitives — request correlation, structured logging context.
 *
 * Keep this file as a curated barrel: only export things the rest of the
 * code is encouraged to use directly. The deeper helpers stay private.
 */

export { REQUEST_ID_HEADER, getRequestId, loggerForRequest } from './request-id'
