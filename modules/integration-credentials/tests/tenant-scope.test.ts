import { describe, expect, it } from 'vitest';
import { resolveCredentialTenantKey } from '../tenant-scope';

describe('integration credential tenant scope', () => {
  it('uses the authenticated tenant key', () => {
    expect(resolveCredentialTenantKey({ tenantKey: 'customer-a' })).toBe('customer-a');
  });

  it('falls back only for legacy default sessions', () => {
    expect(resolveCredentialTenantKey({})).toBe('default');
  });
});
