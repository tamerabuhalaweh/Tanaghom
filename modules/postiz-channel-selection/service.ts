import { ForbiddenError, NotFoundError } from '@shared/errors';
import { auditLog } from '@shared/logging';
import { checkChannelSelectionPermission, evaluateChannelReadiness, assertReadyForScheduling } from './policy';
import * as repo from './repository';
import type {
  SelectChannelForEventInput,
  SelectChannelForPackageInput,
  DeselectChannelInput,
  ChannelSelectionSummary,
  ChannelReadiness,
  ChannelSelectionListResult,
} from './types';

export async function listChannelsForEvent(
  requesterRole: string,
  tenantKey: string,
  eventId: string,
): Promise<ChannelSelectionListResult> {
  checkChannelSelectionPermission(requesterRole, 'channel_selection:read');

  const event = await repo.getEventById(tenantKey, eventId);
  if (!event) throw new NotFoundError('CommercialEvent', eventId);

  const connectors = await repo.listConnectorsForTenant(tenantKey);

  const selections: ChannelSelectionSummary[] = [];
  const postizTags = event.selectedChannels.filter(tag => tag.startsWith('postiz:'));
  for (let index = 0; index < postizTags.length; index++) {
    const parsed = repo.parseChannelTag(postizTags[index]);
    if (!parsed) continue;
    selections.push({
      id: `event-channel-${eventId}-${index}`,
      tenantKey,
      eventId,
      publishingPackageId: null,
      postizConnectorId: connectors.find(c => c.supportsSchedule)?.id || '',
      postizIntegrationChannelId: parsed.integrationChannelId,
      platform: parsed.platform,
      channelDisplayName: null,
      selectionStatus: 'selected',
      selectedByUserId: '',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
  }

  const readiness = evaluateChannelReadiness({
    connectorExists: connectors.length > 0,
    connectorStatus: connectors[0]?.connectorStatus || null,
    channelExists: selections.length > 0,
    channelDisabled: false,
    channelRefreshNeeded: false,
    platform: selections[0]?.platform || null,
    channelDisplayName: selections[0]?.channelDisplayName || null,
    integrationChannelId: selections[0]?.postizIntegrationChannelId || null,
  });

  return { selections, readiness };
}

export async function selectChannelForEvent(
  requesterRole: string,
  tenantKey: string,
  userId: string,
  input: SelectChannelForEventInput,
): Promise<{ selection: ChannelSelectionSummary; readiness: ChannelReadiness }> {
  checkChannelSelectionPermission(requesterRole, 'channel_selection:select');

  const event = await repo.getEventById(tenantKey, input.eventId);
  if (!event) throw new NotFoundError('CommercialEvent', input.eventId);

  const connector = await repo.getConnectorById(input.postizConnectorId);
  if (!connector) throw new NotFoundError('PostizConnector', input.postizConnectorId);
  if (connector.connectorStatus !== 'active') {
    throw new ForbiddenError(`Postiz connector is ${connector.connectorStatus}, not active`);
  }

  const channelTag = repo.buildChannelTag(input.platform, input.postizIntegrationChannelId);
  await repo.updateEventSelectedChannels(tenantKey, input.eventId, channelTag, 'add');

  const readiness = evaluateChannelReadiness({
    connectorExists: true,
    connectorStatus: connector.connectorStatus,
    channelExists: true,
    channelDisabled: false,
    channelRefreshNeeded: false,
    platform: input.platform,
    channelDisplayName: input.channelDisplayName || null,
    integrationChannelId: input.postizIntegrationChannelId,
  });

  auditLog(
    {
      actor: `user:${userId}`,
      action: 'postiz_channel_selected_for_event',
      object_type: 'commercial_event',
      object_id: input.eventId,
      result: 'success',
    },
    `Channel ${input.platform}:${input.postizIntegrationChannelId} selected for event ${input.eventId}`,
  );

  const selection: ChannelSelectionSummary = {
    id: `event-channel-${input.eventId}-new`,
    tenantKey,
    eventId: input.eventId,
    publishingPackageId: null,
    postizConnectorId: input.postizConnectorId,
    postizIntegrationChannelId: input.postizIntegrationChannelId,
    platform: input.platform,
    channelDisplayName: input.channelDisplayName || null,
    selectionStatus: 'selected',
    selectedByUserId: userId,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  return { selection, readiness };
}

export async function deselectChannelForEvent(
  requesterRole: string,
  tenantKey: string,
  userId: string,
  eventId: string,
  input: DeselectChannelInput,
): Promise<void> {
  checkChannelSelectionPermission(requesterRole, 'channel_selection:deselect');

  const event = await repo.getEventById(tenantKey, eventId);
  if (!event) throw new NotFoundError('CommercialEvent', eventId);

  const postizChannels = event.selectedChannels.filter(ch => ch.startsWith('postiz:'));
  for (const tag of postizChannels) {
    await repo.updateEventSelectedChannels(tenantKey, eventId, tag, 'remove');
  }

  auditLog(
    {
      actor: `user:${userId}`,
      action: 'postiz_channel_deselected_for_event',
      object_type: 'commercial_event',
      object_id: eventId,
      result: 'success',
    },
    `Postiz channels deselected for event ${eventId}${input.reason ? `: ${input.reason}` : ''}`,
  );
}

export async function getChannelReadinessForEvent(
  requesterRole: string,
  tenantKey: string,
  eventId: string,
): Promise<ChannelReadiness> {
  checkChannelSelectionPermission(requesterRole, 'channel_selection:read');

  const event = await repo.getEventById(tenantKey, eventId);
  if (!event) throw new NotFoundError('CommercialEvent', eventId);

  const connectors = await repo.listConnectorsForTenant(tenantKey);
  const postizChannel = event.selectedChannels.find(ch => ch.startsWith('postiz:'));
  const parsed = postizChannel ? repo.parseChannelTag(postizChannel) : null;

  return evaluateChannelReadiness({
    connectorExists: connectors.length > 0,
    connectorStatus: connectors[0]?.connectorStatus || null,
    channelExists: Boolean(parsed),
    channelDisabled: false,
    channelRefreshNeeded: false,
    platform: parsed?.platform || null,
    channelDisplayName: null,
    integrationChannelId: parsed?.integrationChannelId || null,
  });
}

export async function getChannelReadinessForPackage(
  requesterRole: string,
  tenantKey: string,
  packageId: string,
): Promise<ChannelReadiness> {
  checkChannelSelectionPermission(requesterRole, 'channel_selection:read');

  const pkg = await repo.getPublishingPackageById(tenantKey, packageId);
  if (!pkg) throw new NotFoundError('PublishingPackage', packageId);

  const connectors = await repo.listConnectorsForTenant(tenantKey);

  let eventChannels: string[] = [];
  if (pkg.eventId) {
    const event = await repo.getEventById(tenantKey, pkg.eventId);
    if (event) eventChannels = event.selectedChannels.filter(ch => ch.startsWith('postiz:'));
  }

  const postizChannel = eventChannels[0] || null;
  const parsed = postizChannel ? repo.parseChannelTag(postizChannel) : null;

  return evaluateChannelReadiness({
    connectorExists: connectors.length > 0,
    connectorStatus: connectors[0]?.connectorStatus || null,
    channelExists: Boolean(parsed),
    channelDisabled: false,
    channelRefreshNeeded: false,
    platform: parsed?.platform || null,
    channelDisplayName: null,
    integrationChannelId: parsed?.integrationChannelId || null,
  });
}
