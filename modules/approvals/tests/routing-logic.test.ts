import { describe, it, expect } from 'vitest';
import { ROUTING_RULES, CONTENT_TYPE_ROUTES } from '../types';
import type { ApprovalRoute, RiskCategory } from '../types';

// Test the routing logic directly (unit test of the routing function)
function determineRoutes(
  riskCategory: RiskCategory,
  contentType: string,
  _ownerDepartmentId: string,
): ApprovalRoute[] {
  const routes: ApprovalRoute[] = [];

  // Base routes from risk category
  const riskRoutes = ROUTING_RULES[riskCategory] || [];
  for (const route of riskRoutes) {
    if (!routes.some((r) => r.department === route.department && r.role === route.role)) {
      routes.push(route);
    }
  }

  // Content type overrides
  const contentTypeRoutes = CONTENT_TYPE_ROUTES[contentType] || [];
  for (const route of contentTypeRoutes) {
    if (!routes.some((r) => r.department === route.department && r.role === route.role)) {
      routes.push(route);
    }
  }

  return routes;
}

describe('Approval Routing Logic', () => {
  it('low risk campaign routes to Acquisition + campaign-specific routes', () => {
    const routes = determineRoutes('low', 'campaign', 'dept-1');
    expect(routes.length).toBeGreaterThanOrEqual(2);
    expect(routes.some((r) => r.department === 'Acquisition')).toBe(true);
    expect(routes.some((r) => r.department === 'Conversion & Closing')).toBe(true);
  });

  it('medium risk adds Brand & Positioning', () => {
    const routes = determineRoutes('medium', 'campaign', 'dept-1');
    expect(routes.some((r) => r.department === 'Brand & Positioning')).toBe(true);
    expect(routes.some((r) => r.department === 'Acquisition')).toBe(true);
  });

  it('high risk adds CCO', () => {
    const routes = determineRoutes('high', 'campaign', 'dept-1');
    expect(routes.some((r) => r.department === 'CCO')).toBe(true);
    expect(routes.some((r) => r.department === 'Brand & Positioning')).toBe(true);
    expect(routes.some((r) => r.department === 'Acquisition')).toBe(true);
  });

  it('announcement always routes to CCO', () => {
    const lowRiskRoutes = determineRoutes('low', 'announcement', 'dept-1');
    expect(lowRiskRoutes.some((r) => r.department === 'CCO')).toBe(true);

    const highRiskRoutes = determineRoutes('high', 'announcement', 'dept-1');
    expect(highRiskRoutes.some((r) => r.department === 'CCO')).toBe(true);
  });

  it('campaign routes to Conversion & Closing', () => {
    const routes = determineRoutes('low', 'campaign', 'dept-1');
    expect(routes.some((r) => r.department === 'Conversion & Closing')).toBe(true);
  });

  it('no duplicate routes for same department/role', () => {
    const routes = determineRoutes('high', 'announcement', 'dept-1');
    const uniqueRoutes = routes.filter(
      (route, index, self) =>
        index === self.findIndex((r) => r.department === route.department && r.role === route.role),
    );
    expect(routes.length).toBe(uniqueRoutes.length);
  });

  it('high risk campaign has all required departments', () => {
    const routes = determineRoutes('high', 'campaign', 'dept-1');
    const departments = routes.map((r) => r.department);
    expect(departments).toContain('CCO');
    expect(departments).toContain('Brand & Positioning');
    expect(departments).toContain('Acquisition');
    expect(departments).toContain('Conversion & Closing');
  });
});
