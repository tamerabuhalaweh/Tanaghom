import { describe, it, expect } from 'vitest';
import { validateSubmitForApproval, validateApprovalDecision, validateCheckApprovalStatus } from '../validators';
import { ValidationError } from '@shared/errors';

describe('Approval Validators', () => {
  describe('submitForApproval', () => {
    it('accepts valid input', () => {
      const result = validateSubmitForApproval({
        contentItemId: '550e8400-e29b-41d4-a716-446655440000',
        campaignRequestId: '550e8400-e29b-41d4-a716-446655440001',
        riskCategory: 'medium',
        contentType: 'campaign',
        ownerDepartmentId: '550e8400-e29b-41d4-a716-446655440002',
        platform: 'linkedin',
        draftText: 'Test draft content for approval',
      });
      expect(result.riskCategory).toBe('medium');
    });

    it('accepts with optional deadline', () => {
      const result = validateSubmitForApproval({
        contentItemId: '550e8400-e29b-41d4-a716-446655440000',
        campaignRequestId: '550e8400-e29b-41d4-a716-446655440001',
        riskCategory: 'high',
        contentType: 'announcement',
        ownerDepartmentId: '550e8400-e29b-41d4-a716-446655440002',
        platform: 'instagram',
        draftText: 'Important announcement',
        deadline: '2026-07-01T10:00:00Z',
      });
      expect(result.deadline).toBe('2026-07-01T10:00:00Z');
    });

    it('rejects invalid riskCategory', () => {
      expect(() => validateSubmitForApproval({
        contentItemId: '550e8400-e29b-41d4-a716-446655440000',
        campaignRequestId: '550e8400-e29b-41d4-a716-446655440001',
        riskCategory: 'extreme',
        contentType: 'campaign',
        ownerDepartmentId: '550e8400-e29b-41d4-a716-446655440002',
        platform: 'linkedin',
        draftText: 'Test',
      })).toThrow(ValidationError);
    });

    it('rejects empty draftText', () => {
      expect(() => validateSubmitForApproval({
        contentItemId: '550e8400-e29b-41d4-a716-446655440000',
        campaignRequestId: '550e8400-e29b-41d4-a716-446655440001',
        riskCategory: 'low',
        contentType: 'campaign',
        ownerDepartmentId: '550e8400-e29b-41d4-a716-446655440002',
        platform: 'linkedin',
        draftText: '',
      })).toThrow(ValidationError);
    });
  });

  describe('approvalDecision', () => {
    it('accepts valid approve decision', () => {
      const result = validateApprovalDecision({
        approvalRecordId: '550e8400-e29b-41d4-a716-446655440000',
        decision: 'approved',
        comments: 'Looks good, approved',
      });
      expect(result.decision).toBe('approved');
    });

    it('accepts valid reject decision', () => {
      const result = validateApprovalDecision({
        approvalRecordId: '550e8400-e29b-41d4-a716-446655440000',
        decision: 'rejected',
        comments: 'Contains medical claims',
      });
      expect(result.decision).toBe('rejected');
    });

    it('accepts needs_changes decision', () => {
      const result = validateApprovalDecision({
        approvalRecordId: '550e8400-e29b-41d4-a716-446655440000',
        decision: 'needs_changes',
      });
      expect(result.decision).toBe('needs_changes');
    });

    it('rejects invalid decision', () => {
      expect(() => validateApprovalDecision({
        approvalRecordId: '550e8400-e29b-41d4-a716-446655440000',
        decision: 'maybe',
      })).toThrow(ValidationError);
    });
  });

  describe('checkApprovalStatus', () => {
    it('accepts valid contentItemId', () => {
      const result = validateCheckApprovalStatus({
        contentItemId: '550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.contentItemId).toBe('550e8400-e29b-41d4-a716-446655440000');
    });

    it('rejects invalid contentItemId', () => {
      expect(() => validateCheckApprovalStatus({
        contentItemId: 'not-a-uuid',
      })).toThrow(ValidationError);
    });
  });
});
