import type { JwtPayload } from '@shared/auth';

export function resolveCredentialTenantKey(payload: Pick<JwtPayload, 'tenantKey'>): string {
  return payload.tenantKey || 'default';
}
