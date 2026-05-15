import type { RiskClass } from './work-item'

export type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'expired'

export interface ApprovalRequest {
  id: string
  delegationId: string
  contractId: string
  riskClass: RiskClass
  reason: string
  requestedAt: string
  expiresAt: string
  status: ApprovalStatus
  resolvedAt?: string
  resolvedBy?: string
  rejectionReason?: string
}
