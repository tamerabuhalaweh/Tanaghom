import { describe, expect, it } from 'vitest';
import { ForbiddenError } from '@shared/errors';
import { checkWeeklyWorkPermission } from '../policy';
import {
  createWeeklyWorkItemSchema,
  transitionWeeklyWorkItemSchema,
  updateWeeklyWorkItemSchema,
} from '../types';

const base = {
  weekStartDate: '2026-08-03',
  title: 'Launch campaign brief',
  businessOutcome: 'Approve the campaign brief for production',
};

describe('weekly work policy', () => {
  it.each(['admin', 'cco', 'department_head', 'marketing_manager'])(
    'allows %s to create weekly work',
    (role) => expect(() => checkWeeklyWorkPermission(role, 'weekly-work:create')).not.toThrow(),
  );

  it.each(['social_media_manager', 'sales_manager', 'specialist', 'reviewer', 'viewer'])(
    'does not allow %s to create weekly work directly',
    (role) => expect(() => checkWeeklyWorkPermission(role, 'weekly-work:create')).toThrow(ForbiddenError),
  );

  it('reserves approval for the CCO', () => {
    expect(() => checkWeeklyWorkPermission('cco', 'weekly-work:approve')).not.toThrow();
    expect(() => checkWeeklyWorkPermission('admin', 'weekly-work:approve')).toThrow(ForbiddenError);
    expect(() => checkWeeklyWorkPermission('department_head', 'weekly-work:approve')).toThrow(ForbiddenError);
  });

  it.each(['admin', 'cco', 'department_head', 'marketing_manager', 'social_media_manager', 'sales_manager', 'lead_qualification_manager', 'specialist', 'reviewer', 'viewer'])(
    'allows %s to read weekly work',
    (role) => expect(() => checkWeeklyWorkPermission(role, 'weekly-work:read')).not.toThrow(),
  );
});

describe('weekly work input validation', () => {
  it('accepts a complete weekly item inside Monday through Sunday', () => {
    expect(createWeeklyWorkItemSchema.parse({
      ...base,
      startDate: '2026-08-03',
      dueDate: '2026-08-09',
      priority: 'high',
      budgetGuardrail: 5000,
      linkType: 'event',
      linkObjectId: 'event-1',
    })).toMatchObject({ status: 'planned', priority: 'high' });
  });

  it('rejects a due date outside the selected week', () => {
    expect(() => createWeeklyWorkItemSchema.parse({ ...base, dueDate: '2026-08-10' })).toThrow(/inside the selected week/);
  });

  it('rejects a linked object without its type', () => {
    expect(() => createWeeklyWorkItemSchema.parse({ ...base, linkObjectId: 'event-1' })).toThrow(/provided together/);
  });

  it('rejects an update with no changed field', () => {
    expect(() => updateWeeklyWorkItemSchema.parse({ expectedRevision: 1 })).toThrow(/At least one/);
  });

  it('requires a supported transition target', () => {
    expect(() => transitionWeeklyWorkItemSchema.parse({ expectedRevision: 1, targetStatus: 'invented' })).toThrow();
  });
});
