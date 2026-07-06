import { ValidationError } from '@shared/errors';
import type { DecryptedIntegrationCredential } from '../../integration-credentials/service';
import type { DryRunKpiRow, DryRunResult } from '../types';

interface PostizDryRunInput {
  credential: DecryptedIntegrationCredential;
  eventId?: string;
}

interface PostizIntegration {
  id: string;
  name?: string | null;
  identifier?: string | null;
  providerIdentifier?: string | null;
  profile?: string | null;
  disabled?: boolean;
  refreshNeeded?: boolean;
  [key: string]: unknown;
}

interface PostizAnalyticsMetric {
  label?: string;
  percentageChange?: number;
  data?: Array<{
    date?: string;
    total?: number | string;
  }>;
}

const ZERO_ROW = {
  reach: 0,
  impressions: 0,
  interactions: 0,
  clicks: 0,
  formCompletions: 0,
  leads: 0,
  meetingsBooked: 0,
  meetingsAttended: 0,
  purchases: 0,
  noShows: 0,
  spend: 0,
};

export async function runPostizReadOnlyDryRun(input: PostizDryRunInput): Promise<DryRunResult> {
  const baseUrl = requiredCredential(input.credential.secrets.baseUrl, 'baseUrl');
  const apiKey = requiredCredential(input.credential.secrets.apiKey, 'apiKey');
  const apiBase = normalizePostizApiBase(baseUrl);
  const warnings: string[] = [];

  const integrations = await fetchPostizJson<PostizIntegration[]>(apiBase, '/integrations', apiKey);
  const normalizedIntegrations = integrations.filter(item => typeof item?.id === 'string' && item.id.trim().length > 0);
  const selectedIntegrationId = resolveSelectedIntegrationId(input.credential);
  const selectedChannel = selectedIntegrationId
    ? normalizedIntegrations.find(item => item.id === selectedIntegrationId) ?? null
    : null;

  if (normalizedIntegrations.length === 0) {
    warnings.push('Postiz credential is valid, but Postiz returned zero connected channels. Connect a supported social channel inside Postiz first.');
  } else if (!selectedIntegrationId) {
    warnings.push(`Postiz returned ${normalizedIntegrations.length} channel(s), but no integrationId is selected for Tanaghum scheduling/import readiness.`);
  } else if (!selectedChannel) {
    warnings.push('Selected Postiz integrationId was not returned by the Postiz workspace. Re-select the channel from the Postiz integration setup.');
  } else if (selectedChannel.disabled) {
    warnings.push('Selected Postiz channel is disabled. Re-authenticate or re-enable it in Postiz before importing analytics.');
  } else if (selectedChannel.refreshNeeded) {
    warnings.push('Selected Postiz channel needs refresh in Postiz before analytics can be trusted.');
  }

  let kpiRows: DryRunKpiRow[] = [];
  let analyticsFetched = false;
  let analyticsMetricLabels: string[] = [];
  if (selectedChannel && !selectedChannel.disabled && !selectedChannel.refreshNeeded) {
    const analytics = await fetchPostizJson<PostizAnalyticsMetric[]>(
      apiBase,
      `/analytics/${encodeURIComponent(selectedChannel.id)}?date=30`,
      apiKey,
    );
    analyticsFetched = true;
    analyticsMetricLabels = analytics
      .map(metric => safeString(metric.label))
      .filter((label): label is string => Boolean(label));
    const normalized = normalizePostizAnalyticsRows(analytics, selectedChannel);
    kpiRows = normalized.kpiRows;
    warnings.push(...normalized.warnings);
    if (kpiRows.length === 0) {
      warnings.push('Postiz analytics was reachable, but no recognized non-zero KPI metrics were returned for this channel.');
    }
  }

  return {
    connectorId: 'postiz',
    eventId: input.eventId ?? null,
    kpiRows,
    leadAttributions: 0,
    warnings,
    providerStatus: {
      provider: 'postiz',
      adapter: 'postiz_public_api',
      readOnly: true,
      externalWritesAllowed: false,
      rawSecretsReturned: false,
      channelsFound: normalizedIntegrations.length,
      selectedIntegrationId: selectedIntegrationId ?? null,
      selectedChannel: selectedChannel ? sanitizeIntegration(selectedChannel) : null,
      analyticsFetched,
      analyticsMetricLabels,
      source: 'Postiz Public API',
    },
  };
}

