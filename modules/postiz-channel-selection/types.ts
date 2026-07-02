import { z } from 'zod';

export const CHANNEL_SELECTION_STATUSES = ['selected', 'deselected', 'revoked'] as const;
export type ChannelSelectionStatus = (typeof CHANNEL_SELECTION_STATUSES)[number];

export const CHANNEL_READINESS_STATES = [
  'ready',
  'missing_credentials',
  'no_channels_available',
  'channel_not_found',
  'channel_disabled',
  'channel_refresh_needed',
  'connector_inactive',
  'no_connector_binding',
] as const;
export type ChannelReadinessState = (typeof CHANNEL_READINESS_STATES)[number];

export const selectChannelForEventSchema = z.object({
  eventId: z.string().uuid('Invalid event ID'),
  postizConnectorId: z.string().uuid('Invalid Postiz connector ID'),
  postizIntegrationChannelId: z.string().min(1, 'Postiz integration channel ID is required').max(200),
  platform: z.string().min(1).max(100),
  channelDisplayName: z.string().max(200).optional(),
});

export const selectChannelForPackageSchema = z.object({
  publishingPackageId: z.string().uuid('Invalid publishing package ID'),
  postizConnectorId: z.string().uuid('Invalid Postiz connector ID'),
  postizIntegrationChannelId: z.string().min(1, 'Postiz integration channel ID is required').max(200),
  platform: z.string().min(1).max(100),
  channelDisplayName: z.string().max(200).optional(),
});

export const deselectChannelSchema = z.object({
  reason: z.string().max(1000).optional(),
});

export type SelectChannelForEventInput = z.infer<typeof selectChannelForEventSchema>;
export type SelectChannelForPackageInput = z.infer<typeof selectChannelForPackageSchema>;
export type DeselectChannelInput = z.infer<typeof deselectChannelSchema>;

export interface ChannelSelectionSummary {
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
}

export interface ChannelReadiness {
  state: ChannelReadinessState;
  connectorId: string | null;
  connectorStatus: string | null;
  integrationChannelId: string | null;
  platform: string | null;
  channelDisplayName: string | null;
  channelDisabled: boolean;
  channelRefreshNeeded: boolean;
  checks: ChannelReadinessCheck[];
}

export interface ChannelReadinessCheck {
  id: string;
  label: string;
  status: 'passed' | 'blocked' | 'warning';
  detail: string;
}

export interface ChannelSelectionListResult {
  selections: ChannelSelectionSummary[];
  readiness: ChannelReadiness;
}
