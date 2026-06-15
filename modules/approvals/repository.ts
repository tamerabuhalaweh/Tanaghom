import { prisma } from '@shared/database';
import { NotFoundError, ConflictError } from '@shared/errors';
import type { ApprovalRecord, ApprovalDecision } from './types';

export async function createApprovalRecords(
  records: Omit<ApprovalRecord, 'id' | 'submittedAt' | 'decidedAt' | 'reminderSent' | 'escalated'>[],
): Promise<ApprovalRecord[]> {
  const created = await Promise.all(
    records.map((record) =>
      prisma.approvalEvent.create({
        data: {
          content_item_id: record.contentItemId,
          reviewer_id: record.approverId || '',
          department: record.department,
          decision: 'needs_changes' as ApprovalDecision,
          comments: record.reason,
        },
      }),
    ),
  );
  return created.map(mapApprovalRecord);
}

export async function getApprovalRecordsByContentItem(contentItemId: string): Promise<ApprovalRecord[]> {
  const records = await prisma.approvalEvent.findMany({
    where: { content_item_id: contentItemId },
    orderBy: { timestamp: 'asc' },
  });
  return records.map(mapApprovalRecord);
}

export async function getApprovalRecordById(id: string): Promise<ApprovalRecord> {
  const record = await prisma.approvalEvent.findUnique({
    where: { id },
  });
  if (!record) throw new NotFoundError('Approval record', id);
  return mapApprovalRecord(record);
}

export async function recordDecision(
  approvalRecordId: string,
  approverId: string,
  decision: ApprovalDecision,
  comments: string | null,
): Promise<ApprovalRecord> {
  const existing = await prisma.approvalEvent.findUnique({
    where: { id: approvalRecordId },
  });
  if (!existing) throw new NotFoundError('Approval record', approvalRecordId);

  if (existing.decision === 'approved' || existing.decision === 'rejected') {
    throw new ConflictError('Approval decision already recorded');
  }

  const updated = await prisma.approvalEvent.update({
    where: { id: approvalRecordId },
    data: {
      reviewer_id: approverId,
      decision,
      comments,
      timestamp: new Date(),
    },
  });
  return mapApprovalRecord(updated);
}

export async function getPendingApprovals(): Promise<ApprovalRecord[]> {
  const records = await prisma.approvalEvent.findMany({
    where: {
      decision: 'needs_changes',
    },
    orderBy: { timestamp: 'asc' },
  });
  return records.map(mapApprovalRecord);
}

export async function getApprovalsByDepartment(department: string): Promise<ApprovalRecord[]> {
  const records = await prisma.approvalEvent.findMany({
    where: { department },
    orderBy: { timestamp: 'desc' },
  });
  return records.map(mapApprovalRecord);
}

function mapApprovalRecord(r: Record<string, unknown>): ApprovalRecord {
  return {
    id: r.id as string,
    contentItemId: r.content_item_id as string,
    campaignRequestId: '',
    department: r.department as string,
    approverRole: '',
    approverId: r.reviewer_id as string | null,
    decision: r.decision as ApprovalDecision | null,
    comments: r.comments as string | null,
    required: true,
    reason: '',
    submittedAt: r.timestamp as Date,
    decidedAt: r.decision ? (r.timestamp as Date) : null,
    slaDeadline: new Date((r.timestamp as Date).getTime() + 24 * 60 * 60 * 1000),
    reminderSent: false,
    escalated: false,
  };
}
