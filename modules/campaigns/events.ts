import type { ContentState } from './types';

export const CAMPAIGN_EVENTS = {
  CAMPAIGN_CREATED: 'campaign.created',
  CAMPAIGN_UPDATED: 'campaign.updated',
  CAMPAIGN_STATUS_CHANGED: 'campaign.status_changed',
  CAMPAIGN_DRAFT_REQUESTED: 'campaign.draft_requested',
} as const;

export interface CampaignCreatedEvent {
  campaignId: string;
  requesterId: string;
  ownerDepartmentId: string;
  contentType: string;
  riskCategory: string;
  timestamp: Date;
}

export interface CampaignUpdatedEvent {
  campaignId: string;
  changes: Record<string, unknown>;
  updatedBy: string;
  timestamp: Date;
}

export interface CampaignStatusChangedEvent {
  campaignId: string;
  fromState: ContentState;
  toState: ContentState;
  changedBy: string;
  reason?: string;
  timestamp: Date;
}
