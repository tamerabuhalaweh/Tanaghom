import { ForbiddenError } from '@shared/errors';
import type { ChannelReadiness, ChannelReadinessCheck, ChannelReadinessState } from './types';

export const CHANNEL_SELECTION_PERMISSIONS: Record<string, string[]> = {
  admin: ['channel_selection:read', 'channel_selection:select', 'channel_selection:deselect'],
  cco: ['channel_selection:read', 'channel_selection:select', 'channel_selection:deselect'],
  department_head: ['channel_selection:read', 'channel_selection:select', 'channel_selection:deselect'],
  marketing_manager: ['channel_selection:read', 'channel_selection:select', 'channel_selection:deselect'],
  social_media_manager: ['channel_selection:read', 'channel_selection:select'],
  specialist: ['channel_selection:read'],
  reviewer: ['channel_selection:read'],
  viewer: ['channel_selection:read'],
};

export function checkChannelSelectionPermission(role: string, permission: string): void {
  const allowed = CHANNEL_SELECTION_PERMISSIONS[role];
  if (!allowed || !allowed.includes(permission)) {
    throw new ForbiddenError(`Role '${role}' does not have permission '${permission}'`);
  }
}

export function evaluateChannelReadiness(input: {
  connectorExists: boolean;
  connectorStatus: string | null;
  channelExists: boolean;
  channelDisabled: boolean;
  channelRefreshNeeded: boolean;
  platform: string | null;
  channelDisplayName: string | null;
  integrationChannelId: string | null;
}): ChannelReadiness {
  const checks: ChannelReadinessCheck[] = [];
  let state: ChannelReadinessState = 'ready';

  if (!input.connectorExists) {
    state = 'no_connector_binding';
    checks.push({
      id: 'connector_binding',
      label: 'Postiz connector binding',
      status: 'blocked',
      detail: 'No Postiz connector is bound to this event or package.',
    });
  } else {
    checks.push({
      id: 'connector_binding',
      label: 'Postiz connector binding',
      status: 'passed',
      detail: `Postiz connector ${input.connectorExists ? 'is bound' : 'missing'}.`,
    });
  }

  if (input.connectorStatus && input.connectorStatus !== 'active') {
    state = 'connector_inactive';
    checks.push({
      id: 'connector_status',
      label: 'Connector status',
      status: 'blocked',
      detail: `Postiz connector is ${input.connectorStatus}, not active.`,
    });
  } else if (input.connectorExists) {
    checks.push({
      id: 'connector_status',
      label: 'Connector status',
      status: 'passed',
      detail: 'Postiz connector is active.',
    });
  }

  if (!input.channelExists) {
    if (state === 'ready') state = 'channel_not_found';
    checks.push({
      id: 'channel_exists',
      label: 'Channel availability',
      status: 'blocked',
      detail: 'The selected Postiz channel was not found in the connector.',
    });
  } else {
    checks.push({
      id: 'channel_exists',
      label: 'Channel availability',
      status: 'passed',
      detail: `Channel ${input.channelDisplayName || input.integrationChannelId || 'selected'} is available.`,
    });
  }

  if (input.channelDisabled) {
    if (state === 'ready') state = 'channel_disabled';
    checks.push({
      id: 'channel_disabled',
      label: 'Channel enabled',
      status: 'blocked',
      detail: 'The selected channel is disabled in Postiz.',
    });
  } else if (input.channelExists) {
    checks.push({
      id: 'channel_disabled',
      label: 'Channel enabled',
      status: 'passed',
      detail: 'Channel is enabled.',
    });
  }

  if (input.channelRefreshNeeded) {
    if (state === 'ready') state = 'channel_refresh_needed';
    checks.push({
      id: 'channel_refresh',
      label: 'Channel token',
      status: 'warning',
      detail: 'Channel token needs refresh. Re-authenticate in Postiz before scheduling.',
    });
  } else if (input.channelExists) {
    checks.push({
      id: 'channel_refresh',
      label: 'Channel token',
      status: 'passed',
      detail: 'Channel token is valid.',
    });
  }

  if (!input.platform && state === 'ready') {
    state = 'missing_credentials';
    checks.push({
      id: 'platform',
      label: 'Platform',
      status: 'blocked',
      detail: 'No platform is specified for the channel.',
    });
  }

  return {
    state,
    connectorId: null,
    connectorStatus: input.connectorStatus,
    integrationChannelId: input.integrationChannelId,
    platform: input.platform,
    channelDisplayName: input.channelDisplayName,
    channelDisabled: input.channelDisabled,
    channelRefreshNeeded: input.channelRefreshNeeded,
    checks,
  };
}

export function assertReadyForScheduling(readiness: ChannelReadiness): void {
  if (readiness.state !== 'ready') {
    throw new ForbiddenError(
      `Channel is not ready for scheduling: ${readiness.state}. Resolve blocked checks first.`,
    );
  }
}
