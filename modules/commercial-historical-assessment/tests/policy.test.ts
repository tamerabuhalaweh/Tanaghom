import { describe, expect, it } from 'vitest';
import { canApproveHistoricalAssessment, checkHistoricalAssessmentPermission } from '../policy';

describe('historical assessment policy', () => {
  it.each(['admin', 'cco'])('allows %s to create, generate, and approve', role => {
    expect(() => checkHistoricalAssessmentPermission(role, 'assessment:create')).not.toThrow();
    expect(() => checkHistoricalAssessmentPermission(role, 'assessment:generate')).not.toThrow();
    expect(() => checkHistoricalAssessmentPermission(role, 'assessment:approve')).not.toThrow();
    expect(canApproveHistoricalAssessment(role)).toBe(true);
  });

  it('allows a department head to prepare analysis but keeps final approval executive-only', () => {
    expect(() => checkHistoricalAssessmentPermission('department_head', 'assessment:create')).not.toThrow();
    expect(() => checkHistoricalAssessmentPermission('department_head', 'assessment:generate')).not.toThrow();
    expect(() => checkHistoricalAssessmentPermission('department_head', 'assessment:approve')).toThrow();
    expect(canApproveHistoricalAssessment('department_head')).toBe(false);
  });

  it('allows marketing managers to create analysis but not approve learning', () => {
    expect(() => checkHistoricalAssessmentPermission('marketing_manager', 'assessment:create')).not.toThrow();
    expect(() => checkHistoricalAssessmentPermission('marketing_manager', 'assessment:generate')).not.toThrow();
    expect(() => checkHistoricalAssessmentPermission('marketing_manager', 'assessment:approve')).toThrow();
  });

  it.each(['social_media_manager', 'sales_manager', 'lead_qualification_manager', 'specialist', 'reviewer', 'viewer'])('keeps %s read-only', role => {
    expect(() => checkHistoricalAssessmentPermission(role, 'assessment:read')).not.toThrow();
    expect(() => checkHistoricalAssessmentPermission(role, 'assessment:create')).toThrow();
    expect(() => checkHistoricalAssessmentPermission(role, 'assessment:approve')).toThrow();
  });
});
