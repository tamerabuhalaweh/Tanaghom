import { ForbiddenError } from '@shared/errors';
import { auditLog } from '@shared/logging';
import { eventBus } from '@shared/events';
import {
  CAMPAIGN_EVENTS,
  type CampaignCreatedEvent,
  type CampaignUpdatedEvent,
  type CampaignStatusChangedEvent,
} from './events';
import { validateTransition, type ContentState } from './types';
import * as repo from './repository';
import type { CreateCampaignInput, UpdateCampaignInput, CampaignSummary } from './types';

// ============================================================
// Permission Map
// ============================================================

const PERMISSIONS: Record<string, string[]> = {
  admin: ['campaigns:read', 'campaigns:create', 'campaigns:update', 'campaigns:transition'],
  cco: ['campaigns:read', 'campaigns:create', 'campaigns:update', 'campaigns:transition'],
  department_head: ['campaigns:read', 'campaigns:create', 'campaigns:update', 'campaigns:transition'],
  specialist: ['campaigns:read', 'campaigns:create', 'campaigns:update'],
  reviewer: ['campaigns:read'],
  viewer: ['campaigns:read'],
};

function checkPermission(role: string, permission: string): void {
  const allowed = PERMISSIONS[role];
  if (!allowed || !allowed.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}

// ============================================================
// Campaign Service
// ============================================================

export async function listCampaigns(
  requesterRole: string,
  requesterId?: string,
  status?: ContentState,
  platform?: string,
): Promise<CampaignSummary[]> {
  checkPermission(requesterRole, 'campaigns:read');
  return repo.listCampaigns(requesterId, status, platform);
}

export async function getCampaign(requesterRole: string, id: string): Promise<CampaignSummary> {
  checkPermission(requesterRole, 'campaigns:read');
  return repo.getCampaignById(id);
}

export async function createCampaign(
  requesterRole: string,
  requesterId: string,
  channel: string,
  input: CreateCampaignInput,
): Promise<CampaignSummary> {
  checkPermission(requesterRole, 'campaigns:create');
  const campaign = await repo.createCampaign(requesterId, channel, input);

  auditLog(
    {
      actor: `user:${requesterId}`,
      action: 'campaign_created',
      object_type: 'content_request',
      object_id: campaign.id,
      result: 'success',
    },
    `Campaign created: ${campaign.topic} (${campaign.contentType})`,
  );

  const event: CampaignCreatedEvent = {
    campaignId: campaign.id,
    requesterId,
    ownerDepartmentId: input.ownerDepartmentId,
    contentType: input.contentType,
    riskCategory: input.riskCategory,
    timestamp: new Date(),
  };
  await eventBus.emit(CAMPAIGN_EVENTS.CAMPAIGN_CREATED, event);

  return campaign;
}

export async function updateCampaign(
  requesterRole: string,
  requesterId: string,
  id: string,
  input: UpdateCampaignInput,
): Promise<CampaignSummary> {
  checkPermission(requesterRole, 'campaigns:update');

  const existing = await repo.getCampaignById(id);

  const campaign = await repo.updateCampaign(id, input);

  auditLog(
    {
      actor: `user:${requesterId}`,
      action: 'campaign_updated',
      object_type: 'content_request',
      object_id: id,
      result: 'success',
    },
    `Campaign updated: ${campaign.topic}`,
  );

  const event: CampaignUpdatedEvent = {
    campaignId: id,
    changes: input as Record<string, unknown>,
    updatedBy: requesterId,
    timestamp: new Date(),
  };
  await eventBus.emit(CAMPAIGN_EVENTS.CAMPAIGN_UPDATED, event);

  return campaign;
}

export async function transitionCampaign(
  requesterRole: string,
  requesterId: string,
  id: string,
  toState: ContentState,
  reason?: string,
): Promise<CampaignSummary> {
  checkPermission(requesterRole, 'campaigns:transition');

  const existing = await repo.getCampaignById(id);
  const fromState = existing.status;

  // Validate the transition is allowed by the state machine
  validateTransition(fromState, toState);

  const campaign = await repo.updateCampaignStatus(id, toState);

  auditLog(
    {
      actor: `user:${requesterId}`,
      action: 'campaign_status_changed',
      object_type: 'content_request',
      object_id: id,
      result: 'success',
    },
    `Campaign status: ${fromState} → ${toState}${reason ? ` (${reason})` : ''}`,
  );

  const event: CampaignStatusChangedEvent = {
    campaignId: id,
    fromState,
    toState,
    changedBy: requesterId,
    reason,
    timestamp: new Date(),
  };
  await eventBus.emit(CAMPAIGN_EVENTS.CAMPAIGN_STATUS_CHANGED, event);

  return campaign;
}
