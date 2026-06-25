import { describe, expect, it } from 'vitest';
import { validatePublishingApprovalGate } from '../policy';

describe('publishing package approval gate', () => {
  it('blocks package creation without approval id', () => {
    const result = validatePublishingApprovalGate({
      campaignId: 'campaign-1',
      draftId: 'draft-1',
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('approvalId is required');
  });

  it('blocks package creation when approval is not approved', () => {
    const result = validatePublishingApprovalGate({
      approvalId: 'approval-1',
      approvalStatus: 'pending',
      approvalTargetType: 'content_item',
      approvalTargetId: 'draft-1',
      campaignId: 'campaign-1',
      draftId: 'draft-1',
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('requires approved status');
  });

  it('blocks content item package creation when approval target does not match draft', () => {
    const result = validatePublishingApprovalGate({
      approvalId: 'approval-1',
      approvalStatus: 'approved',
      approvalTargetType: 'content_item',
      approvalTargetId: 'draft-2',
      campaignId: 'campaign-1',
      draftId: 'draft-1',
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('selected draft');
  });

  it('blocks campaign package creation when approval target does not match campaign', () => {
    const result = validatePublishingApprovalGate({
      approvalId: 'approval-1',
      approvalStatus: 'approved',
      approvalTargetType: 'campaign',
      approvalTargetId: 'campaign-2',
      campaignId: 'campaign-1',
    });

    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('selected campaign');
  });

  it('allows package creation for an approved matching content item', () => {
    const result = validatePublishingApprovalGate({
      approvalId: 'approval-1',
      approvalStatus: 'approved',
      approvalTargetType: 'content_item',
      approvalTargetId: 'draft-1',
      campaignId: 'campaign-1',
      draftId: 'draft-1',
    });

    expect(result.allowed).toBe(true);
  });
});
