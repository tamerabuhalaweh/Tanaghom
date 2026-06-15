import type { ApprovalDecision } from './types';

export const APPROVAL_EVENTS = {
  SUBMITTED_FOR_APPROVAL: 'approval.submitted',
  APPROVAL_DECISION_RECORDED: 'approval.decision_recordd',
  ALL_APPROVALS_COLLECTED: 'approval.all_collected',
  APPROVAL_REMINDER_SENT: 'approval.reminder_sent',
  APPROVAL_ESCALATED: 'approval.escalated',
  APPROVAL_EXPIRED: 'approval.expired',
} as const;

export interface SubmittedForApprovalEvent {
  contentItemId: string;
  campaignRequestId: string;
  riskCategory: string;
  totalRequired: number;
  timestamp: Date;
}

export interface ApprovalDecisionRecorddEvent {
  approvalRecordId: string;
  contentItemId: string;
  approverId: string;
  department: string;
  decision: ApprovalDecision;
  comments: string | null;
  timestamp: Date;
}

export interface AllApprovalsCollectedEvent {
  contentItemId: string;
  finalStatus: 'approved' | 'rejected';
  approvedCount: number;
  rejectedCount: number;
  timestamp: Date;
}

export interface ApprovalReminderEvent {
  approvalRecordId: string;
  contentItemId: string;
  department: string;
  hoursWaiting: number;
  timestamp: Date;
}

export interface ApprovalEscalatedEvent {
  approvalRecordId: string;
  contentItemId: string;
  department: string;
  hoursWaiting: number;
  escalatedTo: string;
  timestamp: Date;
}