function normalizePostizApiBase(value: string): URL {
  const url = new URL(value);
  const path = url.pathname.replace(/\/+$/, '');
  if (path.endsWith('/api/public/v1') || path.endsWith('/public/v1')) {
    url.pathname = `${path}/`;
    return url;
  }
  url.pathname = `${path}/api/public/v1/`.replace(/\/{2,}/g, '/');
  return url;
}

async function fetchPostizJson<T>(apiBase: URL, path: string, apiKey: string): Promise<T> {
  const endpoint = new URL(path.replace(/^\//, ''), apiBase);
  const response = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Authorization: apiKey,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new ValidationError(`Postiz read-only API call failed with HTTP ${response.status}. Check the tenant Postiz API key, base URL, and workspace access.`);
  }

  return await response.json() as T;
}

function resolveSelectedIntegrationId(credential: DecryptedIntegrationCredential): string | null {
  return safeString(credential.secrets.integrationId)
    ?? safeString(credential.metadata.integrationId)
    ?? safeString((credential.metadata.selectedChannel as Record<string, unknown> | undefined)?.id)
    ?? null;
}

function normalizePostizAnalyticsRows(
  metrics: PostizAnalyticsMetric[],
  integration: PostizIntegration,
): { kpiRows: DryRunKpiRow[]; warnings: string[] } {
  const rows = new Map<string, DryRunKpiRow>();
  const warnings: string[] = [];
  const channel = normalizeChannel(integration);
  const unmappedLabels = new Set<string>();

  for (const metric of metrics) {
    const label = safeString(metric.label);
    if (!label || !Array.isArray(metric.data)) continue;
    const targetField = mapMetricLabel(label);
    if (!targetField) {
      unmappedLabels.add(label);
      continue;
    }
    for (const point of metric.data) {
      const metricDate = normalizeDate(point.date);
      const total = normalizeNumber(point.total);
      if (!metricDate || total <= 0) continue;
      const row = rows.get(metricDate) ?? {
        metricDate,
        channel,
        ...ZERO_ROW,
        notes: `Postiz analytics preview for ${displayChannelName(integration)}`,
      };
      row[targetField] += total;
      rows.set(metricDate, row);
    }
  }

  if (unmappedLabels.size > 0) {
    warnings.push(`Postiz returned unmapped analytics metric(s): ${[...unmappedLabels].join(', ')}.`);
  }

  return {
    kpiRows: [...rows.values()].filter(hasNonZeroSignal),
    warnings,
  };
}

function mapMetricLabel(label: string): keyof Omit<DryRunKpiRow, 'metricDate' | 'channel' | 'notes'> | null {
  const normalized = label.toLowerCase().replace(/[_-]+/g, ' ');
  if (normalized.includes('reach')) return 'reach';
  if (normalized.includes('impression') || normalized.includes('view')) return 'impressions';
  if (normalized.includes('click')) return 'clicks';
  if (normalized.includes('lead')) return 'leads';
  if (normalized.includes('form') || normalized.includes('submission')) return 'formCompletions';
  if (
    normalized.includes('engagement')
    || normalized.includes('interaction')
    || normalized.includes('like')
    || normalized.includes('comment')
    || normalized.includes('share')
    || normalized.includes('reaction')
  ) {
    return 'interactions';
  }
  return null;
}

function hasNonZeroSignal(row: DryRunKpiRow): boolean {
  return row.reach > 0
    || row.impressions > 0
    || row.interactions > 0
    || row.clicks > 0
    || row.formCompletions > 0
    || row.leads > 0
    || row.meetingsBooked > 0
    || row.meetingsAttended > 0
    || row.purchases > 0
    || row.noShows > 0
    || row.spend > 0;
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function normalizeNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, ''));
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return 0;
}

function normalizeChannel(integration: PostizIntegration): string {
  return safeString(integration.identifier)
    ?? safeString(integration.providerIdentifier)
    ?? safeString(integration.profile)
    ?? 'postiz';
}

function displayChannelName(integration: PostizIntegration): string {
  return safeString(integration.name)
    ?? safeString(integration.profile)
    ?? normalizeChannel(integration);
}

function sanitizeIntegration(integration: PostizIntegration): Record<string, unknown> {
  return {
    id: integration.id,
    name: safeString(integration.name),
    identifier: safeString(integration.identifier),
    providerIdentifier: safeString(integration.providerIdentifier),
    profile: safeString(integration.profile),
    disabled: Boolean(integration.disabled),
    refreshNeeded: Boolean(integration.refreshNeeded),
  };
}

function requiredCredential(value: string | undefined, field: string): string {
  if (!value || !value.trim()) throw new ValidationError(`Postiz credential is missing required field: ${field}`);
  return value.trim();
}

function safeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}
