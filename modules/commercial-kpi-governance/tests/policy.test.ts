import { describe, expect, it } from 'vitest';
import { canManageGovernedKpis, checkKpiGovernancePermission } from '../policy';

describe('commercial KPI governance policy', () => {
  it.each([
    'admin',
    'cco',
    'department_head',
    'marketing_manager',
    'social_media_manager',
    'sales_manager',
    'lead_qualification_manager',
    'specialist',
    'reviewer',
    'viewer',
  ])('allows %s to read governed KPI targets', (role) => {
    expect(() => checkKpiGovernancePermission(role, 'commercial-kpi:read')).not.toThrow();
  });

  it('allows only the CCO to create, approve, amend, or set event capacity', () => {
    const permissions = [
      'commercial-kpi:create',
      'commercial-kpi:update',
      'commercial-kpi:submit',
      'commercial-kpi:approve',
      'commercial-kpi:amend',
      'commercial-kpi:capacity',
    ] as const;
    for (const permission of permissions) {
      expect(() => checkKpiGovernancePermission('cco', permission)).not.toThrow();
      expect(() => checkKpiGovernancePermission('admin', permission)).toThrow();
      expect(() => checkKpiGovernancePermission('department_head', permission)).toThrow();
    }
    expect(canManageGovernedKpis('cco')).toBe(true);
    expect(canManageGovernedKpis('admin')).toBe(false);
  });
});

