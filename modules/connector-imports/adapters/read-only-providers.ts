import { ValidationError } from '@shared/errors';
import type { DecryptedIntegrationCredential } from '../../integration-credentials/service';
import type { DryRunKpiRow, DryRunResult } from '../types';

type FetchResponseLike = {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
  text: () => Promise<string>;
};

type FetchLike = (url: string, init?: {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  signal?: AbortSignal;
}) => Promise<FetchResponseLike>;

type AdapterInput = {
  credential: DecryptedIntegrationCredential;
  eventId?: string;
  fetcher?: FetchLike;
};

const ZERO_METRICS = {
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

export async function runKajabiReadOnlyDryRun(input: AdapterInput): Promise<DryRunResult> {
  if (process.env.KAJABI_READ_SYNC_ENABLED !== 'true') {
    return blockedResult('kajabi', input.eventId, 'KAJABI_READ_SYNC_ENABLED is not true. Enable only after customer approval for read-only Kajabi acceptance testing.');
  }

  const clientId = required(input.credential.secrets.clientId, 'clientId');
  const clientSecret = required(input.credential.secrets.clientSecret, 'clientSecret');
  const baseUrl = normalizeBaseUrl(input.credential.secrets.baseUrl || 'https://api.kajabi.com');
  const fetcher = input.fetcher ?? fetch as unknown as FetchLike;

  const token = await fetchJson(fetcher, `${baseUrl}/v1/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
    }).toString(),
  }, 'Kajabi token');
  const accessToken = stringFrom(token, 'access_token');
  if (!accessToken) throw new ValidationError('Kajabi token response did not include access_token.');

  const purchases = await fetchJson(fetcher, `${baseUrl}/v1/purchases?page[number]=1&page[size]=25`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  }, 'Kajabi purchases');

  const rows = arrayFrom(purchases, 'data').map((purchase, index) => normalizeKajabiPurchase(purchase, index)).filter(hasSignal);
  return {
    connectorId: 'kajabi',
    eventId: input.eventId ?? null,
    kpiRows: rows,
    leadAttributions: rows.length,
    warnings: rows.length ? [] : ['Kajabi read access worked, but no importable purchase rows were returned.'],
    providerStatus: {
      provider: 'kajabi',
      adapter: 'kajabi_public_api_purchases',
      readOnly: true,
      externalWritesAllowed: false,
      rawSecretsReturned: false,
      analyticsFetched: true,
      analyticsMetricLabels: ['purchases'],
      source: 'Kajabi Public API',
    },
  };
}

export async function runMetaAnalyticsDryRun(input: AdapterInput): Promise<DryRunResult> {
  if (process.env.ACQUISITION_READ_SYNC_ENABLED !== 'true') {
    return blockedResult('meta_analytics', input.eventId, 'ACQUISITION_READ_SYNC_ENABLED is not true. Enable only after customer approval for read-only Meta acceptance testing.');
  }

  const accessToken = required(input.credential.secrets.accessToken || input.credential.secrets.apiKey, 'accessToken');
  const adAccountId = required(input.credential.secrets.adAccountId, 'adAccountId');
  const baseUrl = normalizeBaseUrl(input.credential.secrets.baseUrl || 'https://graph.facebook.com/v19.0');
  const fetcher = input.fetcher ?? fetch as unknown as FetchLike;
  const since = input.credential.secrets.since || daysAgo(30);
  const until = input.credential.secrets.until || today();
  const account = adAccountId.startsWith('act_') ? adAccountId : `act_${adAccountId}`;
  const url = `${baseUrl}/${encodeURIComponent(account)}/insights?fields=date_start,date_stop,reach,impressions,clicks,spend,actions&time_increment=1&time_range=${encodeURIComponent(JSON.stringify({ since, until }))}`;
  const payload = await fetchJson(fetcher, url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  }, 'Meta insights');

  const rows = arrayFrom(payload, 'data').map(normalizeMetaInsight).filter(hasSignal);
  return {
    connectorId: 'meta_analytics',
    eventId: input.eventId ?? null,
    kpiRows: rows,
    leadAttributions: rows.reduce((sum, row) => sum + row.leads, 0),
    warnings: rows.length ? [] : ['Meta read access worked, but no importable insight rows were returned for the selected date range.'],
    providerStatus: {
      provider: 'meta_analytics',
      adapter: 'meta_marketing_insights_read_only',
      readOnly: true,
      externalWritesAllowed: false,
      rawSecretsReturned: false,
      analyticsFetched: true,
      analyticsMetricLabels: ['reach', 'impressions', 'clicks', 'spend', 'actions'],
      source: 'Meta Marketing API insights',
    },
  };
}

export async function runYouTubeAnalyticsDryRun(input: AdapterInput): Promise<DryRunResult> {
  if (process.env.ACQUISITION_READ_SYNC_ENABLED !== 'true') {
    return blockedResult('youtube_analytics', input.eventId, 'ACQUISITION_READ_SYNC_ENABLED is not true. Enable only after customer approval for read-only YouTube acceptance testing.');
  }

  const accessToken = required(input.credential.secrets.accessToken || input.credential.secrets.apiKey, 'accessToken');
  const channelId = required(input.credential.secrets.channelId, 'channelId');
  const baseUrl = normalizeBaseUrl(input.credential.secrets.baseUrl || 'https://youtubeanalytics.googleapis.com');
  const fetcher = input.fetcher ?? fetch as unknown as FetchLike;
  const startDate = input.credential.secrets.startDate || daysAgo(30);
  const endDate = input.credential.secrets.endDate || today();
  const url = `${baseUrl}/v2/reports?ids=channel==${encodeURIComponent(channelId)}&startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}&metrics=views,likes,comments,shares&dimensions=day&sort=day`;
  const payload = await fetchJson(fetcher, url, {
    method: 'GET',
    headers: { Authorization: `Bearer ${accessToken}` },
  }, 'YouTube Analytics reports');

  const rows = normalizeYouTubeReport(payload).filter(hasSignal);
  return {
    connectorId: 'youtube_analytics',
    eventId: input.eventId ?? null,
    kpiRows: rows,
    leadAttributions: 0,
    warnings: rows.length ? [] : ['YouTube read access worked, but no importable analytics rows were returned for the selected date range.'],
    providerStatus: {
      provider: 'youtube_analytics',
      adapter: 'youtube_analytics_reports_read_only',
      readOnly: true,
      externalWritesAllowed: false,
      rawSecretsReturned: false,
      analyticsFetched: true,
      analyticsMetricLabels: ['views', 'likes', 'comments', 'shares'],
      source: 'YouTube Analytics API reports',
    },
  };
}

export async function runFormalooReadOnlyDryRun(input: AdapterInput): Promise<DryRunResult> {
  if (process.env.ACQUISITION_READ_SYNC_ENABLED !== 'true') {
    return blockedResult('formaloo', input.eventId, 'ACQUISITION_READ_SYNC_ENABLED is not true. Enable only after customer approval for read-only Formaloo acceptance testing.');
  }

  const submissionsUrl = input.credential.secrets.submissionsUrl || input.credential.metadata.submissionsUrl;
  if (typeof submissionsUrl !== 'string' || !submissionsUrl.trim()) {
    return blockedResult('formaloo', input.eventId, 'Formaloo credentials are saved, but the customer-specific submissionsUrl is missing. Add the read-only submissions endpoint after Formaloo API access is confirmed.');
  }

  const token = required(input.credential.secrets.accessToken || input.credential.secrets.clientKey || input.credential.secrets.apiKey, 'accessToken');
  const fetcher = input.fetcher ?? fetch as unknown as FetchLike;
  const payload = await fetchJson(fetcher, submissionsUrl, {
    method: 'GET',
    headers: { Authorization: `Bearer ${token}` },
  }, 'Formaloo submissions');
  const rows = arrayFrom(payload, 'data')
    .map((submission, index) => normalizeFormalooSubmission(submission, index))
    .filter(hasSignal);

  return {
    connectorId: 'formaloo',
    eventId: input.eventId ?? null,
    kpiRows: rows,
    leadAttributions: rows.reduce((sum, row) => sum + row.formCompletions + row.leads, 0),
    warnings: rows.length ? [] : ['Formaloo read access worked, but no importable submission rows were returned.'],
    providerStatus: {
      provider: 'formaloo',
      adapter: 'formaloo_submissions_read_only',
      readOnly: true,
      externalWritesAllowed: false,
      rawSecretsReturned: false,
      analyticsFetched: true,
      analyticsMetricLabels: ['form_completions', 'leads'],
      source: 'Formaloo submissions API',
    },
  };
}

function normalizeKajabiPurchase(value: unknown, index: number): DryRunKpiRow {
  const row = recordFrom(value);
  const attributes = recordFrom(row.attributes);
  const created = stringFrom(attributes, 'created_at') || stringFrom(row, 'created_at') || today();
  return {
    metricDate: normalizeDate(created),
    channel: 'kajabi',
    ...ZERO_METRICS,
    purchases: 1,
    notes: `Kajabi purchase preview row ${index + 1}`,
  };
}

function normalizeMetaInsight(value: unknown): DryRunKpiRow {
  const row = recordFrom(value);
  const actions = Array.isArray(row.actions) ? row.actions : [];
  return {
    metricDate: normalizeDate(stringFrom(row, 'date_start') || today()),
    channel: 'meta',
    ...ZERO_METRICS,
    reach: numberFrom(row.reach),
    impressions: numberFrom(row.impressions),
    clicks: numberFrom(row.clicks),
    spend: numberFrom(row.spend),
    interactions: sumActions(actions, ['post_engagement', 'page_engagement', 'like', 'comment', 'post_reaction', 'share']),
    leads: sumActions(actions, ['lead', 'onsite_conversion.lead_grouped', 'offsite_conversion.fb_pixel_lead']),
    formCompletions: sumActions(actions, ['lead', 'onsite_conversion.lead_grouped']),
    purchases: sumActions(actions, ['purchase', 'offsite_conversion.fb_pixel_purchase']),
    notes: 'Meta read-only insight preview',
  };
}

function normalizeYouTubeReport(payload: unknown): DryRunKpiRow[] {
  const record = recordFrom(payload);
  const rows = Array.isArray(record.rows) ? record.rows : [];
  return rows.map((row) => {
    const values = Array.isArray(row) ? row : [];
    const views = numberFrom(values[1]);
    const likes = numberFrom(values[2]);
    const comments = numberFrom(values[3]);
    const shares = numberFrom(values[4]);
    return {
      metricDate: normalizeDate(String(values[0] || today())),
      channel: 'youtube',
      ...ZERO_METRICS,
      reach: views,
      impressions: views,
      interactions: likes + comments + shares,
      notes: 'YouTube read-only analytics preview',
    };
  });
}

function normalizeFormalooSubmission(value: unknown, index: number): DryRunKpiRow {
  const row = recordFrom(value);
  const created = stringFrom(row, 'created_at') || stringFrom(row, 'created') || today();
  return {
    metricDate: normalizeDate(created),
    channel: 'formaloo',
    ...ZERO_METRICS,
    formCompletions: 1,
    leads: 1,
    notes: `Formaloo submission preview row ${index + 1}`,
  };
}

function blockedResult(connectorId: string, eventId: string | undefined, warning: string): DryRunResult {
  return {
    connectorId,
    eventId: eventId ?? null,
    kpiRows: [],
    leadAttributions: 0,
    warnings: [warning],
    providerStatus: {
      provider: connectorId,
      adapter: 'read_only_provider_adapter',
      readOnly: true,
      externalWritesAllowed: false,
      rawSecretsReturned: false,
      analyticsFetched: false,
      analyticsMetricLabels: [],
      source: 'Customer-owned provider API',
    },
  };
}

async function fetchJson(fetcher: FetchLike, url: string, init: Parameters<FetchLike>[1], label: string): Promise<unknown> {
  const response = await fetcher(url, { ...init, signal: AbortSignal.timeout(10000) });
  if (!response.ok) {
    throw new ValidationError(`${label} read-only API call failed with HTTP ${response.status}. Check customer credentials, provider permissions, and selected account.`);
  }
  return response.json();
}

function required(value: string | undefined, field: string): string {
  if (!value || !value.trim()) throw new ValidationError(`Connector credential is missing required field: ${field}`);
  return value.trim();
}

function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, '');
}

function recordFrom(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function arrayFrom(value: unknown, key: string): unknown[] {
  const record = recordFrom(value);
  return Array.isArray(record[key]) ? record[key] as unknown[] : [];
}

function stringFrom(value: unknown, key: string): string {
  const record = recordFrom(value);
  return typeof record[key] === 'string' ? record[key] as string : '';
}

function numberFrom(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value) && value >= 0) return value;
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/,/g, ''));
    if (Number.isFinite(parsed) && parsed >= 0) return parsed;
  }
  return 0;
}

function sumActions(actions: unknown[], actionTypes: string[]): number {
  return actions.reduce<number>((sum, item) => {
    const action = recordFrom(item);
    const type = String(action.action_type || '');
    if (!actionTypes.includes(type)) return sum;
    return sum + numberFrom(action.value);
  }, 0);
}

function normalizeDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return new Date().toISOString();
  return date.toISOString();
}

function hasSignal(row: DryRunKpiRow): boolean {
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

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}
