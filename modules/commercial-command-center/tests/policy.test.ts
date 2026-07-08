import { describe, expect, it } from 'vitest';
import { ForbiddenError } from '@shared/errors';
import { checkCommercialCenterPermission } from '../policy';

describe('Commercial Command Center policy', () => {
  it('allows commercial managers to create planning records', () => {
    expect(() => checkCommercialCenterPermission('marketing_manager', 'commercial:center:create')).not.toThrow();
    expect(() => checkCommercialCenterPermission('department_head', 'commercial:center:create')).not.toThrow();
    expect(() => checkCommercialCenterPermission('sales_manager', 'commercial:center:create')).not.toThrow();
  });

  it('keeps reviewers and viewers read-only', () => {
    expect(() => checkCommercialCenterPermission('viewer', 'commercial:center:read')).not.toThrow();
    expect(() => checkCommercialCenterPermission('reviewer', 'commercial:center:read')).not.toThrow();
    expect(() => checkCommercialCenterPermission('viewer', 'commercial:center:create')).toThrow(ForbiddenError);
    expect(() => checkCommercialCenterPermission('reviewer', 'commercial:center:create')).toThrow(ForbiddenError);
  });

  it('rejects unknown roles', () => {
    expect(() => checkCommercialCenterPermission('unknown', 'commercial:center:read')).toThrow(ForbiddenError);
  });
});
