import { describe, expect, it } from 'vitest';
import { ForbiddenError } from '@shared/errors';
import { checkCommercialCenterPermission } from '../policy';

describe('Commercial Command Center policy', () => {
  it('allows leadership and discipline heads to create planning records', () => {
    expect(() => checkCommercialCenterPermission('admin', 'commercial:center:create')).not.toThrow();
    expect(() => checkCommercialCenterPermission('cco', 'commercial:center:create')).not.toThrow();
    expect(() => checkCommercialCenterPermission('department_head', 'commercial:center:create')).not.toThrow();
  });

  it('keeps operational and review roles read-only in direct UI/API writes', () => {
    for (const role of ['marketing_manager', 'social_media_manager', 'sales_manager', 'lead_qualification_manager', 'specialist', 'reviewer', 'viewer']) {
      expect(() => checkCommercialCenterPermission(role, 'commercial:center:read')).not.toThrow();
      expect(() => checkCommercialCenterPermission(role, 'commercial:center:create')).toThrow(ForbiddenError);
      expect(() => checkCommercialCenterPermission(role, 'commercial:center:update')).toThrow(ForbiddenError);
    }
  });

  it('keeps reviewers and viewers read-only', () => {
    expect(() => checkCommercialCenterPermission('viewer', 'commercial:center:read')).not.toThrow();
    expect(() => checkCommercialCenterPermission('reviewer', 'commercial:center:read')).not.toThrow();
    expect(() => checkCommercialCenterPermission('viewer', 'commercial:center:create')).toThrow(ForbiddenError);
    expect(() => checkCommercialCenterPermission('reviewer', 'commercial:center:create')).toThrow(ForbiddenError);
  });

  it('limits plan updates to manager roles', () => {
    expect(() => checkCommercialCenterPermission('admin', 'commercial:center:update')).not.toThrow();
    expect(() => checkCommercialCenterPermission('cco', 'commercial:center:update')).not.toThrow();
    expect(() => checkCommercialCenterPermission('department_head', 'commercial:center:update')).not.toThrow();
    expect(() => checkCommercialCenterPermission('marketing_manager', 'commercial:center:update')).toThrow(ForbiddenError);
    expect(() => checkCommercialCenterPermission('sales_manager', 'commercial:center:update')).toThrow(ForbiddenError);
    expect(() => checkCommercialCenterPermission('specialist', 'commercial:center:update')).toThrow(ForbiddenError);
  });

  it('rejects unknown roles', () => {
    expect(() => checkCommercialCenterPermission('unknown', 'commercial:center:read')).toThrow(ForbiddenError);
  });
});
