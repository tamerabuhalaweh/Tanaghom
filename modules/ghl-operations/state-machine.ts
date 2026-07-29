import { StateTransitionError } from '@shared/errors';
import type { GhlOperationStatus } from './types';

const ALLOWED: Record<GhlOperationStatus, GhlOperationStatus[]> = {
  previewed: ['pending_approval', 'cancelled', 'expired'],
  pending_approval: ['approved', 'rejected', 'cancelled', 'expired'],
  approved: ['executing', 'blocked', 'cancelled', 'expired'],
  executing: ['provider_accepted', 'failed', 'reconciliation_failed'],
  provider_accepted: ['reconciled', 'reconciliation_failed'],
  reconciled: [],
  rejected: [],
  cancelled: [],
  blocked: [],
  failed: [],
  reconciliation_failed: ['reconciled'],
  expired: [],
};

export function assertGhlOperationTransition(
  from: GhlOperationStatus,
  to: GhlOperationStatus,
): void {
  if (!ALLOWED[from].includes(to)) throw new StateTransitionError(from, to);
}

export function isTerminalGhlOperationStatus(status: GhlOperationStatus): boolean {
  return ['reconciled', 'rejected', 'cancelled', 'blocked', 'failed', 'expired'].includes(status);
}
