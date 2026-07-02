import { prisma } from '@shared/database';
import { NotFoundError } from '@shared/errors';
import { getActiveIntegrationCredential } from '../integration-credentials/service';
import type { ChannelSelectionSummary, ChannelSelectionStatus } from './types';

export async function getConnectorById(id: string): Promise<{
  id: string;
  connectorName: string;
  connectorStatus: string;
  supportsSchedule: boolean;
  m5Allowed: boolean;
} | null> {
  const connector = await prisma.postizConnector.findUnique({
    where: { id },
    select: {
      id: true,
      connector_name: true,
      connector_status: true,
      supports_schedule: true,
      m5_allowed: true,
    },
  });
  if (!connector) return null;
  return {
    id: connector.id,
    connectorName: connector.connector_name,
    connectorStatus: connector.connector_status,
    supportsSchedule: connector.supports_schedule,
    m5Allowed: connector.m5_allowed,
  };
}

export async function getEventById(tenantKey: string, eventId: string): Promise<{
  id: string;
  tenantKey: string;
  name: string;
  selectedChannels: string[];
  status: string;
} | null> {
  const event = await prisma.commercialEvent.findFirst({
    where: { id: eventId, tenant_key: tenantKey },
    select: {
      id: true,
      tenant_key: true,
      name: true,
      selected_channels: true,
      status: true,
    },
  });
  if (!event) return null;
  return {
    id: event.id,
    tenantKey: event.tenant_key,
    name: event.name,
    selectedChannels: event.selected_channels,
    status: event.status,
  };
}

export async function getPublishingPackageById(tenantKey: string, packageId: string): Promise<{
  id: string;
  tenantKey: string;
  packageStatus: string;
  eventId: string | null;
} | null> {
  const pkg = await prisma.publishingPackage.findFirst({
    where: { id: packageId, tenant_key: tenantKey },
    select: {
      id: true,
      tenant_key: true,
      package_status: true,
      event_id: true,
    },
  });
  if (!pkg) return null;
  return {
    id: pkg.id,
    tenantKey: pkg.tenant_key,
    packageStatus: pkg.package_status,
    eventId: pkg.event_id,
  };
}

export async function listConnectorsForTenant(_tenantKey: string): Promise<Array<{
  id: string;
  connectorName: string;
  connectorStatus: string;
  supportsSchedule: boolean;
}>> {
  const connectors = await prisma.postizConnector.findMany({
    where: { connector_status: 'active' },
    select: {
      id: true,
      connector_name: true,
      connector_status: true,
      supports_schedule: true,
    },
    orderBy: { connector_name: 'asc' },
  });
  return connectors.map(c => ({
    id: c.id,
    connectorName: c.connector_name,
    connectorStatus: c.connector_status,
    supportsSchedule: c.supports_schedule,
  }));
}

export async function updateEventSelectedChannels(
  tenantKey: string,
  eventId: string,
  channelTag: string,
  action: 'add' | 'remove',
): Promise<void> {
  const event = await prisma.commercialEvent.findFirst({
    where: { id: eventId, tenant_key: tenantKey },
    select: { id: true, selected_channels: true },
  });
  if (!event) throw new NotFoundError('CommercialEvent', eventId);

  const current = event.selected_channels;
  const updated = action === 'add'
    ? [...new Set([...current, channelTag])]
    : current.filter(ch => ch !== channelTag);

  await prisma.commercialEvent.update({
    where: { id: eventId },
    data: { selected_channels: updated },
  });
}

export function buildChannelTag(platform: string, integrationChannelId: string): string {
  return `postiz:${encodeURIComponent(platform)}:${encodeURIComponent(integrationChannelId)}`;
}

export function parseChannelTag(tag: string): { platform: string; integrationChannelId: string } | null {
  const parts = tag.split(':');
  if (parts.length !== 3 || parts[0] !== 'postiz') return null;
  return {
    platform: decodeURIComponent(parts[1]),
    integrationChannelId: decodeURIComponent(parts[2]),
  };
}

export async function getTenantSelectedPostizChannel(tenantKey: string): Promise<{
  integrationChannelId: string;
  platform: string | null;
  channelDisplayName: string | null;
  disabled: boolean;
  refreshNeeded: boolean;
} | null> {
  const credential = await getActiveIntegrationCredential('postiz', 'api_key', tenantKey);
  const integrationChannelId = credential?.secrets.integrationId;
  if (!credential || !integrationChannelId) return null;

  const selectedChannel = normalizeSelectedChannel(credential.metadata.selectedChannel);
  return {
    integrationChannelId,
    platform: selectedChannel.platform,
    channelDisplayName: selectedChannel.channelDisplayName,
    disabled: selectedChannel.disabled,
    refreshNeeded: selectedChannel.refreshNeeded,
  };
}

function normalizeSelectedChannel(value: unknown): {
  platform: string | null;
  channelDisplayName: string | null;
  disabled: boolean;
  refreshNeeded: boolean;
} {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return {
      platform: null,
      channelDisplayName: null,
      disabled: false,
      refreshNeeded: false,
    };
  }
  const record = value as Record<string, unknown>;
  return {
    platform: safeString(record.type) || safeString(record.providerIdentifier),
    channelDisplayName: safeString(record.name) || safeString(record.profile),
    disabled: Boolean(record.disabled),
    refreshNeeded: Boolean(record.refreshNeeded),
  };
}

function safeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function mapChannelSelection(record: {
  id: string;
  tenantKey: string;
  eventId: string | null;
  publishingPackageId: string | null;
  postizConnectorId: string;
  postizIntegrationChannelId: string;
  platform: string;
  channelDisplayName: string | null;
  selectionStatus: ChannelSelectionStatus;
  selectedByUserId: string;
  createdAt: Date;
  updatedAt: Date;
}): ChannelSelectionSummary {
  return { ...record };
}
