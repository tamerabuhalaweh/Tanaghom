export interface PublishingApprovalGateInput {
  approvalId?: string | null;
  approvalStatus?: string | null;
  approvalTargetType?: string | null;
  approvalTargetId?: string | null;
  campaignId: string;
  draftId?: string | null;
}

export function validatePublishingApprovalGate(input: PublishingApprovalGateInput): { allowed: boolean; reason?: string } {
  if (!input.approvalId) {
    return { allowed: false, reason: 'Approved approvalId is required before publishing package creation' };
  }
  if (input.approvalStatus !== 'approved') {
    return { allowed: false, reason: `Publishing package requires approved status. Current approval status is ${input.approvalStatus || 'missing'}` };
  }
  if (input.approvalTargetType === 'content_item' && input.draftId && input.approvalTargetId !== input.draftId) {
    return { allowed: false, reason: 'Approval target does not match selected draft' };
  }
  if (input.approvalTargetType === 'campaign' && input.approvalTargetId !== input.campaignId) {
    return { allowed: false, reason: 'Approval target does not match selected campaign' };
  }
  return { allowed: true };
}
